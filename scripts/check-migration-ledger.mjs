/* eslint-disable no-console */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDir = path.join(root, "cloudflare", "d1", "migrations");
const filenamePattern = /^(\d{4})_([a-z0-9][a-z0-9_-]*)\.sql$/;

const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

const errors = [];
const parsed = [];

for (const file of files) {
  const match = file.match(filenamePattern);
  if (!match) {
    errors.push(`Invalid D1 migration filename: ${file}`);
    continue;
  }

  const sequence = Number(match[1]);
  const content = await readFile(path.join(migrationsDir, file), "utf8");
  if (!content.trim()) errors.push(`Empty D1 migration: ${file}`);
  parsed.push({ file, sequence });
}

const seen = new Map();
for (const migration of parsed) {
  const existing = seen.get(migration.sequence);
  if (existing) {
    errors.push(
      `Duplicate D1 migration sequence ${String(migration.sequence).padStart(4, "0")}: ${existing}, ${migration.file}`,
    );
  } else {
    seen.set(migration.sequence, migration.file);
  }
}

const orderedSequences = [...seen.keys()].sort((left, right) => left - right);
if (orderedSequences.length === 0) {
  errors.push("No D1 migrations were found.");
} else {
  const first = orderedSequences[0];
  const last = orderedSequences.at(-1);
  if (first !== 1) errors.push(`D1 migration sequence must start at 0001, found ${first}.`);
  for (let expected = first; expected <= last; expected += 1) {
    if (!seen.has(expected)) {
      errors.push(`Missing D1 migration sequence ${String(expected).padStart(4, "0")}.`);
    }
  }
}

console.log(`D1_MIGRATION_INVENTORY_JSON=${JSON.stringify(files)}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `D1 migration ledger check passed (${files.length} migrations, continuous 0001-${String(orderedSequences.at(-1)).padStart(4, "0")}).`,
);
