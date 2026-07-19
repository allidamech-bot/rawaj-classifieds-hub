/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDirectory = path.join(root, "supabase", "migrations");
const ledgerPath = path.join(root, "docs", "production-schema", "migration-ledger.json");
const verificationPath = path.join(
  root,
  "scripts",
  "sql",
  "taxonomy-foundation-local-verification.sql",
);
const databaseUrl =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const subprocessOptions = {
  cwd: root,
  env: {
    ...process.env,
    PGOPTIONS: "--client-min-messages=warning",
  },
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
};

const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const classifications = ledger.classifications ?? {};
const replayClassifications = ["canonical", "reconciliation"];
const selectedFiles = new Set(
  replayClassifications.flatMap((classification) => {
    const files = classifications[classification];
    if (!Array.isArray(files)) {
      throw new Error(`Missing migration ledger classification: ${classification}`);
    }
    return files;
  }),
);

const repositoryMigrationFiles = new Set(
  (await readdir(migrationsDirectory)).filter((filename) => filename.endsWith(".sql")),
);
const missingFiles = [...selectedFiles].filter((filename) => !repositoryMigrationFiles.has(filename));
if (missingFiles.length > 0) {
  throw new Error(`Replay ledger references missing migrations: ${missingFiles.join(", ")}`);
}

const replayFiles = [...selectedFiles].sort((left, right) => left.localeCompare(right, "en"));
if (replayFiles.length === 0) {
  throw new Error("No canonical or reconciliation migrations were selected for replay.");
}

console.log(`Replaying ${replayFiles.length} migrations against disposable local Supabase.`);
console.log(
  "Excluded ledger classes: superseded, historical, manual, and unknown. They remain recorded but are not part of a clean install.",
);

for (const [index, filename] of replayFiles.entries()) {
  const migrationPath = path.join(migrationsDirectory, filename);
  const result = spawnSync(
    "psql",
    [databaseUrl, "-X", "--set", "ON_ERROR_STOP=1", "--file", migrationPath],
    {
      ...subprocessOptions,
      env: {
        ...subprocessOptions.env,
        PGAPPNAME: "rawaj_supabase_local_replay",
      },
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\nMigration ${index + 1}/${replayFiles.length} failed: ${filename}`);
    if (result.stdout?.trim()) console.error(result.stdout.trim());
    if (result.stderr?.trim()) console.error(result.stderr.trim());
    throw new Error(`Migration replay failed at ${filename} with exit code ${result.status}.`);
  }

  console.log(`PASS ${index + 1}/${replayFiles.length} ${filename}`);
}

const verification = spawnSync(
  "psql",
  [databaseUrl, "-X", "--set", "ON_ERROR_STOP=1", "--file", verificationPath],
  {
    ...subprocessOptions,
    env: {
      ...subprocessOptions.env,
      PGAPPNAME: "rawaj_supabase_local_verification",
    },
  },
);

if (verification.error) throw verification.error;
if (verification.status !== 0) {
  console.error("\nLocal Supabase foundation verification failed.");
  if (verification.stdout?.trim()) console.error(verification.stdout.trim());
  if (verification.stderr?.trim()) console.error(verification.stderr.trim());
  throw new Error(`Local Supabase verification failed with exit code ${verification.status}.`);
}

if (verification.stdout?.trim()) console.log(verification.stdout.trim());
if (verification.stderr?.trim()) console.log(verification.stderr.trim());
console.log("Supabase local clean replay and foundation verification passed.");
