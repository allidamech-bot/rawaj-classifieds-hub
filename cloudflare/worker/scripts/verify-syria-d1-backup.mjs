#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const identity = Object.freeze({
  database: "rawaj-staging",
  databaseId: "d0e6496c-9f63-48d3-beeb-d2e219500f6a",
  worker: "rawaj-classifieds-hub",
  bucket: "rawaj-listing-images-production",
  firebaseProject: "project-af18fcaf-c46e-4ec5-93a",
});
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const safeTableName = (value) => typeof value === "string" && /^[a-z_][a-z0-9_]*$/i.test(value);
const isFtsObject = (object) =>
  /^CREATE\s+VIRTUAL\s+TABLE\b/i.test(object.sql ?? "") || /^listings_fts(?:_|$)/i.test(object.name);

function requireCondition(condition, message) {
  if (!condition) throw new Error("Syria D1 backup verification failed: " + message);
}

async function readRegularFile(path) {
  const entry = await lstat(path);
  requireCondition(entry.isFile() && !entry.isSymbolicLink(), "backup file must be regular and not a symbolic link");
  return readFile(path);
}

/** No network calls or writes. Validates existing JSON table dumps and their provenance. */
export async function verifySyriaD1Backup(directory, { expectedManifestSha256 } = {}) {
  const root = resolve(directory);
  const info = await lstat(root);
  requireCondition(info.isDirectory() && !info.isSymbolicLink(), "backup directory must be a real directory");
  const manifestBytes = await readRegularFile(resolve(root, "manifest.json"));
  const manifestHash = sha256(manifestBytes);
  if (expectedManifestSha256 !== undefined) {
    requireCondition(/^[a-f0-9]{64}$/i.test(expectedManifestSha256), "invalid expected manifest checksum");
    requireCondition(manifestHash === expectedManifestSha256.toLowerCase(), "manifest checksum mismatch");
  }
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  for (const [key, value] of Object.entries(identity)) {
    requireCondition(manifest?.[key] === value, "wrong Syria resource identity: " + key);
  }
  requireCondition(/^[a-f0-9]{64}$/i.test(manifest.schemaSha256 ?? ""), "missing or invalid schema checksum");
  requireCondition(Array.isArray(manifest.tables) && manifest.tables.length > 0, "missing table manifest");
  requireCondition(Array.isArray(manifest.excludedVirtualTables), "missing virtual-table exclusion manifest");

  const schemaBytes = await readRegularFile(resolve(root, "schema.json"));
  requireCondition(sha256(schemaBytes) === manifest.schemaSha256.toLowerCase(), "schema checksum mismatch");
  const schema = JSON.parse(schemaBytes.toString("utf8"));
  requireCondition(Array.isArray(schema?.objects), "invalid exported schema");
  const schemaTables = schema.objects
    .filter((object) => object.type === "table" && !String(object.name).startsWith("_cf_"));
  const ordinary = schemaTables.filter((object) => !isFtsObject(object)).map((object) => object.name).sort();
  const excluded = schemaTables.filter(isFtsObject).map((object) => object.name).sort();
  requireCondition(ordinary.every(safeTableName), "unsafe ordinary table name in schema");
  const listed = manifest.tables.map((item) => item?.table).sort();
  requireCondition(listed.length === new Set(listed).size, "duplicate table entry");
  requireCondition(JSON.stringify(listed) === JSON.stringify(ordinary), "schema/table manifest mismatch");
  requireCondition(
    JSON.stringify([...manifest.excludedVirtualTables].sort()) === JSON.stringify(excluded),
    "virtual-table exclusions mismatch",
  );

  let totalRows = 0;
  for (const entry of manifest.tables) {
    requireCondition(safeTableName(entry.table), "unsafe table path in manifest");
    requireCondition(Number.isSafeInteger(entry.rowCount) && entry.rowCount >= 0, "invalid row count: " + entry.table);
    requireCondition(/^[a-f0-9]{64}$/i.test(entry.sha256 ?? ""), "invalid checksum: " + entry.table);
    const bytes = await readRegularFile(resolve(root, entry.table + ".json"));
    requireCondition(sha256(bytes) === entry.sha256.toLowerCase(), "table checksum mismatch: " + entry.table);
    const rows = JSON.parse(bytes.toString("utf8"));
    requireCondition(
      Array.isArray(rows) && rows.every((row) => row !== null && typeof row === "object" && !Array.isArray(row)),
      "invalid row representation: " + entry.table,
    );
    requireCondition(rows.length === entry.rowCount, "row count mismatch: " + entry.table);
    totalRows += rows.length;
  }
  return {
    verified: true,
    databaseId: identity.databaseId,
    tables: listed.length,
    totalRows,
    manifestSha256: manifestHash,
    schemaSha256: manifest.schemaSha256.toLowerCase(),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const directory = args.find((item) => item.startsWith("--backup-dir="))?.slice(13);
  const expectedManifestSha256 = args
    .find((item) => item.startsWith("--expected-manifest-sha256="))
    ?.slice(27);
  if (!directory || args.some((arg) =>
    !arg.startsWith("--backup-dir=") && !arg.startsWith("--expected-manifest-sha256="))) {
    throw new Error(
      "Usage: node verify-syria-d1-backup.mjs --backup-dir=/private/backup [--expected-manifest-sha256=<sha256>]",
    );
  }
  console.log(JSON.stringify(await verifySyriaD1Backup(directory, { expectedManifestSha256 }), null, 2));
}
