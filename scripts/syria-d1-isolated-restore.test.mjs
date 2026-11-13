import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { rehearseSyriaD1Backup } from "../cloudflare/worker/scripts/rehearse-syria-d1-backup.mjs";

const sha = (x) => createHash("sha256").update(x).digest("hex");
const created = [];
test.after(async () => { for (const dir of created) await rm(dir, { recursive: true, force: true }); });

async function fixture({ invalidForeignKey = false, unsupportedVirtual = false } = {}) {
  const root = join(await mkdtemp(join(tmpdir(), "rawaj-isolated-d1-")), "snapshot");
  created.push(join(root, ".."));
  await mkdir(root, { mode: 0o700 });
  const objects = [
    { type: "table", name: "accounts", sql: "CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL)" },
    { type: "table", name: "listings", sql: "CREATE TABLE listings (id TEXT PRIMARY KEY, owner_id TEXT REFERENCES accounts(id), title TEXT, description TEXT, search_text_normalized TEXT)" },
    { type: "table", name: unsupportedVirtual ? "other_search" : "listings_fts", sql: `CREATE VIRTUAL TABLE ${unsupportedVirtual ? "other_search" : "listings_fts"} USING fts5(listing_id UNINDEXED, title, description, search_text_normalized)` },
    { type: "index", name: "idx_listings_owner", sql: "CREATE INDEX idx_listings_owner ON listings(owner_id)" },
    { type: "view", name: "listing_titles", sql: "CREATE VIEW listing_titles AS SELECT id, title FROM listings" },
    { type: "trigger", name: "listings_fts_after_insert", sql: "CREATE TRIGGER listings_fts_after_insert AFTER INSERT ON listings BEGIN INSERT INTO listings_fts (listing_id, title, description, search_text_normalized) VALUES (new.id, new.title, new.description, new.search_text_normalized); END" },
  ];
  const schemaBytes = JSON.stringify({ objects }) + "\n";
  await writeFile(join(root, "schema.json"), schemaBytes);
  const rowsByTable = {
    accounts: [{ id: "owner-1", name: "Owner" }],
    listings: [
      { id: "ad-1", owner_id: invalidForeignKey ? "missing-owner" : "owner-1", title: "Phone", description: "Good", search_text_normalized: "phone good" },
      { id: "ad-2", owner_id: "owner-1", title: "Car", description: "Clean", search_text_normalized: "car clean" },
    ],
  };
  const tables = [];
  for (const [table, rows] of Object.entries(rowsByTable)) {
    const bytes = JSON.stringify(rows) + "\n";
    await writeFile(join(root, table + ".json"), bytes);
    tables.push({ table, rowCount: rows.length, sha256: sha(bytes) });
  }
  const manifest = {
    database: "rawaj-staging",
    databaseId: "d0e6496c-9f63-48d3-beeb-d2e219500f6a",
    worker: "rawaj-classifieds-hub",
    bucket: "rawaj-listing-images-production",
    firebaseProject: "project-af18fcaf-c46e-4ec5-93a",
    schemaSha256: sha(schemaBytes), tables,
    excludedVirtualTables: [unsupportedVirtual ? "other_search" : "listings_fts"],
  };
  const manifestBytes = JSON.stringify(manifest) + "\n";
  await writeFile(join(root, "manifest.json"), manifestBytes);
  return { root, pin: sha(manifestBytes), manifest };
}

test("restores rows in memory, recreates FTS index and checks all foreign keys", async () => {
  const f = await fixture();
  const report = await rehearseSyriaD1Backup(f.root, { expectedManifestSha256: f.pin });
  assert.equal(report.restoredTables, 2);
  assert.equal(report.restoredRows, 3);
  assert.equal(report.reconstructedFtsRows, 2);
  assert.equal(report.foreignKeyViolations, 0);
  assert.equal(report.rowContentVerified, true);
  assert.equal(report.isolated, true);
});

test("refuses a restore without an external manifest SHA pin", async () => {
  const f = await fixture();
  await assert.rejects(rehearseSyriaD1Backup(f.root), /external 64-character manifest SHA/);
});

test("refuses modified table data, including a row changed after export", async () => {
  const f = await fixture();
  const path = join(f.root, "listings.json");
  await writeFile(path, (await readFile(path, "utf8")).replace("Phone", "Tampered"));
  await assert.rejects(rehearseSyriaD1Backup(f.root, { expectedManifestSha256: f.pin }), /checksum mismatch/);
});

test("fails the isolated restore on real foreign-key inconsistencies", async () => {
  const f = await fixture({ invalidForeignKey: true });
  await assert.rejects(rehearseSyriaD1Backup(f.root, { expectedManifestSha256: f.pin }), /foreign key violations/);
});

test("rejects virtual indexes it cannot deterministically reconstruct", async () => {
  const f = await fixture({ unsupportedVirtual: true });
  await assert.rejects(rehearseSyriaD1Backup(f.root, { expectedManifestSha256: f.pin }), /unsupported virtual table/);
});

test("refuses a manifest from a different regional resource", async () => {
  const f = await fixture();
  f.manifest.bucket = "some-other-country-bucket";
  const bytes = JSON.stringify(f.manifest) + "\n";
  await writeFile(join(f.root, "manifest.json"), bytes);
  await assert.rejects(rehearseSyriaD1Backup(f.root, { expectedManifestSha256: sha(bytes) }), /wrong Syria resource identity/);
});
