#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const snapshotDir = resolve(
  process.cwd(),
  process.argv[2] || process.env.RAWAJ_SNAPSHOT_DIR || "cloudflare/snapshots/latest",
);
const [manifestText, mediaText, sqlText] = await Promise.all([
  readFile(resolve(snapshotDir, "snapshot-manifest.json"), "utf8"),
  readFile(resolve(snapshotDir, "media-manifest.json"), "utf8"),
  readFile(resolve(snapshotDir, "public-snapshot.sql"), "utf8"),
]);
const manifest = JSON.parse(manifestText);
const media = JSON.parse(mediaText);

assert(manifest.version === 1, "Unsupported snapshot manifest version.");
assert(manifest.destructive === false, "Snapshot must be marked non-destructive.");
assert(manifest.batchId && manifest.batchId === media.batchId, "Batch IDs do not match.");
assert(manifest.sqlSha256 === sha256(sqlText), "Snapshot SQL checksum mismatch.");
assert(Array.isArray(media.entries), "Media manifest entries are missing.");
assert(manifest.mediaCount === media.entries.length, "Media count mismatch.");
assert(!/\b(?:DROP|TRUNCATE|DELETE|ATTACH)\b/i.test(sqlText), "Destructive SQL detected.");
assert(/BEGIN TRANSACTION;/.test(sqlText) && /COMMIT;/.test(sqlText), "Snapshot SQL is not transactional.");

const assetIds = new Set();
const targetKeys = new Set();
for (const entry of media.entries) {
  assert(typeof entry.assetId === "string" && entry.assetId, "Invalid media asset ID.");
  assert(typeof entry.targetKey === "string" && entry.targetKey, "Invalid media target key.");
  assert(!assetIds.has(entry.assetId), `Duplicate media asset ID: ${entry.assetId}`);
  assert(!targetKeys.has(entry.targetKey), `Duplicate media target key: ${entry.targetKey}`);
  assetIds.add(entry.assetId);
  targetKeys.add(entry.targetKey);
}

const directTables = [
  "categories",
  "subcategories",
  "governorates",
  "taxonomy_nodes",
  "option_sets",
  "field_definitions",
  "option_values",
  "vehicle_makes",
  "vehicle_models",
  "vehicle_generations",
  "vehicle_trims",
  "location_regions",
  "location_nodes",
  "location_region_members",
  "location_search_aliases",
  "listing_taxonomy_assignments",
];
for (const table of directTables) {
  const expected = Number(manifest.rowCounts?.[table] ?? 0);
  const actual = countInserts(sqlText, table);
  assert(actual === expected, `${table} row count mismatch: expected ${expected}, got ${actual}`);
}
assert(countInserts(sqlText, "public_profiles") === Number(manifest.rowCounts.public_profiles ?? 0), "public_profiles row count mismatch.");
assert(countInserts(sqlText, "listings") === Number(manifest.rowCounts.listings ?? 0), "listings row count mismatch.");
assert(countInserts(sqlText, "listing_images") === Number(manifest.rowCounts.listing_images ?? 0), "listing_images row count mismatch.");
assert(countInserts(sqlText, "ad_placements") === Number(manifest.rowCounts.ad_placements ?? 0), "ad_placements row count mismatch.");

console.log(JSON.stringify({
  verified: true,
  batchId: manifest.batchId,
  sqlSha256: manifest.sqlSha256,
  tables: Object.keys(manifest.rowCounts).length,
  media: media.entries.length,
}, null, 2));

function countInserts(sql, table) {
  return (sql.match(new RegExp(`INSERT INTO "${escapeRegExp(table)}"`, "g")) ?? []).length;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
