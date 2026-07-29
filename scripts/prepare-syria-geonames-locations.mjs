#!/usr/bin/env node

/**
 * Prepare a RAWAJ Syria location taxonomy import from the GeoNames SY country dump.
 *
 * Source input: extracted SY.txt from https://download.geonames.org/export/dump/SY.zip
 * GeoNames dump documentation/license: https://download.geonames.org/export/dump/readme.txt
 * License: Creative Commons Attribution 4.0.
 *
 * This script does not write to the retired backend. It produces deterministic JSON + CSV for review/import.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(args.input ?? "data/geonames/SY.txt");
const outputJson = resolve(args.json ?? "data/locations/syria-geonames-location-nodes.json");
const outputCsv = resolve(args.csv ?? "data/locations/syria-geonames-location-nodes.csv");
const reportPath = resolve(args.report ?? "data/locations/syria-geonames-location-report.json");
const dryRun = Boolean(args["dry-run"]);

const raw = await readFile(inputPath, "utf8");
const rows = raw.split(/\r?\n/).filter(Boolean).map(parseGeoNamesLine);
const byId = new Map(rows.map((row) => [row.geonameid, row]));

const adminRows = rows.filter((row) => /^ADM[1-4]$/.test(row.featureCode));
const populatedRows = rows.filter(
  (row) => row.featureClass === "P" && !["PPLH", "PPLQ"].includes(row.featureCode),
);

const nodes = [];
const externalIdToStableId = new Map();

for (const row of adminRows) {
  const node = toAdminNode(row, byId);
  externalIdToStableId.set(row.geonameid, node.id);
  nodes.push(node);
}

for (const row of populatedRows) {
  const node = toPlaceNode(row, adminRows);
  externalIdToStableId.set(row.geonameid, node.id);
  nodes.push(node);
}

for (const node of nodes) {
  if (node.parent_external_id) {
    node.parent_id = externalIdToStableId.get(node.parent_external_id) ?? null;
  }
  delete node.parent_external_id;
}

nodes.sort(
  (a, b) =>
    a.depth - b.depth || a.sort_order - b.sort_order || a.name_ar.localeCompare(b.name_ar, "ar"),
);

const duplicateKeys = findDuplicates(nodes, (node) => `${node.parent_id ?? "root"}|${node.slug}`);
const orphanNodes = nodes.filter(
  (node) => node.parent_id && !nodes.some((candidate) => candidate.id === node.parent_id),
);
const arabicCoverage = nodes.filter((node) => containsArabic(node.name_ar)).length;

const report = {
  source: "GeoNames SY country dump",
  sourceUrl: "https://download.geonames.org/export/dump/SY.zip",
  documentationUrl: "https://download.geonames.org/export/dump/readme.txt",
  license: "CC BY 4.0",
  generatedAt: new Date().toISOString(),
  counts: {
    sourceRows: rows.length,
    administrativeNodes: adminRows.length,
    populatedPlaces: populatedRows.length,
    outputNodes: nodes.length,
    arabicNameCoverage: arabicCoverage,
    orphanNodes: orphanNodes.length,
    duplicateParentSlugs: duplicateKeys.length,
  },
  caveats: [
    "GeoNames is community-maintained and does not guarantee completeness, accuracy, or timeliness.",
    "Arabic display names are selected from Arabic-script aliases when available; otherwise the source name is retained.",
    "Populated-place parentage is derived from GeoNames admin1-admin4 codes and therefore depends on source coding quality.",
    "Urban neighborhood coverage is not guaranteed and should be supplemented only from a separately documented source.",
  ],
  duplicateParentSlugs: duplicateKeys.slice(0, 100),
  orphanExternalIds: orphanNodes.map((node) => node.external_id).slice(0, 100),
};

if (dryRun) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(duplicateKeys.length || orphanNodes.length ? 1 : 0);
}

await mkdir(dirname(outputJson), { recursive: true });
await writeFile(outputJson, `${JSON.stringify(nodes, null, 2)}\n`, "utf8");
await writeFile(outputCsv, toCsv(nodes), "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

function parseGeoNamesLine(line) {
  const parts = line.split("\t");
  return {
    geonameid: parts[0],
    name: parts[1] ?? "",
    asciiName: parts[2] ?? "",
    alternateNames: (parts[3] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    latitude: numberOrNull(parts[4]),
    longitude: numberOrNull(parts[5]),
    featureClass: parts[6] ?? "",
    featureCode: parts[7] ?? "",
    countryCode: parts[8] ?? "",
    admin1: parts[10] ?? "",
    admin2: parts[11] ?? "",
    admin3: parts[12] ?? "",
    admin4: parts[13] ?? "",
    population: Number(parts[14] || 0),
  };
}

function toAdminNode(row, allRowsById) {
  const depth = Number(row.featureCode.slice(3));
  const parent = findAdminParent(row, depth, allRowsById);
  return baseNode(row, {
    nodeType: depth === 1 ? "governorate" : depth === 2 ? "district" : "subdistrict",
    depth,
    parentExternalId: parent?.geonameid ?? null,
  });
}

function toPlaceNode(row, adminRows) {
  const parent = findDeepestAdmin(row, adminRows);
  const placeType = inferPlaceType(row);
  return baseNode(row, {
    nodeType: placeType,
    depth: parent ? Number(parent.featureCode.slice(3)) + 1 : 1,
    parentExternalId: parent?.geonameid ?? null,
  });
}

function baseNode(row, { nodeType, depth, parentExternalId }) {
  const arabicAliases = row.alternateNames.filter(containsArabic);
  const nameAr = arabicAliases[0] || (containsArabic(row.name) ? row.name : row.name);
  const aliases = unique([row.name, row.asciiName, ...row.alternateNames]).filter(
    (value) => value && value !== nameAr,
  );
  return {
    id: stableUuid(`geonames:${row.geonameid}`),
    parent_id: null,
    parent_external_id: parentExternalId,
    country_code: "SY",
    node_type: nodeType,
    name_ar: nameAr,
    name_en: containsArabic(row.name) ? row.asciiName || null : row.name || null,
    slug: slugify(row.asciiName || row.name || row.geonameid),
    official_code: adminCode(row) || null,
    external_source: "geonames",
    external_id: row.geonameid,
    latitude: row.latitude,
    longitude: row.longitude,
    sort_order: row.population > 0 ? -Math.min(row.population, 2_000_000_000) : 0,
    depth,
    is_active: true,
    search_aliases: aliases,
    legacy_governorate_id: null,
    legacy_district_ar: null,
  };
}

function findAdminParent(row, depth, byId) {
  if (depth <= 1) return null;
  const targetCode = depth === 2 ? row.admin1 : depth === 3 ? row.admin2 : row.admin3;
  if (!targetCode) return null;
  for (const candidate of byId.values()) {
    if (candidate.featureCode !== `ADM${depth - 1}`) continue;
    if (!sameAdminPrefix(row, candidate, depth - 1)) continue;
    return candidate;
  }
  return null;
}

function findDeepestAdmin(row, adminRows) {
  for (let depth = 4; depth >= 1; depth -= 1) {
    const match = adminRows.find(
      (candidate) =>
        candidate.featureCode === `ADM${depth}` && sameAdminPrefix(row, candidate, depth),
    );
    if (match) return match;
  }
  return null;
}

function sameAdminPrefix(a, b, depth) {
  const keys = ["admin1", "admin2", "admin3", "admin4"];
  return keys.slice(0, depth).every((key) => a[key] && a[key] === b[key]);
}

function inferPlaceType(row) {
  if (["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"].includes(row.featureCode)) return "city";
  if (row.population >= 20_000) return "city";
  if (row.population >= 5_000) return "town";
  return "village";
}

function adminCode(row) {
  return [row.admin1, row.admin2, row.admin3, row.admin4].filter(Boolean).join(".");
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(value ?? "");
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || "location";
}

function stableUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findDuplicates(values, keyFn) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
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
  const lines = [columns.join(",")];
  for (const node of nodes) {
    lines.push(
      columns
        .map((column) =>
          csvCell(column === "search_aliases" ? `{${node[column].join(",")}}` : node[column]),
        )
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
