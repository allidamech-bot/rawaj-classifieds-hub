#!/usr/bin/env node

/**
 * Prepare RAWAJ Syria location nodes from a reviewed P-code CSV export.
 *
 * Intended primary sources:
 * - OCHA/HDX COD-AB Syria for formal administrative hierarchy
 * - Syria Humanitarian Atlas locality export where licensed/downloaded and reviewed
 *
 * This script never writes to the retired backend. It validates and emits review artifacts only.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ALLOWED_TYPES = new Set([
  "country",
  "governorate",
  "district",
  "subdistrict",
  "city",
  "town",
  "village",
  "neighborhood",
  "locality",
]);

const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(args.input ?? "data/locations/syria-pcodes-source.csv");
const outputJson = resolve(args.json ?? "data/locations/syria-pcode-location-nodes.json");
const outputCsv = resolve(args.csv ?? "data/locations/syria-pcode-location-nodes.csv");
const reportPath = resolve(args.report ?? "data/locations/syria-pcode-location-report.json");
const sourceName = String(args.source ?? "reviewed-syria-pcode-source");
const sourceDate = String(args["source-date"] ?? "");
const dryRun = Boolean(args["dry-run"]);

const rows = parseCsv(await readFile(inputPath, "utf8"));
const required = ["pcode", "name_ar", "type"];
for (const field of required) {
  if (!rows.every((row) => field in row)) {
    throw new Error(`Missing required CSV column: ${field}`);
  }
}

const byPcode = new Map();
const duplicatePcodes = new Set();
for (const row of rows) {
  const pcode = clean(row.pcode);
  if (!pcode) continue;
  if (byPcode.has(pcode)) duplicatePcodes.add(pcode);
  byPcode.set(pcode, row);
}

const nodes = rows.map((row) => toNode(row, sourceName, sourceDate)).filter(Boolean);

const idByPcode = new Map(nodes.map((node) => [node.official_code, node.id]));
for (const node of nodes) {
  node.parent_id = node.parent_official_code
    ? (idByPcode.get(node.parent_official_code) ?? null)
    : null;
  delete node.parent_official_code;
}

const orphans = nodes.filter((node) => {
  const sourceRow = byPcode.get(node.official_code);
  return clean(sourceRow?.parent_pcode) && !node.parent_id;
});
const duplicateParentSlugs = duplicateKeys(
  nodes,
  (node) => `${node.parent_id ?? "root"}|${node.slug}`,
);
const invalidTypes = nodes.filter((node) => !ALLOWED_TYPES.has(node.node_type));

const report = {
  source: sourceName,
  sourceDate: sourceDate || null,
  generatedAt: new Date().toISOString(),
  counts: {
    sourceRows: rows.length,
    outputNodes: nodes.length,
    duplicatePcodes: duplicatePcodes.size,
    orphanParents: orphans.length,
    duplicateParentSlugs: duplicateParentSlugs.length,
    invalidTypes: invalidTypes.length,
  },
  blockingIssues: {
    duplicatePcodes: [...duplicatePcodes].slice(0, 100),
    orphanPcodes: orphans.map((node) => node.official_code).slice(0, 100),
    duplicateParentSlugs: duplicateParentSlugs.slice(0, 100),
    invalidTypePcodes: invalidTypes.map((node) => node.official_code).slice(0, 100),
  },
};

const hasBlockingIssues =
  duplicatePcodes.size > 0 ||
  orphans.length > 0 ||
  duplicateParentSlugs.length > 0 ||
  invalidTypes.length > 0;

if (dryRun) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(hasBlockingIssues ? 1 : 0);
}

await mkdir(dirname(outputJson), { recursive: true });
await writeFile(outputJson, `${JSON.stringify(nodes, null, 2)}\n`, "utf8");
await writeFile(outputCsv, toCsv(nodes), "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (hasBlockingIssues) process.exitCode = 1;

function toNode(row, externalSource, date) {
  const pcode = clean(row.pcode);
  const nameAr = clean(row.name_ar);
  if (!pcode || !nameAr) return null;

  const type = normalizeType(clean(row.type));
  return {
    id: stableUuid(`${externalSource}:${pcode}`),
    parent_id: null,
    parent_official_code: clean(row.parent_pcode) || null,
    country_code: clean(row.country_code) || "SY",
    node_type: type,
    name_ar: nameAr,
    name_en: clean(row.name_en) || null,
    slug: clean(row.slug) || slugify(clean(row.name_en) || nameAr || pcode),
    official_code: pcode,
    external_source: externalSource,
    external_id: pcode,
    latitude: numberOrNull(row.latitude ?? row.lat),
    longitude: numberOrNull(row.longitude ?? row.lng),
    sort_order: integerOrZero(row.sort_order),
    depth: depthForType(type),
    is_active: truthy(row.is_active, true),
    search_aliases: splitAliases(row.aliases_ar, row.aliases_en),
    legacy_governorate_id: clean(row.legacy_governorate_id) || null,
    legacy_district_ar: clean(row.legacy_district_ar) || null,
    source_date: date || clean(row.source_date) || null,
  };
}

function normalizeType(value) {
  const key = value.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const map = {
    admin0: "country",
    adm0: "country",
    admin1: "governorate",
    adm1: "governorate",
    admin2: "district",
    adm2: "district",
    admin3: "subdistrict",
    adm3: "subdistrict",
    admin4: "locality",
    adm4: "locality",
    community: "locality",
    populated_place: "locality",
  };
  return map[key] ?? key;
}

function depthForType(type) {
  return { country: 0, governorate: 1, district: 2, subdistrict: 3 }[type] ?? 4;
}

function splitAliases(...values) {
  return [
    ...new Set(
      values
        .flatMap((value) => String(value ?? "").split(/[|;]/))
        .map(clean)
        .filter(Boolean),
    ),
  ];
}

function clean(value) {
  return String(value ?? "").trim();
}

function truthy(value, fallback) {
  const text = clean(value).toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "y"].includes(text);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrZero(value) {
  const number = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(number) ? number : 0;
}

function slugify(value) {
  const slug = String(value)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || "location";
}

function stableUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function duplicateKeys(values, keyFn) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
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

function parseCsv(text) {
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    records.push(row);
  }

  const [header = [], ...body] = records.filter((record) => record.some((value) => value !== ""));
  return body.map((record) =>
    Object.fromEntries(header.map((name, index) => [clean(name), record[index] ?? ""])),
  );
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? `{${value.join(",")}}` : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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
  ];
  return `${[
    columns.join(","),
    ...nodes.map((node) => columns.map((column) => csvCell(node[column])).join(",")),
  ].join("\n")}\n`;
}
