#!/usr/bin/env node
// Offline, in-memory SQLite restoration rehearsal. Never connects to Cloudflare.
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { verifySyriaD1Backup } from "./verify-syria-d1-backup.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const identifier = (name) => typeof name === "string" && /^[a-z_][a-z0-9_]*$/i.test(name);
const quoted = (name) => {
  if (!identifier(name)) throw new Error("Unsafe SQLite identifier in Syria backup");
  return `"${name}"`;
};
const isVirtual = (object) => /^CREATE\s+VIRTUAL\s+TABLE\b/i.test(object.sql ?? "");
const isFtsShadow = (name) => /^listings_fts(?:_|$)/i.test(name);
const assert = (condition, message) => {
  if (!condition) throw new Error(`Syria isolated restore failed: ${message}`);
};

async function readSafeFile(path) {
  const stat = await lstat(path);
  assert(stat.isFile() && !stat.isSymbolicLink(), "backup file is not regular");
  return readFile(path);
}

const normalizeRows = (rows) =>
  rows
    .map((row) => JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))
    .sort();

/**
 * Verify a separately SHA-pinned Syria snapshot, restore it to SQLite :memory:,
 * reconstruct the excluded listings_fts index, and check rows, schema and FKs.
 * No remote access; no production or persistent database writes.
 */
export async function rehearseSyriaD1Backup(directory, { expectedManifestSha256 } = {}) {
  assert(/^[a-f0-9]{64}$/i.test(expectedManifestSha256 ?? ""), "an external 64-character manifest SHA-256 pin is required");
  const verified = await verifySyriaD1Backup(directory, { expectedManifestSha256 });
  const root = resolve(directory);
  const manifestBytes = await readSafeFile(resolve(root, "manifest.json"));
  assert(hash(manifestBytes) === verified.manifestSha256, "manifest changed after verification");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const schemaBytes = await readSafeFile(resolve(root, "schema.json"));
  assert(hash(schemaBytes) === verified.schemaSha256, "schema changed after verification");
  const schema = JSON.parse(schemaBytes.toString("utf8"));
  const objects = schema.objects;
  assert(Array.isArray(objects), "missing database schema");
  const schemaTables = objects.filter((o) => o.type === "table" && !isVirtual(o) && !isFtsShadow(o.name));
  const names = schemaTables.map((o) => o.name);
  assert(names.length === manifest.tables.length && new Set(names).size === names.length, "schema and dump table counts differ");
  const dumpNames = new Set(manifest.tables.map((entry) => entry.table));
  assert(names.every((name) => dumpNames.has(name)), "schema and dump table names differ");

  const database = new DatabaseSync(":memory:");
  const report = {
    verifiedManifestSha256: verified.manifestSha256,
    databaseId: verified.databaseId,
    restoredTables: 0,
    restoredRows: 0,
    reconstructedFtsRows: 0,
    foreignKeyViolations: 0,
    rowContentVerified: false,
    isolated: true,
  };
  try {
    database.exec("PRAGMA foreign_keys = OFF; BEGIN TRANSACTION");
    // Load base tables first, including their original column definitions.
    for (const object of schemaTables) {
      assert(identifier(object.name) && /^CREATE\s+TABLE\b/i.test(object.sql ?? ""), "unsafe table DDL");
      database.exec(object.sql);
    }
    for (const entry of manifest.tables) {
      const table = quoted(entry.table);
      const bytes = await readSafeFile(resolve(root, entry.table + ".json"));
      assert(hash(bytes) === entry.sha256.toLowerCase(), "table changed after verification: " + entry.table);
      const rows = JSON.parse(bytes.toString("utf8"));
      assert(rows.length === entry.rowCount, "row count changed after verification: " + entry.table);
      const generated = new Set(
        database.prepare(`PRAGMA table_xinfo(${table})`).all().filter((column) => column.hidden === 2 || column.hidden === 3).map((column) => column.name),
      );
      for (const row of rows) {
        const keys = Object.keys(row).filter((key) => !generated.has(key));
        assert(keys.length > 0, "empty row cannot be restored: " + entry.table);
        assert(keys.every(identifier), "unsafe column name: " + entry.table);
        const values = keys.map((key) => row[key]);
        assert(values.every((v) => v === null || typeof v === "string" || (typeof v === "number" && Number.isFinite(v))), "unsupported row value in " + entry.table);
        const placeholders = keys.map(() => "?").join(", ");
        database.prepare(`INSERT INTO ${table} (${keys.map(quoted).join(", ")}) VALUES (${placeholders})`).run(...values);
      }
      const restored = database.prepare(`SELECT * FROM ${table}`).all();
      assert(restored.length === rows.length, "restored row count mismatch: " + entry.table);
      assert(JSON.stringify(normalizeRows(restored)) === JSON.stringify(normalizeRows(rows)), "restored row content mismatch: " + entry.table);
      report.restoredTables += 1;
      report.restoredRows += restored.length;
    }

    // Virtual FTS5 tables are deliberately excluded from the export. They must
    // be reconstructed from the restored listings, not silently left empty.
    for (const object of objects.filter((o) => o.type === "table" && isVirtual(o))) {
      assert(object.name === "listings_fts" && /\bUSING\s+fts5\s*\(/i.test(object.sql ?? ""), "unsupported virtual table: " + object.name);
      database.exec(object.sql);
      database.exec(`INSERT INTO listings_fts (listing_id, title, description, search_text_normalized)
        SELECT id, title, description, search_text_normalized FROM listings`);
      const ftsCount = Number(database.prepare("SELECT COUNT(*) AS count FROM listings_fts").get().count);
      const listingsCount = Number(database.prepare("SELECT COUNT(*) AS count FROM listings").get().count);
      assert(ftsCount === listingsCount, "FTS reconstruction count mismatch");
      report.reconstructedFtsRows = ftsCount;
    }
    // Auto-indexes and FTS shadow tables have no independent replayable DDL.
    for (const type of ["index", "view", "trigger"]) {
      for (const object of objects.filter((o) => o.type === type && o.sql)) database.exec(object.sql);
    }
    database.exec("COMMIT; PRAGMA foreign_keys = ON");
    const violations = database.prepare("PRAGMA foreign_key_check").all();
    report.foreignKeyViolations = violations.length;
    assert(violations.length === 0, "foreign key violations detected");
    report.rowContentVerified = true;
    return report;
  } catch (error) {
    if (database.isOpen) {
      try { database.exec("ROLLBACK"); } catch { /* may already be committed */ }
    }
    throw error;
  } finally {
    database.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const directory = args.find((arg) => arg.startsWith("--backup-dir="))?.slice(13);
  const expectedManifestSha256 = args.find((arg) => arg.startsWith("--expected-manifest-sha256="))?.slice(27);
  if (!directory || args.length !== 2 || args.some((arg) => !arg.startsWith("--backup-dir=") && !arg.startsWith("--expected-manifest-sha256="))) {
    throw new Error("Usage: node rehearse-syria-d1-backup.mjs --backup-dir=/absolute/private/backup --expected-manifest-sha256=<64-hex-sha256>");
  }
  console.log(JSON.stringify(await rehearseSyriaD1Backup(directory, { expectedManifestSha256 }), null, 2));
}
