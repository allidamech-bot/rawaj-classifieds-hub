#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const API_BASE = "https://api.cloudflare.com/client/v4";
const options = parseArguments(process.argv.slice(2));
const accountId = requiredEnvironment("CLOUDFLARE_ACCOUNT_ID");
const apiToken = requiredEnvironment("CLOUDFLARE_API_TOKEN");
const databaseId = requiredEnvironment("CLOUDFLARE_D1_DATABASE_ID");
const snapshotDir = resolve(options.snapshotDir);
const outputPath = resolve(
  options.output ?? `${snapshotDir}/remote-d1-verification.json`,
);

const manifest = JSON.parse(
  await readFile(resolve(snapshotDir, "snapshot-manifest.json"), "utf8"),
);
const mediaManifest = JSON.parse(
  await readFile(resolve(snapshotDir, "media-manifest.json"), "utf8"),
);

if (manifest.version !== 1 || mediaManifest.version !== 1) {
  throw new Error("Unsupported snapshot manifest version.");
}
if (!manifest.batchId || manifest.batchId !== mediaManifest.batchId) {
  throw new Error("Snapshot and media batch IDs do not match.");
}

const expected = normalizeExpectedCounts(manifest.rowCounts, mediaManifest.entries.length);
const tables = Object.keys(expected);
const actual = {};
for (const table of tables) {
  assertIdentifier(table);
  actual[table] = await scalar(`SELECT COUNT(*) AS value FROM "${table}"`);
}

if (options.expectEmpty) {
  const nonEmpty = Object.entries(actual).filter(([, count]) => count !== 0);
  if (nonEmpty.length > 0) {
    throw new Error(
      `Target D1 database is not empty: ${nonEmpty
        .map(([table, count]) => `${table}=${count}`)
        .join(", ")}`,
    );
  }

  const report = {
    verified: true,
    mode: "expect-empty",
    databaseId,
    batchId: manifest.batchId,
    counts: actual,
    checkedAt: new Date().toISOString(),
  };
  await writeReport(report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const mismatches = [];
for (const [table, expectedCount] of Object.entries(expected)) {
  if (actual[table] !== expectedCount) {
    mismatches.push({ table, expected: expectedCount, actual: actual[table] });
  }
}

const foreignKeyViolations = await rows("PRAGMA foreign_key_check");
const pendingMedia = await scalar(
  "SELECT COUNT(*) AS value FROM media_assets WHERE status <> 'ready'",
);
const orphanImages = await scalar(`
  SELECT COUNT(*) AS value
    FROM listing_images li
    LEFT JOIN listings l ON l.id = li.listing_id
    LEFT JOIN media_assets m ON m.id = li.media_asset_id
   WHERE l.id IS NULL OR m.id IS NULL
`);
const orphanPlacements = await scalar(`
  SELECT COUNT(*) AS value
    FROM ad_placements ap
    LEFT JOIN media_assets m ON m.id = ap.media_asset_id
   WHERE m.id IS NULL
`);
const batchRows = await rows(
  "SELECT id, source_checksum_sha256, status FROM rawaj_import_batches WHERE id = ? LIMIT 1",
  [manifest.batchId],
);
const batch = batchRows[0] ?? null;

const failures = [];
if (mismatches.length > 0) failures.push(`row count mismatches: ${JSON.stringify(mismatches)}`);
if (foreignKeyViolations.length > 0) {
  failures.push(`foreign key violations: ${JSON.stringify(foreignKeyViolations)}`);
}
if (pendingMedia !== 0) failures.push(`pending media assets: ${pendingMedia}`);
if (orphanImages !== 0) failures.push(`orphan listing images: ${orphanImages}`);
if (orphanPlacements !== 0) failures.push(`orphan ad placements: ${orphanPlacements}`);
if (!batch) failures.push("import batch record is missing");
if (batch && batch.source_checksum_sha256 !== manifest.sourceChecksumSha256 && batch.source_checksum_sha256 !== manifest.sqlSha256) {
  failures.push("import batch checksum does not match the snapshot manifest");
}

if (failures.length > 0) {
  const report = {
    verified: false,
    mode: "verify-import",
    databaseId,
    batchId: manifest.batchId,
    expected,
    actual,
    mismatches,
    pendingMedia,
    orphanImages,
    orphanPlacements,
    foreignKeyViolations,
    failures,
    checkedAt: new Date().toISOString(),
  };
  await writeReport(report);
  throw new Error(`Remote D1 verification failed: ${failures.join("; ")}`);
}

if (options.finalize) {
  await execute(
    `UPDATE rawaj_import_batches
        SET status = 'verified',
            completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            failure_reason = NULL
      WHERE id = ?
        AND status IN ('prepared', 'importing')`,
    [manifest.batchId],
  );
}

const report = {
  verified: true,
  mode: options.finalize ? "verified-and-finalized" : "verified",
  databaseId,
  batchId: manifest.batchId,
  expected,
  actual,
  mediaReady: expected.media_assets,
  checkedAt: new Date().toISOString(),
};
await writeReport(report);
console.log(JSON.stringify(report, null, 2));

function normalizeExpectedCounts(rowCounts, mediaCount) {
  const expected = {};
  for (const [table, count] of Object.entries(rowCounts ?? {})) {
    if (table === "public_profiles") expected.public_profiles = Number(count);
    else expected[table] = Number(count);
  }
  expected.media_assets = Number(mediaCount);
  expected.rawaj_import_batches = 1;
  return expected;
}

async function scalar(sql, params = []) {
  const result = await rows(sql, params);
  const value = Number(result[0]?.value ?? 0);
  if (!Number.isFinite(value)) throw new Error(`Non-numeric scalar result for query: ${sql}`);
  return value;
}

async function rows(sql, params = []) {
  const result = await execute(sql, params);
  return Array.isArray(result?.results) ? result.results : [];
}

async function execute(sql, params = []) {
  const path = `/accounts/${accountId}/d1/database/${databaseId}/query`;
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const detail = Array.isArray(payload?.errors)
      ? payload.errors.map((error) => error?.message).filter(Boolean).join("; ")
      : "";
    throw new Error(`D1 query failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const result = Array.isArray(payload.result) ? payload.result[0] : payload.result;
  if (result?.success === false) {
    throw new Error(`D1 statement failed: ${result.error ?? "unknown error"}`);
  }
  return result ?? { results: [] };
}

async function writeReport(report) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function parseArguments(args) {
  const parsed = {
    expectEmpty: false,
    finalize: false,
    snapshotDir: process.env.RAWAJ_SNAPSHOT_DIR?.trim() || "cloudflare/snapshots/latest",
    output: null,
  };
  for (const argument of args) {
    if (argument === "--expect-empty") parsed.expectEmpty = true;
    else if (argument === "--finalize") parsed.finalize = true;
    else if (argument.startsWith("--snapshot-dir=")) {
      parsed.snapshotDir = argument.slice("--snapshot-dir=".length).trim();
    } else if (argument.startsWith("--output=")) {
      parsed.output = argument.slice("--output=".length).trim();
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }
  if (parsed.expectEmpty && parsed.finalize) {
    throw new Error("--expect-empty and --finalize cannot be used together.");
  }
  return parsed;
}

function assertIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
