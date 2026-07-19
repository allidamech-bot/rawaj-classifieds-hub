/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDirectory = path.join(root, "supabase", "migrations");
const ledgerPath = path.join(root, "docs", "production-schema", "migration-ledger.json");
const compatibilityPreludePath = path.join(
  root,
  "scripts",
  "sql",
  "clean-replay-compatibility-prelude.sql",
);
const verificationPath = path.join(
  root,
  "scripts",
  "sql",
  "taxonomy-foundation-local-verification.sql",
);
const databaseUrl =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const compatibilityPreludeAfter = "202606290001_auth_roles_foundation.sql";
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
if (!replayFiles.includes(compatibilityPreludeAfter)) {
  throw new Error(`Compatibility prelude anchor is not replayed: ${compatibilityPreludeAfter}`);
}

console.log(`Replaying ${replayFiles.length} migrations against disposable local Supabase.`);
console.log(
  "Excluded ledger classes: superseded, historical, manual, and unknown. They remain recorded but are not part of a clean install.",
);

for (const [index, filename] of replayFiles.entries()) {
  runSqlFile(path.join(migrationsDirectory, filename), {
    label: `Migration ${index + 1}/${replayFiles.length}`,
    filename,
    appName: "rawaj_supabase_local_replay",
  });
  console.log(`PASS ${index + 1}/${replayFiles.length} ${filename}`);

  if (filename === compatibilityPreludeAfter) {
    runSqlFile(compatibilityPreludePath, {
      label: "Clean-replay compatibility prelude",
      filename: path.basename(compatibilityPreludePath),
      appName: "rawaj_supabase_local_compatibility",
    });
    console.log(`PASS compatibility ${path.basename(compatibilityPreludePath)}`);
  }
}

const verification = runSqlFile(verificationPath, {
  label: "Local Supabase foundation verification",
  filename: path.basename(verificationPath),
  appName: "rawaj_supabase_local_verification",
});

if (verification.stdout?.trim()) console.log(verification.stdout.trim());
if (verification.stderr?.trim()) console.log(verification.stderr.trim());
console.log("Supabase local clean replay and foundation verification passed.");

function runSqlFile(filePath, { label, filename, appName }) {
  const result = spawnSync(
    "psql",
    [databaseUrl, "-X", "--set", "ON_ERROR_STOP=1", "--file", filePath],
    {
      ...subprocessOptions,
      env: {
        ...subprocessOptions.env,
        PGAPPNAME: appName,
      },
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\n${label} failed: ${filename}`);
    if (result.stdout?.trim()) console.error(result.stdout.trim());
    if (result.stderr?.trim()) console.error(result.stderr.trim());
    throw new Error(`${label} failed at ${filename} with exit code ${result.status}.`);
  }

  return result;
}
