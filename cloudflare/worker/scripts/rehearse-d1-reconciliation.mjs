#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const workerRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(workerRoot, "../..");
const migrationsDir = resolve(repositoryRoot, "cloudflare/d1/migrations");
const configPath = resolve(workerRoot, "wrangler.generated.jsonc");
const wranglerBin = resolve(workerRoot, "node_modules/wrangler/bin/wrangler.js");
const database = "rawaj-staging";
const protectedDraftIds = [
  "f06e2d10-d6b1-495b-957e-82aa7c3b4f3c",
  "1a6da03a-1cc2-4b64-a14e-182c792f8dfd",
  "9e738966-5f41-481b-8af6-b8358701b331",
  "867e6932-73ff-4a4f-b730-d1ec816a9c2d",
  "98d65b0e-b491-44bf-a286-2726749fc028",
  "339ae87b-77e9-4bba-91f6-1d461b27f7fa",
  "8df376e2-e0e5-415d-af89-6a1660096904",
];
const migrationFiles = await Promise.all(
  Array.from({ length: 16 }, async (_, index) => {
    const sequence = String(index + 1).padStart(4, "0");
    const matches = await findMigration(sequence);
    if (matches.length !== 1) throw new Error(`Expected exactly one migration ${sequence}.`);
    return matches[0];
  }),
);
const reportPath = parseReportPath(process.argv.slice(2));
const rehearsalRoot = await mkdtemp(resolve(tmpdir(), "rawaj-d1-rehearsal-"));
const localDatabases = new Map();

const clean = await rehearseLane("clean", false);
const drift = await rehearseLane("production-drift", true);
assert(clean.schemaFingerprint === drift.schemaFingerprint, "Rehearsal schemas differ.");

const report = {
  generatedAt: new Date().toISOString(),
  database,
  rehearsalRoot,
  migrationChecksums: Object.fromEntries(
    await Promise.all(
      migrationFiles.slice(6).map(async (path) => [
        basename(path),
        sha256(await readFile(path)),
      ]),
    ),
  ),
  canonicalSchemaFingerprint: clean.schemaFingerprint,
  lanes: { clean, productionDrift: drift },
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(
  JSON.stringify(
    {
      report: reportPath,
      rehearsalRoot,
      canonicalSchemaFingerprint: clean.schemaFingerprint,
      clean: summarizeLane(clean),
      productionDrift: summarizeLane(drift),
    },
    null,
    2,
  ),
);

async function rehearseLane(name, withFixtures) {
  const persist = resolve(rehearsalRoot, name);
  for (const migration of migrationFiles.slice(0, 6)) executeFile(persist, migration);
  bootstrapLedgerThrough0006(persist);
  closeDatabase(persist);
  if (withFixtures) {
    executeFile(persist, resolve(workerRoot, "test/marketplace-fixtures.sql"));
    executeFile(persist, resolve(workerRoot, "test/migration-reconciliation-fixtures.sql"));
  }

  const before = await dataEvidence(persist, withFixtures);
  closeDatabase(persist);
  const firstApply = applyPendingMigrations(persist);
  const secondApply = applyPendingMigrations(persist);
  assert(/No migrations to apply/i.test(secondApply), `${name}: repeat apply was not a no-op.`);

  const after = await dataEvidence(persist, withFixtures);
  const schema = inspectSchema(persist);
  const ledger = query(
    persist,
    "SELECT id, name FROM d1_migrations ORDER BY id",
  );
  assert(
    ledger.length === 16 &&
      ledger.every((row, index) => row.id === index + 1 && row.name === basename(migrationFiles[index])),
    `${name}: migration ledger is not canonical through 0016.`,
  );
  const foreignKeyFailures = query(persist, "PRAGMA foreign_key_check");
  assert(foreignKeyFailures.length === 0, `${name}: foreign key check failed.`);

  if (withFixtures) {
    assert(before.messageCount === after.messageCount, `${name}: message count changed.`);
    assert(before.messageHash === after.messageHash, `${name}: message data hash changed.`);
    assert(after.protectedDraftCount === protectedDraftIds.length, `${name}: protected drafts changed.`);
    assert(after.protectedDraftHash === before.protectedDraftHash, `${name}: draft hash changed.`);
    assert(after.firebaseIdentityCount === before.firebaseIdentityCount, `${name}: Firebase identities changed.`);
    assert(after.supabaseIdentityCount === 0, `${name}: legacy provider labels remain.`);
    assert(
      after.legacyImportIdentityCount === before.supabaseIdentityCount,
      `${name}: legacy identity relabel count is unexpected.`,
    );
    assert(after.notificationExtendedDefaults === 5, `${name}: notification defaults are incomplete.`);
    assert(after.listingReportBackfillCount === 1, `${name}: listing report backfill failed.`);
    await verifyConflictPolicies(persist);
    await verifyPromotionTriggers(persist);
  }

  return {
    persist,
    firstApplySummary: firstApply
      .split(/\r?\n/)
      .filter((line) => /migration|applied|success/i.test(line))
      .slice(-30),
    repeatApplyNoOp: true,
    ledger: ledger.map((row) => row.name),
    foreignKeyFailures: foreignKeyFailures.length,
    schemaFingerprint: fingerprint(schema),
    schemaSummary: {
      objects: schema.objects.length,
      columns: schema.columns.length,
      foreignKeys: schema.foreignKeys.length,
      indexes: schema.indexes.length,
      indexColumns: schema.indexColumns.length,
      triggers: schema.objects.filter((row) => row.type === "trigger").length,
    },
    dataEvidence: { before, after },
  };
}

async function dataEvidence(persist, withFixtures) {
  if (!withFixtures) {
    return {
      messageCount: 0,
      messageHash: sha256("[]"),
      protectedDraftCount: 0,
      protectedDraftHash: sha256("[]"),
      firebaseIdentityCount: 0,
      supabaseIdentityCount: 0,
      legacyImportIdentityCount: 0,
      notificationExtendedDefaults: 0,
      listingReportBackfillCount: 0,
    };
  }
  const messages = query(
    persist,
    `SELECT id, conversation_id, sender_id, body, message_type, media_asset_id,
            client_request_id, delivered_at, read_at, deleted_at, created_at
       FROM conversation_messages ORDER BY id`,
  );
  const drafts = query(
    persist,
    `SELECT id, owner_id, status, title, created_at, updated_at
       FROM listings WHERE id IN (${protectedDraftIds.map(() => "?").join(",")})
       ORDER BY id`,
    protectedDraftIds,
  );
  const providers = query(
    persist,
    `SELECT
       SUM(CASE WHEN auth_provider = 'firebase' THEN 1 ELSE 0 END) AS firebase_count,
       SUM(CASE WHEN auth_provider = 'supabase' THEN 1 ELSE 0 END) AS supabase_count,
       SUM(CASE WHEN auth_provider = 'legacy_import' THEN 1 ELSE 0 END) AS legacy_count
     FROM auth_users`,
  )[0];
  const notificationColumns = query(persist, 'PRAGMA table_info("notification_preferences")').map(
    (row) => row.name,
  );
  const hasExtendedNotifications = [
    "price_changes_enabled",
    "saved_search_matches_enabled",
    "listing_status_enabled",
    "reviews_enabled",
    "promotions_enabled",
  ].every((column) => notificationColumns.includes(column));
  const notificationDefaults = hasExtendedNotifications
    ? query(
        persist,
        `SELECT price_changes_enabled + saved_search_matches_enabled + listing_status_enabled +
                reviews_enabled + promotions_enabled AS enabled_count
           FROM notification_preferences WHERE user_id = 'rehearsal-buyer'`,
      )[0]?.enabled_count ?? 0
    : 0;
  const reportColumns = query(persist, 'PRAGMA table_info("listing_reports")').map(
    (row) => row.name,
  );
  const listingReportBackfillCount = reportColumns.includes("updated_at")
    ? query(
        persist,
        `SELECT COUNT(*) AS count FROM listing_reports
          WHERE id = 'rehearsal-listing-report' AND updated_at = created_at`,
      )[0]?.count ?? 0
    : 0;
  return {
    messageCount: messages.length,
    messageHash: sha256(stableJson(messages)),
    protectedDraftCount: drafts.length,
    protectedDraftHash: sha256(stableJson(drafts)),
    firebaseIdentityCount: Number(providers?.firebase_count ?? 0),
    supabaseIdentityCount: Number(providers?.supabase_count ?? 0),
    legacyImportIdentityCount: Number(providers?.legacy_count ?? 0),
    notificationExtendedDefaults: Number(notificationDefaults),
    listingReportBackfillCount: Number(listingReportBackfillCount),
  };
}

async function verifyConflictPolicies(persist) {
  execute(
    persist,
    `UPDATE taxonomy_versions
        SET change_summary = 'Operator preserved value'
      WHERE id = 'cloudflare-catalog-v1';
     UPDATE system_controls
        SET enabled = 1, reason = 'Operator preserved value', version = 2
      WHERE key = 'maintenance_mode';`,
  );
  const taxonomySql = await readFile(migrationFiles[13], "utf8");
  const controlsSql = await readFile(migrationFiles[15], "utf8");
  execute(persist, extractInsert(taxonomySql, "taxonomy_versions"));
  execute(persist, extractInsert(controlsSql, "system_controls"));
  const taxonomy = query(
    persist,
    "SELECT change_summary FROM taxonomy_versions WHERE id = 'cloudflare-catalog-v1'",
  )[0];
  const control = query(
    persist,
    "SELECT enabled, reason, version FROM system_controls WHERE key = 'maintenance_mode'",
  )[0];
  assert(
    taxonomy?.change_summary === "Operator preserved value",
    "0014 conflict policy overwrote taxonomy data.",
  );
  assert(
    control?.enabled === 1 &&
      control?.reason === "Operator preserved value" &&
      control?.version === 2,
    "0016 conflict policy overwrote operator controls.",
  );
}

async function verifyPromotionTriggers(persist) {
  execute(
    persist,
    `INSERT INTO listing_promotion_requests
      (id, listing_id, requester_user_id, client_request_id, promotion_type, status,
       requested_days, starts_at, ends_at, created_at, updated_at)
     VALUES
      ('rehearsal-invalid-promotion', '${protectedDraftIds[0]}', 'rehearsal-seller',
       'rehearsal-invalid-promotion', 'featured_home', 'pending_review', 7,
       '2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z',
       '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  );
  const invalid = executeRaw(
    persist,
    `UPDATE listing_promotion_requests SET status = 'approved'
      WHERE id = 'rehearsal-invalid-promotion'`,
    true,
  );
  assert(invalid.status !== 0, "0013 allowed promotion of a non-public listing.");

  execute(
    persist,
    `INSERT INTO listing_promotion_requests
      (id, listing_id, requester_user_id, client_request_id, promotion_type, status,
       requested_days, starts_at, ends_at, created_at, updated_at)
     VALUES
      ('rehearsal-valid-promotion', 'test-public-listing', 'test-public-seller',
       'rehearsal-valid-promotion', 'featured_home', 'pending_review', 7,
       '2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z',
       '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
     UPDATE listing_promotion_requests SET status = 'approved'
      WHERE id = 'rehearsal-valid-promotion';`,
  );
  const listing = query(
    persist,
    "SELECT is_featured, featured_until FROM listings WHERE id = 'test-public-listing'",
  )[0];
  assert(
    listing?.is_featured === 1 && listing?.featured_until === "2026-01-08T00:00:00.000Z",
    "0013 did not apply an approved valid promotion.",
  );
}

function inspectSchema(persist) {
  const objects = query(
    persist,
    `SELECT type, name, tbl_name, sql FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
      ORDER BY type, name`,
  );
  const tables = objects
    .filter((row) => row.type === "table" && safeIdentifier(row.name))
    .map((row) => row.name);
  const columns = [];
  const foreignKeys = [];
  const indexes = [];
  const indexColumns = [];
  for (const table of tables) {
    for (const row of query(persist, `PRAGMA table_xinfo("${table}")`)) {
      columns.push({ table, ...row });
    }
    for (const row of query(persist, `PRAGMA foreign_key_list("${table}")`)) {
      foreignKeys.push({ table, ...row });
    }
    for (const row of query(persist, `PRAGMA index_list("${table}")`)) {
      indexes.push({ table, ...row });
    }
  }
  for (const index of indexes.filter((row) => safeIdentifier(row.name))) {
    for (const row of query(persist, `PRAGMA index_xinfo("${index.name}")`)) {
      indexColumns.push({ table: index.table, index: index.name, ...row });
    }
  }
  return { objects, columns, foreignKeys, indexes, indexColumns };
}

function bootstrapLedgerThrough0006(persist) {
  const values = migrationFiles
    .slice(0, 6)
    .map((path, index) => `(${index + 1}, '${basename(path)}', CURRENT_TIMESTAMP)`)
    .join(",");
  execute(
    persist,
    `CREATE TABLE IF NOT EXISTS d1_migrations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT UNIQUE,
       applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
     );
     INSERT INTO d1_migrations (id, name, applied_at) VALUES ${values};`,
  );
}

function applyPendingMigrations(persist) {
  return run([
    "d1",
    "migrations",
    "apply",
    database,
    "--local",
    "--persist-to",
    persist,
    "--config",
    configPath,
  ]).stdout;
}

function executeFile(persist, path) {
  run([
    "d1",
    "execute",
    database,
    "--local",
    "--persist-to",
    persist,
    "--config",
    configPath,
    "--file",
    path,
  ]);
}

function execute(persist, sql) {
  databaseFor(persist).exec(sql);
}

function executeRaw(persist, sql, allowFailure) {
  try {
    databaseFor(persist).exec(sql);
    return { status: 0, stdout: "", stderr: "" };
  } catch (error) {
    if (!allowFailure) throw error;
    return { status: 1, stdout: "", stderr: String(error) };
  }
}

function query(persist, sql, bindings = []) {
  return databaseFor(persist).prepare(sql).all(...bindings);
}

function run(args, allowFailure = false) {
  const result = spawnSync(process.execPath, [wranglerBin, ...args], {
    cwd: workerRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(sanitize(result.stderr || result.stdout || result.error?.message));
  }
  return result;
}

async function findMigration(sequence) {
  return (await readdir(migrationsDir))
    .filter((name) => name.startsWith(`${sequence}_`) && name.endsWith(".sql"))
    .map((name) => resolve(migrationsDir, name));
}

function databaseFor(persist) {
  const existing = localDatabases.get(persist);
  if (existing) return existing;
  const path = findLocalDatabaseFile(persist);
  const databaseHandle = new DatabaseSync(path);
  databaseHandle.exec("PRAGMA foreign_keys = ON");
  localDatabases.set(persist, databaseHandle);
  return databaseHandle;
}

function closeDatabase(persist) {
  const databaseHandle = localDatabases.get(persist);
  if (!databaseHandle) return;
  databaseHandle.close();
  localDatabases.delete(persist);
}

function findLocalDatabaseFile(root) {
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = requireDirectoryEntries(directory);
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && path.endsWith(".sqlite")) return path;
    }
  }
  throw new Error(`Could not locate the local D1 SQLite file under ${root}.`);
}

function requireDirectoryEntries(path) {
  return readdirSync(path, { withFileTypes: true });
}

function extractInsert(sql, table) {
  const match = sql.match(new RegExp(`INSERT OR IGNORE INTO ${table}[\\s\\S]*?;`, "i"));
  if (!match) throw new Error(`Could not find repeat-safe insert for ${table}.`);
  return match[0];
}

function fingerprint(value) {
  return sha256(stableJson(value));
}

function stableJson(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(sortObject));
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObject(nested)]),
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeIdentifier(value) {
  return /^[a-z_][a-z0-9_]*$/i.test(value);
}

function sanitize(value) {
  return String(value ?? "")
    .replace(/(token|authorization|password|secret)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 4000);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseReportPath(args) {
  const value = args.find((arg) => arg.startsWith("--report="))?.slice(9);
  if (!value) throw new Error("--report=<outside-repository-path> is required.");
  return resolve(value);
}

function summarizeLane(lane) {
  return {
    ledgerCount: lane.ledger.length,
    foreignKeyFailures: lane.foreignKeyFailures,
    repeatApplyNoOp: lane.repeatApplyNoOp,
    schemaFingerprint: lane.schemaFingerprint,
    schemaSummary: lane.schemaSummary,
    messageCountPreserved:
      lane.dataEvidence.before.messageCount === lane.dataEvidence.after.messageCount,
    messageHashPreserved:
      lane.dataEvidence.before.messageHash === lane.dataEvidence.after.messageHash,
    protectedDraftsPreserved:
      lane.dataEvidence.before.protectedDraftHash === lane.dataEvidence.after.protectedDraftHash,
  };
}
