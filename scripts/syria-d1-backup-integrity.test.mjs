import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertSafeBackupOutputPaths } from "../cloudflare/worker/scripts/syria-backup-safety.mjs";
import { verifySyriaD1Backup } from "../cloudflare/worker/scripts/verify-syria-d1-backup.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "rawaj-syria-backup-test-"));
  const root = join(base, "backup");
  await mkdir(root, { mode: 0o700 });
  const schema = {
    objects: [
      { type: "table", name: "accounts", sql: "CREATE TABLE accounts (id TEXT PRIMARY KEY)" },
      { type: "table", name: "listings", sql: "CREATE TABLE listings (id TEXT PRIMARY KEY)" },
      { type: "table", name: "listings_fts", sql: "CREATE VIRTUAL TABLE listings_fts USING fts5(title)" },
    ],
  };
  const tables = [
    { table: "accounts", rows: [{ id: "a" }] },
    { table: "listings", rows: [{ id: "l" }, { id: "m" }] },
  ];
  const schemaContents = JSON.stringify(schema) + "\n";
  await writeFile(join(root, "schema.json"), schemaContents);
  const entries = [];
  for (const { table, rows } of tables) {
    const content = JSON.stringify(rows) + "\n";
    await writeFile(join(root, table + ".json"), content);
    entries.push({ table, rowCount: rows.length, sha256: hash(content) });
  }
  const manifest = {
    database: "rawaj-staging",
    databaseId: "d0e6496c-9f63-48d3-beeb-d2e219500f6a",
    worker: "rawaj-classifieds-hub",
    bucket: "rawaj-listing-images-production",
    firebaseProject: "project-af18fcaf-c46e-4ec5-93a",
    schemaSha256: hash(schemaContents),
    tables: entries,
    excludedVirtualTables: ["listings_fts"],
  };
  const writeManifest = () => writeFile(join(root, "manifest.json"), JSON.stringify(manifest) + "\n");
  await writeManifest();
  return { root, manifest, writeManifest };
}

test("validates every table, row count, schema hash and Syria resource identity offline", async () => {
  const f = await fixture();
  const report = await verifySyriaD1Backup(f.root);
  assert.equal(report.tables, 2);
  assert.equal(report.totalRows, 3);
  assert.equal(report.verified, true);
  const pinnedHash = hash(await readFile(join(f.root, "manifest.json")));
  assert.equal(
    (await verifySyriaD1Backup(f.root, { expectedManifestSha256: pinnedHash })).verified,
    true,
  );
});

test("detects tampered table content", async () => {
  const f = await fixture();
  await writeFile(join(f.root, "listings.json"), "[]\n");
  await assert.rejects(verifySyriaD1Backup(f.root), /table checksum mismatch/);
});

test("detects tampered row counts even when checksums are correct", async () => {
  const f = await fixture();
  f.manifest.tables[0].rowCount = 99;
  await f.writeManifest();
  await assert.rejects(verifySyriaD1Backup(f.root), /row count mismatch/);
});

test("rejects the wrong country resource identity", async () => {
  const f = await fixture();
  f.manifest.firebaseProject = "wrong-project";
  await f.writeManifest();
  await assert.rejects(verifySyriaD1Backup(f.root), /wrong Syria resource identity/);
});

test("rejects a corrupted schema checksum", async () => {
  const f = await fixture();
  await writeFile(join(f.root, "schema.json"), "{}\n");
  await assert.rejects(verifySyriaD1Backup(f.root), /schema checksum mismatch/);
});

test("rejects duplicate table metadata and an externally unpinned manifest", async () => {
  const f = await fixture();
  const originalHash = hash(await readFile(join(f.root, "manifest.json")));
  f.manifest.tables.push({ ...f.manifest.tables[0] });
  await f.writeManifest();
  await assert.rejects(verifySyriaD1Backup(f.root), /duplicate table entry/);
  await assert.rejects(
    verifySyriaD1Backup(f.root, { expectedManifestSha256: originalHash }),
    /manifest checksum mismatch/,
  );
});

test("rejects symlinks in a table export", async () => {
  const f = await fixture();
  await rm(join(f.root, "accounts.json"));
  await symlink(join(f.root, "listings.json"), join(f.root, "accounts.json"));
  await assert.rejects(verifySyriaD1Backup(f.root), /must be regular and not a symbolic link/);
});

test("refuses in-repo outputs, relative paths, overwrite targets and symlink escape paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "rawaj-backup-path-"));
  const repositoryRoot = join(root, "repo");
  const outside = join(root, "out");
  await mkdir(repositoryRoot);
  await mkdir(outside);
  const backupDir = join(outside, "fresh");
  const report = join(outside, "report.json");
  const input = { repositoryRoot, backupDir, report };
  assert.deepEqual(await assertSafeBackupOutputPaths(input), { backupDir, report });
  await assert.rejects(
    assertSafeBackupOutputPaths({ ...input, backupDir: join(repositoryRoot, "backup") }),
    /outside the RAWAJ repository/,
  );
  await assert.rejects(
    assertSafeBackupOutputPaths({ ...input, report: join(repositoryRoot, "report.json") }),
    /outside the RAWAJ repository/,
  );
  await assert.rejects(
    assertSafeBackupOutputPaths({ ...input, backupDir: "relative" }),
    /absolute paths/,
  );
  await mkdir(backupDir);
  await assert.rejects(assertSafeBackupOutputPaths(input), /already exists/);
  await symlink(repositoryRoot, join(outside, "repo-alias"));
  await assert.rejects(
    assertSafeBackupOutputPaths({ ...input, backupDir: join(outside, "repo-alias", "backup") }),
    /outside the RAWAJ repository/,
  );
});
