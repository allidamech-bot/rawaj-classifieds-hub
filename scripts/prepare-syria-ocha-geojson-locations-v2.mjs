#!/usr/bin/env node

/**
 * RAWAJ Syria OCHA/HDX GeoJSON converter v2.
 * Reconciles overlapping populated-place/neighborhood P-codes, resolves sibling slug
 * collisions deterministically, and validates ordered target paths across arbitrary depth.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { getLocationNodeSourceSortOrder } from "../src/lib/location-node-order.ts";
import {
  buildOchaSourceNotes,
  classifySyriaPopulatedPlace,
  summarizeSyriaSourceClassifications,
} from "./syria-location-type-classification.mjs";

const args = parseArgs(process.argv.slice(2));
const inputDir = resolve(args.input ?? "data/locations/sources/geojson");
const outputJson = resolve(args.json ?? "data/locations/syria-ocha-location-nodes.json");
const outputCsv = resolve(args.csv ?? "data/locations/syria-ocha-location-nodes.csv");
const reportPath = resolve(args.report ?? "data/locations/syria-ocha-location-report.json");
const dryRun = Boolean(args["dry-run"]);

const SOURCE = "ocha-hdx-cod-ab-syr";
const SOURCE_URL = "https://data.humdata.org/dataset/cod-ab-syr";
const POPULATED_SOURCE_URL =
  "https://data.humdata.org/dataset/syrian-arab-republic-populated-places";

const layers = {
  admin0: await features("syr_admin0.geojson"),
  admin1: await features("syr_admin1.geojson"),
  admin2: await features("syr_admin2.geojson"),
  admin3: await features("syr_admin3.geojson"),
  populated: await features("syr_populatedplaces.geojson"),
  neighborhoods: await features("syr_neighborhoods.geojson"),
};

const nodes = new Map();
const reconciliation = {
  crossLayerPcodeMerges: 0,
  neighborhoodUpgrades: 0,
  areaMerges: 0,
  slugCollisionsResolved: 0,
};
const sourceClassificationRecords = [];

for (const feature of layers.admin0) upsert(adminNode(feature, 0), "admin");
for (const feature of layers.admin1) upsert(adminNode(feature, 1), "admin");
for (const feature of layers.admin2) upsert(adminNode(feature, 2), "admin");
for (const feature of layers.admin3) upsert(adminNode(feature, 3), "admin");
for (const feature of layers.populated) upsert(populatedNode(feature), "populated");

for (const feature of layers.neighborhoods) {
  const area = areaNode(feature);
  if (area) upsert(area, "area");
}
for (const feature of layers.neighborhoods) upsert(neighborhoodNode(feature), "neighborhood");

const output = [...nodes.values()];
const idByPcode = new Map(output.map((node) => [node.official_code, node.id]));
for (const node of output) {
  node.parent_id = node.parent_official_code
    ? (idByPcode.get(node.parent_official_code) ?? null)
    : null;
  delete node.parent_official_code;
}

resolveSiblingSlugCollisions(output);
recalculateDepths(output);

const validation = validate(output);
const arabicAudit = auditArabic(output);
const targetPaths = verifyTargets(output);
const sourceClassificationAudit = summarizeSyriaSourceClassifications(sourceClassificationRecords);
const report = {
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  generatedAt: new Date().toISOString(),
  inputCounts: {
    admin0: layers.admin0.length,
    admin1: layers.admin1.length,
    admin2: layers.admin2.length,
    admin3: layers.admin3.length,
    populatedPlaces: layers.populated.length,
    neighborhoods: layers.neighborhoods.length,
  },
  reconciliation,
  outputCounts: countBy(output, (node) => node.node_type),
  totalNodes: output.length,
  validation,
  arabicAudit,
  targetPaths,
  sourceClassificationAudit,
};

const blocking = [...validation.blockingIssues];
if (sourceClassificationAudit.unmappedCount > 0) {
  blocking.push(
    `unmapped OCHA populated-place source classes: ${sourceClassificationAudit.unmappedCount}/${sourceClassificationAudit.total}; review sourceClassificationAudit before importing`,
  );
}
if (arabicAudit.suspiciousCount > 0) {
  blocking.push(`suspicious Arabic/mojibake values: ${arabicAudit.suspiciousCount}`);
}
report.blockingIssueCount = blocking.length;
report.blockingIssues = blocking.slice(0, 300);

if (dryRun) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(blocking.length ? 1 : 0);
}

if (blocking.length) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  throw new Error("OCHA Syria conversion blocked by validation issues.");
}

output.sort((a, b) => a.depth - b.depth || a.name_ar.localeCompare(b.name_ar, "ar"));
await mkdir(dirname(outputJson), { recursive: true });
await writeFile(outputJson, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(outputCsv, csv(output), "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

function adminNode(feature, level) {
  const p = properties(feature);
  const pcode = required(p[`adm${level}_pcode`], `adm${level}_pcode`);
  const english = text(p[`adm${level}_name`]) || text(p[`adm${level}_ref_name`]);
  const arabic = firstArabic(
    p[`adm${level}_name1`],
    p[`adm${level}_name2`],
    p[`adm${level}_name3`],
  );
  return makeNode({
    pcode,
    parentPcode: level === 0 ? null : text(p[`adm${level - 1}_pcode`]),
    type: ["country", "governorate", "district", "subdistrict"][level],
    nameAr: arabic || english,
    nameEn: english,
    aliases: [
      p[`adm${level}_ref_name`],
      p[`adm${level}_name`],
      p[`adm${level}_name1`],
      p[`adm${level}_name2`],
      p[`adm${level}_name3`],
    ],
    lat: numberOrNull(p.center_lat),
    lon: numberOrNull(p.center_lon),
    sourceDate: text(p.valid_on),
    version: text(p.version),
  });
}

function populatedNode(feature) {
  const p = properties(feature);
  const pcode = required(p.pcode, "populated place pcode");
  const english = text(p.featurename_en) || text(p.adm4_en) || text(p.featurerefname);
  const arabic = firstArabic(
    p.featurename_ar,
    p.adm4_ar,
    p.featurealtname1_ar,
    p.featurealtname2_ar,
  );
  const sourceClassification = classifySyriaPopulatedPlace(
    p.popplaceclasstitle,
    p.popplaceclassnumber,
  );
  sourceClassificationRecords.push({ pcode, ...sourceClassification });
  return makeNode({
    pcode,
    parentPcode: required(p.adm3_pcode, `adm3_pcode for ${pcode}`),
    type: sourceClassification.nodeType,
    nameAr: arabic || english,
    nameEn: english,
    aliases: [
      p.featurerefname,
      p.featurealtname1_en,
      p.featurealtname2_en,
      p.featurealtname1_ar,
      p.featurealtname2_ar,
      p.adm4_en,
      p.adm4_ar,
    ],
    lat: numberOrNull(p.point_y),
    lon: numberOrNull(p.point_x),
    sourceDate: text(p.validon) || text(p.date),
    version: text(p.version),
    sourceUrl: POPULATED_SOURCE_URL,
    sourceClassification,
  });
}

function areaNode(feature) {
  const p = properties(feature);
  const pcode = text(p.areapcode);
  if (!pcode) return null;
  return makeNode({
    pcode,
    parentPcode: required(p.adm4_pcode, `adm4_pcode for area ${pcode}`),
    type: "locality",
    nameAr: firstArabic(p.areaname_ar) || text(p.areaname_en),
    nameEn: text(p.areaname_en),
    aliases: [],
    lat: null,
    lon: null,
    sourceDate: text(p.validon) || text(p.date),
    version: text(p.version),
  });
}

function neighborhoodNode(feature) {
  const p = properties(feature);
  const pcode = required(p.neighborhoodpcode, "neighborhoodpcode");
  return makeNode({
    pcode,
    parentPcode: text(p.areapcode) || required(p.adm4_pcode, `adm4_pcode for ${pcode}`),
    type: "neighborhood",
    nameAr:
      firstArabic(p.neighborhoodname_ar, p.neighborhoodaltname1_ar, p.neighborhoodaltname2_ar) ||
      text(p.neighborhoodname_en),
    nameEn: text(p.neighborhoodname_en),
    aliases: [
      p.neighborhoodrefname,
      p.neighborhoodaltname1_en,
      p.neighborhoodaltname2_en,
      p.neighborhoodaltname1_ar,
      p.neighborhoodaltname2_ar,
    ],
    lat: null,
    lon: null,
    sourceDate: text(p.validon) || text(p.date),
    version: text(p.version),
  });
}

function makeNode({
  pcode,
  parentPcode,
  type,
  nameAr,
  nameEn,
  aliases,
  lat,
  lon,
  sourceDate,
  version,
  sourceUrl = SOURCE_URL,
  sourceClassification = null,
}) {
  const safeAr = required(nameAr || nameEn || pcode, `name for ${pcode}`);
  const safeEn = text(nameEn) || null;
  return {
    id: uuid(`${SOURCE}:${pcode}`),
    parent_id: null,
    parent_official_code: parentPcode || null,
    country_code: "SY",
    node_type: type,
    name_ar: safeAr,
    name_en: safeEn,
    slug: slugify(safeEn || safeAr || pcode),
    official_code: pcode,
    external_source: SOURCE,
    external_id: pcode,
    latitude: lat,
    longitude: lon,
    sort_order: getLocationNodeSourceSortOrder(type),
    depth: 0,
    is_active: true,
    search_aliases: unique(aliases).filter((v) => v !== safeAr && v !== safeEn),
    legacy_governorate_id: null,
    legacy_district_ar: null,
    source_url: sourceUrl,
    source_date: sourceDate || null,
    confidence: "high",
    review_status: "unreviewed",
    notes: buildOchaSourceNotes(version, sourceClassification),
  };
}

function upsert(incoming, layer) {
  const existing = nodes.get(incoming.official_code);
  if (!existing) {
    incoming.__layer = layer;
    nodes.set(incoming.official_code, incoming);
    return;
  }

  reconciliation.crossLayerPcodeMerges += 1;
  const aliases = unique([
    ...existing.search_aliases,
    ...incoming.search_aliases,
    existing.name_ar,
    existing.name_en,
    incoming.name_ar,
    incoming.name_en,
  ]);

  if (layer === "neighborhood") {
    existing.node_type = "neighborhood";
    existing.parent_official_code = incoming.parent_official_code || existing.parent_official_code;
    existing.name_ar = incoming.name_ar || existing.name_ar;
    existing.name_en = incoming.name_en || existing.name_en;
    existing.sort_order = incoming.sort_order;
    existing.__layer = "neighborhood";
    reconciliation.neighborhoodUpgrades += 1;
  } else if (layer === "area" && existing.__layer !== "neighborhood") {
    existing.parent_official_code = incoming.parent_official_code || existing.parent_official_code;
    existing.name_ar = incoming.name_ar || existing.name_ar;
    existing.name_en = incoming.name_en || existing.name_en;
    existing.sort_order = incoming.sort_order;
    reconciliation.areaMerges += 1;
  }

  existing.search_aliases = aliases.filter((v) => v !== existing.name_ar && v !== existing.name_en);
  existing.latitude ??= incoming.latitude;
  existing.longitude ??= incoming.longitude;
}

function resolveSiblingSlugCollisions(values) {
  const groups = new Map();
  for (const node of values) {
    const key = `${node.country_code}|${node.parent_id ?? node.parent_official_code ?? "root"}|${node.slug}`;
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.official_code.localeCompare(b.official_code));
    for (const node of group) {
      node.slug = `${node.slug}-${slugify(node.official_code)}`;
      reconciliation.slugCollisionsResolved += 1;
    }
  }
}

function recalculateDepths(values) {
  const byId = new Map(values.map((node) => [node.id, node]));
  for (const node of values) node.depth = computeDepth(node, byId);
  for (const node of values) delete node.__layer;
}

function computeDepth(node, byId) {
  let depth = 0;
  let current = node;
  const seen = new Set();
  while (current.parent_id) {
    if (seen.has(current.id)) return depth;
    seen.add(current.id);
    current = byId.get(current.parent_id);
    if (!current) break;
    depth += 1;
  }
  return depth;
}

function validate(values) {
  const issues = [];
  const ids = new Set(values.map((n) => n.id));
  const parentSlug = new Set();
  const parentById = new Map(values.map((n) => [n.id, n.parent_id]));

  for (const node of values) {
    if (node.parent_id && !ids.has(node.parent_id))
      issues.push(`orphan parent: ${node.official_code}`);
    if (node.parent_id === node.id) issues.push(`self parent: ${node.official_code}`);
    const key = `${node.country_code}|${node.parent_id ?? "root"}|${node.slug}`;
    if (parentSlug.has(key)) issues.push(`duplicate parent slug: ${key}`);
    parentSlug.add(key);
  }

  for (const node of values) {
    const seen = new Set();
    let current = node.id;
    while (current) {
      if (seen.has(current)) {
        issues.push(`cycle detected from: ${node.official_code}`);
        break;
      }
      seen.add(current);
      current = parentById.get(current) ?? null;
    }
  }

  return { blockingIssueCount: issues.length, blockingIssues: issues.slice(0, 300) };
}

function auditArabic(values) {
  const suspicious = [];
  let arabicScriptCount = 0;
  let englishFallbackCount = 0;
  for (const node of values) {
    if (containsArabic(node.name_ar)) arabicScriptCount += 1;
    else englishFallbackCount += 1;
    for (const value of [node.name_ar, ...node.search_aliases]) {
      if (mojibake(value)) suspicious.push({ pcode: node.official_code, value });
    }
  }
  return {
    arabicScriptCount,
    englishFallbackCount,
    suspiciousCount: suspicious.length,
    suspiciousExamples: suspicious.slice(0, 100),
  };
}

function verifyTargets(values) {
  const byId = new Map(values.map((node) => [node.id, node]));
  const leafTargets = ["Tal Dahab", "Tall Dahab", "تلذهب", "تل ذهب"];
  const leafMatches = values.filter((node) =>
    leafTargets.some((target) => nameMatches(node, target)),
  );
  const actualPaths = leafMatches.map((node) => pathOf(node, byId));
  const requested = [
    ["Homs", "Al Houla", "Tal Dahab"],
    ["Homs", "Houla", "Tall Dahab"],
    ["حمص", "الحولة", "تلذهب"],
    ["حمص", "الحولة", "تل ذهب"],
  ];

  return {
    leafMatchCount: leafMatches.length,
    actualLeafPaths: actualPaths.map((path) =>
      path.map((node) => ({ pcode: node.official_code, ar: node.name_ar, en: node.name_en })),
    ),
    requested: requested.map((segments) => ({
      target: segments.join(" > "),
      orderedHierarchyMatches: actualPaths
        .filter((path) => orderedSubsequence(path, segments))
        .map((path) => path.map((node) => node.official_code)),
    })),
  };
}

function orderedSubsequence(path, segments) {
  let cursor = 0;
  for (const node of path) {
    if (cursor < segments.length && nameMatches(node, segments[cursor])) cursor += 1;
  }
  return cursor === segments.length;
}

function pathOf(node, byId) {
  const path = [];
  const seen = new Set();
  let current = node;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  return path.reverse();
}

function nameMatches(node, target) {
  const n = normalize(target);
  return [node.name_ar, node.name_en, ...node.search_aliases]
    .filter(Boolean)
    .some((value) => normalize(value) === n);
}

function firstArabic(...values) {
  for (const value of values) {
    const v = text(value);
    if (v && containsArabic(v) && !mojibake(v)) return v;
  }
  return "";
}

function mojibake(value) {
  const v = text(value);
  return /[╪╫┘┤┐└│├┬┴─]/.test(v) || /(?:Ã|Â|Ø|Ù|Ð|Ñ){2,}/.test(v);
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(text(value));
}

function normalize(value) {
  return text(value)
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim();
}

async function features(filename) {
  const parsed = JSON.parse(await readFile(resolve(inputDir, filename), "utf8"));
  if (!Array.isArray(parsed.features)) throw new Error(`${filename} has no features array.`);
  return parsed.features;
}

function properties(feature) {
  return feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
}

function text(value) {
  return String(value ?? "").trim();
}
function required(value, field) {
  const v = text(value);
  if (!v) throw new Error(`Missing required field: ${field}`);
  return v;
}
function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}
function slugify(value) {
  return normalize(value).replace(/\s+/g, "-") || "location";
}
function uuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function countBy(values, keyFn) {
  const result = {};
  for (const value of values) {
    const key = keyFn(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}
function csvCell(value) {
  if (value === null || value === undefined) return "";
  const v = Array.isArray(value) ? `{${value.join(",")}}` : String(value);
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}
function csv(values) {
  const cols = [
    "id",
    "parent_id",
    "country_code",
    "node_type",
    "name_ar",
    "name_en",
    "slug",
    "official_code",
    "external_source",
    "external_id",
    "latitude",
    "longitude",
    "sort_order",
    "depth",
    "is_active",
    "search_aliases",
    "legacy_governorate_id",
    "legacy_district_ar",
    "source_url",
    "source_date",
    "confidence",
    "review_status",
    "notes",
  ];
  return `${[cols.join(","), ...values.map((n) => cols.map((c) => csvCell(n[c])).join(","))].join("\n")}\n`;
}
function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}
