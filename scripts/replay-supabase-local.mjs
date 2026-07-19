import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDirectory = path.join(root, "supabase", "migrations");
const ledgerPath = path.join(root, "docs", "production-schema", "migration-ledger.json");
const verificationPaths = [
  "taxonomy-foundation-local-verification.sql",
  "listing-attribute-write-local-verification.sql",
  "owner-listing-attribute-read-local-verification.sql",
  "taxonomy-metadata-api-local-verification.sql",
  "taxonomy-mapping-review-apply-local-verification.sql",
  "vehicle-reference-review-apply-local-verification.sql",
  "dynamic-listing-submit-guard-local-verification.sql",
  "listing-data-quality-workspace-local-verification.sql",
  "listing-data-quality-context-local-verification.sql",
].map((filename) => ({
  filename,
  filePath: path.join(root, "scripts", "sql", filename),
}));
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

const compatibilityHooks = [
  {
    timing: "after",
    anchor: "202606290001_auth_roles_foundation.sql",
    filename: "clean-replay-compatibility-prelude.sql",
  },
  {
    timing: "before",
    anchor: "202607070006_location_search_regions.sql",
    filename: "clean-replay-before-202607070006-location-policies.sql",
  },
  {
    timing: "before",
    anchor: "202607080019_listing_moderation_console.sql",
    filename: "clean-replay-before-202607080019-listing-status.sql",
  },
  {
    timing: "before",
    anchor: "202607080024_safety_case_assignment_escalation.sql",
    filename: "clean-replay-before-202607080024-safety-list-cases.sql",
  },
  {
    timing: "before",
    anchor: "202607080037_remove_legacy_listing_write_trigger.sql",
    filename: "clean-replay-before-202607080037-legacy-listing-guard.sql",
  },
  {
    timing: "before",
    anchor: "202607080038_listing_submit_edit_rpc_repair.sql",
    filename: "clean-replay-before-202607080038-submit-rpc.sql",
  },
].map((hook) => ({
  ...hook,
  filePath: path.join(root, "scripts", "sql", hook.filename),
}));

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
const missingFiles = [...selectedFiles].filter(
  (filename) => !repositoryMigrationFiles.has(filename),
);
if (missingFiles.length > 0) {
  throw new Error(`Replay ledger references missing migrations: ${missingFiles.join(", ")}`);
}

const replayFiles = [...selectedFiles].sort((left, right) => left.localeCompare(right, "en"));
if (replayFiles.length === 0) {
  throw new Error("No canonical or reconciliation migrations were selected for replay.");
}

for (const hook of compatibilityHooks) {
  if (!replayFiles.includes(hook.anchor)) {
    throw new Error(`Compatibility hook anchor is not replayed: ${hook.anchor}`);
  }
}

console.log(`Replaying ${replayFiles.length} migrations against disposable local Supabase.`);
console.log(
  "Excluded ledger classes: superseded, historical, manual, and unknown. They remain recorded but are not part of a clean install.",
);

for (const [index, filename] of replayFiles.entries()) {
  runCompatibilityHooks("before", filename);

  runSqlFile(path.join(migrationsDirectory, filename), {
    label: `Migration ${index + 1}/${replayFiles.length}`,
    filename,
    appName: "rawaj_supabase_local_replay",
  });
  console.log(`PASS ${index + 1}/${replayFiles.length} ${filename}`);

  runCompatibilityHooks("after", filename);
}

for (const verification of verificationPaths) {
  const result = runSqlFile(verification.filePath, {
    label: `Local Supabase verification ${verification.filename}`,
    filename: verification.filename,
    appName: "rawaj_supabase_local_verification",
  });

  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.log(result.stderr.trim());
  console.log(`PASS verification ${verification.filename}`);
}

console.log("Supabase local clean replay and all foundation verifications passed.");

function runCompatibilityHooks(timing, anchor) {
  for (const hook of compatibilityHooks) {
    if (hook.timing !== timing || hook.anchor !== anchor) continue;

    runSqlFile(hook.filePath, {
      label: `Clean-replay ${timing} hook for ${anchor}`,
      filename: hook.filename,
      appName: "rawaj_supabase_local_compatibility",
    });
    console.log(`PASS compatibility ${timing} ${anchor} ${hook.filename}`);
  }
}

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
