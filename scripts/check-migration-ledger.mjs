import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const ledgerPath = path.join(root, "docs", "production-schema", "migration-ledger.json");
const versionPattern = /^(\d{12,14})_(.+)\.sql$/;

function fail(messages) {
  for (const message of messages) console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
console.log(`MIGRATION_INVENTORY_JSON=${JSON.stringify(files)}`);

const malformed = files.filter((file) => !versionPattern.test(file));
const parsed = files.map((file) => {
  const match = file.match(versionPattern);
  return match ? { filename: file, version: match[1] } : null;
}).filter(Boolean);

const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const entries = Array.isArray(ledger.migrations) ? ledger.migrations : [];
const defaults = ledger.defaults ?? {};
const documentedCollisions = ledger.documentedCollisions ?? {};
const errors = [];

if (malformed.length) errors.push(`Migration filenames must match <12-14 digit version>_<name>.sql: ${malformed.join(", ")}`);

const repositoryFiles = new Set(files);
const ledgerFiles = new Set();
for (const entry of entries) {
  if (!entry || typeof entry.filename !== "string") {
    errors.push("Every ledger migration entry must contain a filename.");
    continue;
  }
  if (ledgerFiles.has(entry.filename)) errors.push(`Duplicate ledger entry: ${entry.filename}`);
  ledgerFiles.add(entry.filename);
  if (!repositoryFiles.has(entry.filename)) errors.push(`Ledger references a missing migration: ${entry.filename}`);
  for (const field of ["classification", "productionState", "replaySafety"]) {
    if (!(entry[field] ?? defaults[field])) errors.push(`${entry.filename} is missing effective ${field}.`);
  }
}

for (const file of files) if (!ledgerFiles.has(file)) errors.push(`Migration is not registered in the canonical ledger: ${file}`);

const byVersion = new Map();
for (const migration of parsed) {
  const group = byVersion.get(migration.version) ?? [];
  group.push(migration.filename);
  byVersion.set(migration.version, group);
}

for (const [version, collisionFiles] of byVersion) {
  if (collisionFiles.length < 2) continue;
  const documented = documentedCollisions[version];
  if (!Array.isArray(documented)) {
    errors.push(`Duplicate migration version ${version}: ${collisionFiles.join(", ")}. Add an exact documentedCollisions entry; do not rename historical files blindly.`);
    continue;
  }
  const actual = [...collisionFiles].sort();
  const expected = [...documented].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`Collision documentation mismatch for ${version}. Actual: ${actual.join(", ")}; documented: ${expected.join(", ")}`);
}

for (const [version, documented] of Object.entries(documentedCollisions)) {
  const actual = [...(byVersion.get(version) ?? [])].sort();
  const expected = Array.isArray(documented) ? [...documented].sort() : [];
  if (actual.length < 2) errors.push(`documentedCollisions.${version} is stale; the repository no longer has a collision.`);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`documentedCollisions.${version} does not exactly match repository files.`);
}

if (errors.length) fail(errors);
else console.log(`Migration ledger and version collision checks passed (${files.length} files).`);
