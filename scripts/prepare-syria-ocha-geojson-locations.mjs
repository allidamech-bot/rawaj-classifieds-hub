#!/usr/bin/env node

/**
 * Convert reviewed OCHA/HDX Syria GeoJSON layers into RAWAJ location_nodes JSON/CSV.
 *
 * Input layers (extracted from cod-ab-syr GeoJSON resource):
 * - syr_admin0.geojson
 * - syr_admin1.geojson
 * - syr_admin2.geojson
 * - syr_admin3.geojson
 * - syr_populatedplaces.geojson
 * - syr_neighborhoods.geojson
 *
 * Safety:
 * - never writes to the retired backend
 * - deterministic UUIDs from source P-codes
 * - blocks orphan parents, duplicate external IDs, cycles, duplicate parent+slug keys
 * - blocks suspicious Arabic mojibake unless explicitly overridden
 * - verifies requested example paths without hardcoding data rows
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const inputDir = resolve(args.input ?? "data/locations/sources/geojson");
const outputJson = resolve(args.json ?? "data/locations/syria-ocha-location-nodes.json");
const outputCsv = resolve(args.csv ?? "data/locations/syria-ocha-location-nodes.csv");
const reportPath = resolve(args.report ?? "data/locations/syria-ocha-location-report.json");
const allowMojibake = Boolean(args["allow-mojibake"]);
const dryRun = Boolean(args["dry-run"]);

const SOURCE = "ocha-hdx-cod-ab-syr";
const SOURCE_URL = "https://data.humdata.org/dataset/cod-ab-syr";

const admin0 = await readFeatures("syr_admin0.geojson");
const admin1 = await readFeatures("syr_admin1.geojson");
const admin2 = await readFeatures("syr_admin2.geojson");
const admin3 = await readFeatures("syr_admin3.geojson");
const populatedPlaces = await readFeatures("syr_populatedplaces.geojson");
const neighborhoods = await readFeatures("syr_neighborhoods.geojson");

const nodesByPcode = new Map();
const duplicatePcodes = new Set();

for (const feature of admin0) addNode(adminNode(feature, 0));
for (const feature of admin1) addNode(adminNode(feature, 1));
for (const feature of admin2) addNode(adminNode(feature, 2));
for (const feature of admin3) addNode(adminNode(feature, 3));
for (const feature of populatedPlaces) addNode(populatedPlaceNode(feature));

// Neighborhood data contains optional intermediate urban areas. Create those first.
for (const feature of neighborhoods) {
  const area = neighborhoodAreaNode(feature);
  if (area) addNode(area);
}
for (const feature of neighborhoods) addNode(neighborhoodNode(feature));

const nodes = [...nodesByPcode.values()];
const idByPcode = new Map(nodes.map((node) => [node.official_code, node.id]));

for (const node of nodes) {
  if (node.parent_official_code) {
    node.parent_id = idByPcode.get(node.parent_official_code) ?? null;
  }
  delete node.parent_official_code;
}

const validation = validateNodes(nodes);
const arabicAudit = auditArabic(nodes);
const targetPaths = verifyTargetPaths(nodes);

const report = {
  source: SOURCE,
  sourceUrl: SOURCE_URL,
  generatedAt: new Date().toISOString(),
  inputCounts: {
    admin0: admin0.length,
    admin1: admin1.length,
    admin2: admin2.length,
    admin3: admin3.length,
    populatedPlaces: populatedPlaces.length,
    neighborhoods: neighborhoods.length,
  },
  outputCounts: countBy(nodes, (node) => node.node_type),
  totalNodes: nodes.length,
  duplicateSourcePcodes: [...duplicatePcodes].slice(0, 200),
  validation,
  arabicAudit,
  targetPaths,
};

const blockingIssues = [
  ...validation.blockingIssues,
  ...(duplicatePcodes.size > 0 ? [`duplicate source P-codes: ${duplicatePcodes.size}`] : []),
  ...(!allowMojibake && arabicAudit.suspiciousCount > 0
    ? [`suspicious Arabic/mojibake values: ${arabicAudit.suspiciousCount}`]
    : []),
];

report.blockingIssueCount = blockingIssues.length;
report.blockingIssues = blockingIssues.slice(0, 300);

if (dryRun) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(blockingIssues.length > 0 ? 1 : 0);
}

if (blockingIssues.length > 0) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  throw new Error(
    "OCHA Syria conversion blocked by validation issues. Review the report before import.",
  );
}

nodes.sort(
  (a, b) =>
    a.depth - b.depth || a.sort_order - b.sort_order || a.name_ar.localeCompare(b.name_ar, "ar"),
);
await mkdir(dirname(outputJson), { recursive: true });
await writeFile(outputJson, `${JSON.stringify(nodes, null, 2)}\n`, "utf8");
await writeFile(outputCsv, toCsv(nodes), "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

function adminNode(feature, level) {
  const p = props(feature);
  const pcode = required(p[`adm${level}_pcode`], `adm${level}_pcode`);
  const english = text(p[`adm${level}_name`]) || text(p[`adm${level}_ref_name`]);
  const arabic = pickArabic(p[`adm${level}_name1`], p[`adm${level}_name2`], p[`adm${level}_name3`]);
  const parentPcode = level === 0 ? null : text(p[`adm${level - 1}_pcode`]);
  const types = ["country", "governorate", "district", "subdistrict"];

  return baseNode({
    pcode,
    parentPcode,
    nodeType: types[level],
    nameAr: arabic || english,
    nameEn: english,
    aliases: unique([
      p[`adm${level}_ref_name`],
      p[`adm${level}_name`],
      p[`adm${level}_name1`],
      p[`adm${level}_name2`],
      p[`adm${level}_name3`],
    ]),
    latitude: numberOrNull(p.center_lat),
    longitude: numberOrNull(p.center_lon),
    sourceDate: text(p.valid_on),
    version: text(p.version),
    depth: level,
  });
}

function populatedPlaceNode(feature) {
  const p = props(feature);
  const pcode = required(p.pcode, "populated place pcode");
  const english = text(p.featurename_en) || text(p.adm4_en) || text(p.featurerefname);
  const arabic = pickArabic(
    p.featurename_ar,
    p.adm4_ar,
    p.featurealtname1_ar,
    p.featurealtname2_ar,
  );
  const classTitle = text(p.popplaceclasstitle).toLowerCase();

  return baseNode({
    pcode,
    parentPcode: required(p.adm3_pcode, `adm3_pcode for ${pcode}`),
    nodeType: inferPopulatedPlaceType(classTitle),
    nameAr: arabic || english,
    nameEn: english,
    aliases: unique([
      p.featurerefname,
      p.featurealtname1_en,
      p.featurealtname2_en,
      p.featurealtname1_ar,
      p.featurealtname2_ar,
      p.adm4_en,
      p.adm4_ar,
    ]),
    latitude: numberOrNull(p.point_y),
    longitude: numberOrNull(p.point_x),
    sourceDate: text(p.validon) || text(p.date),
    version: text(p.version),
    depth: 4,
  });
}

function neighborhoodAreaNode(feature) {
  const p = props(feature);
  const pcode = text(p.areapcode);
  if (!pcode) return null;

  return baseNode({
    pcode,
    parentPcode: required(p.adm4_pcode, `adm4_pcode for area ${pcode}`),
    nodeType: "locality",
    nameAr: pickArabic(p.areaname_ar) || text(p.areaname_en),
    nameEn: text(p.areaname_en),
    aliases: [],
    latitude: null,
    longitude: null,
    sourceDate: text(p.validon) || text(p.date),
    version: text(p.version),
    depth: 5,
  });
}

function neighborhoodNode(feature) {
  const p = props(feature);
  const pcode = required(p.neighborhoodpcode, "neighborhoodpcode");
  const parentPcode =
    text(p.areapcode) || required(p.adm4_pcode, `adm4_pcode for neighborhood ${pcode}`);

  return baseNode({
    pcode,
    parentPcode,
    nodeType: "neighborhood",
    nameAr:
      pickArabic(p.neighborhoodname_ar, p.neighborhoodaltname1_ar, p.neighborhoodaltname2_ar) ||
      text(p.neighborhoodname_en),
    nameEn: text(p.neighborhoodname_en),
    aliases: unique([
      p.neighborhoodrefname,
      p.neighborhoodaltname1_en,
      p.neighborhoodaltname2_en,
      p.neighborhoodaltname1_ar,
      p.neighborhoodaltname2_ar,
    ]),
    latitude: null,
    longitude: null,
    sourceDate: text(p.validon) || text(p.date),
    version: text(p.version),
    depth: text(p.areapcode) ? 6 : 5,
  });
}

function baseNode({
  pcode,
  parentPcode,
  nodeType,
  nameAr,
  nameEn,
  aliases,
  latitude,
  longitude,
  sourceDate,
  version,
  depth,
}) {
  const safeNameAr = required(nameAr || nameEn || pcode, `name for ${pcode}`);
  const safeNameEn = text(nameEn) || null;
  return {
    id: stableUuid(`${SOURCE}:${pcode}`),
    parent_id: null,
    parent_official_code: parentPcode || null,
    country_code: "SY",
    node_type: nodeType,
    name_ar: safeNameAr,
    name_en: safeNameEn,
    slug: slugify(safeNameEn || safeNameAr || pcode),
    official_code: pcode,
    external_source: SOURCE,
    external_id: pcode,
    latitude,
    longitude,
    sort_order: 0,
    depth,
    is_active: true,
    search_aliases: unique(aliases).filter((value) => value !== safeNameAr && value !== safeNameEn),
    legacy_governorate_id: null,
    legacy_district_ar: null,
    source_url: SOURCE_URL,
    source_date: sourceDate || null,
    confidence: "high",
    review_status: "unreviewed",
    notes: version ? `OCHA/HDX source version ${version}` : null,
  };
}

function addNode(node) {
  const existing = nodesByPcode.get(node.official_code);
  if (!existing) {
    nodesByPcode.set(node.official_code, node);
    return;
  }

  // A populated place P-code can be repeated as adm4_pcode across source rows.
  // Merge only when the canonical identity is the same; otherwise block.
  const sameIdentity =
    existing.external_id === node.external_id &&
    normalize(existing.name_en || existing.name_ar) === normalize(node.name_en || node.name_ar);

  if (!sameIdentity) {
    duplicatePcodes.add(node.official_code);
    return;
  }

  existing.search_aliases = unique([...existing.search_aliases, ...node.search_aliases]);
  existing.latitude ??= node.latitude;
  existing.longitude ??= node.longitude;
}

function validateNodes(nodes) {
  const blockingIssues = [];
  const ids = new Set(nodes.map((node) => node.id));
  const external = new Set();
  const parentSlugs = new Set();
  const parentById = new Map(nodes.map((node) => [node.id, node.parent_id]));

  for (const node of nodes) {
    const externalKey = `${node.external_source}|${node.external_id}`;
    if (external.has(externalKey)) blockingIssues.push(`duplicate external key: ${externalKey}`);
    external.add(externalKey);

    if (node.parent_id && !ids.has(node.parent_id)) {
      blockingIssues.push(`orphan parent: ${node.official_code}`);
    }
    if (node.parent_id === node.id) blockingIssues.push(`self parent: ${node.official_code}`);

    const parentSlugKey = `${node.country_code}|${node.parent_id ?? "root"}|${node.slug}`;
    if (parentSlugs.has(parentSlugKey))
      blockingIssues.push(`duplicate parent slug: ${parentSlugKey}`);
    parentSlugs.add(parentSlugKey);

    if (node.latitude !== null && (node.latitude < -90 || node.latitude > 90)) {
      blockingIssues.push(`invalid latitude: ${node.official_code}`);
    }
    if (node.longitude !== null && (node.longitude < -180 || node.longitude > 180)) {
      blockingIssues.push(`invalid longitude: ${node.official_code}`);
    }
  }

  for (const node of nodes) {
    const visited = new Set();
    let current = node.id;
    while (current) {
      if (visited.has(current)) {
        blockingIssues.push(`cycle detected from: ${node.official_code}`);
        break;
      }
      visited.add(current);
      current = parentById.get(current) ?? null;
    }
  }

  return {
    blockingIssueCount: blockingIssues.length,
    blockingIssues: blockingIssues.slice(0, 300),
  };
}

function auditArabic(nodes) {
  const suspicious = [];
  let arabicScriptCount = 0;
  let englishFallbackCount = 0;

  for (const node of nodes) {
    if (containsArabic(node.name_ar)) arabicScriptCount += 1;
    else englishFallbackCount += 1;

    if (looksMojibake(node.name_ar))
      suspicious.push({ pcode: node.official_code, value: node.name_ar });
    for (const alias of node.search_aliases) {
      if (looksMojibake(alias)) suspicious.push({ pcode: node.official_code, value: alias });
    }
  }

  return {
    arabicScriptCount,
    englishFallbackCount,
    suspiciousCount: suspicious.length,
    suspiciousExamples: suspicious.slice(0, 100),
  };
}

function verifyTargetPaths(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const targets = [
    ["Homs", "Al Houla", "Tal Dahab"],
    ["Homs", "Houla", "Tall Dahab"],
    ["حمص", "الحولة", "تلذهب"],
    ["حمص", "الحولة", "تل ذهب"],
  ];

  return targets.map((segments) => {
    const matches = nodes.filter((node) => nameMatches(node, segments.at(-1)));
    const paths = matches.map((node) => pathFor(byId, node));
    const exactHierarchyMatches = paths.filter((path) =>
      segments.every((segment, index) => (path[index] ? nameMatches(path[index], segment) : false)),
    );
    return {
      target: segments.join(" > "),
      leafMatches: matches.length,
      exactHierarchyMatches: exactHierarchyMatches.map((path) =>
        path.map((node) => `${node.name_ar}${node.name_en ? ` (${node.name_en})` : ""}`),
      ),
    };
  });
}

function pathFor(byId, node) {
  const path = [];
  const visited = new Set();
  let current = node;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.push(current);
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  return path.reverse();
}

function nameMatches(node, value) {
  const target = normalize(value);
  return [node.name_ar, node.name_en, ...node.search_aliases]
    .filter(Boolean)
    .some((candidate) => normalize(candidate) === target);
}

function inferPopulatedPlaceType(classTitle) {
  if (classTitle.includes("city")) return "city";
  if (classTitle.includes("town")) return "town";
  if (classTitle.includes("village")) return "village";
  return "locality";
}

function pickArabic(...values) {
  for (const value of values) {
    const candidate = text(value);
    if (candidate && containsArabic(candidate) && !looksMojibake(candidate)) return candidate;
  }
  return "";
}

function looksMojibake(value) {
  const candidate = text(value);
  if (!candidate) return false;
  return /[╪╫┘┤┐└│├┬┴─]/.test(candidate) || /(?:Ã|Â|Ø|Ù|Ð|Ñ){2,}/.test(candidate);
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

async function readFeatures(filename) {
  const raw = await readFile(resolve(inputDir, filename), "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.features)) {
    throw new Error(`${filename} is missing a GeoJSON features array.`);
  }
  return parsed.features;
}

function props(feature) {
  return feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
}

function countBy(values, keyFn) {
  const result = {};
  for (const value of values) {
    const key = keyFn(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function required(value, field) {
  const result = text(value);
  if (!result) throw new Error(`Missing required field: ${field}`);
  return result;
}

function text(value) {
  return String(value ?? "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))];
}

function slugify(value) {
  const slug = normalize(value).replace(/\s+/g, "-");
  return slug || "location";
}

function stableUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const stringValue = Array.isArray(value) ? `{${value.join(",")}}` : String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function toCsv(nodes) {
  const columns = [
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

  return `${[
    columns.join(","),
    ...nodes.map((node) => columns.map((column) => csvCell(node[column])).join(",")),
  ].join("\n")}\n`;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
