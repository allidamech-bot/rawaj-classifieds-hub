import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { verifySyriaR2Recovery } from "../cloudflare/worker/scripts/verify-syria-r2-backup.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const roots = [];
test.after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "rawaj-syria-r2-"));
  roots.push(root);
  const d1Directory = join(root, "d1");
  const r2Directory = join(root, "r2");
  await mkdir(d1Directory);
  await mkdir(join(r2Directory, "objects"), { recursive: true });
  const bytes = Buffer.from("synthetic-image-for-r2-restore");
  const digest = hash(bytes);
  const objectKey = "users/u1/listings/ad1/image.png";
  const asset = {
    object_key: objectKey,
    byte_size: bytes.length,
    checksum_sha256: digest,
    content_type: "image/png",
    etag: '"synthetic-etag"',
    owner_id: "u1",
    status: "ready",
  };
  const schema = {
    objects: [
      {
        type: "table",
        name: "media_assets",
        sql: "CREATE TABLE media_assets (object_key TEXT PRIMARY KEY)",
      },
    ],
  };
  const schemaBytes = JSON.stringify(schema) + "\n";
  const tableBytes = JSON.stringify([asset]) + "\n";
  await writeFile(join(d1Directory, "schema.json"), schemaBytes);
  await writeFile(join(d1Directory, "media_assets.json"), tableBytes);
  const d1Manifest = {
    database: "rawaj-staging",
    databaseId: "d0e6496c-9f63-48d3-beeb-d2e219500f6a",
    worker: "rawaj-classifieds-hub",
    bucket: "rawaj-listing-images-production",
    firebaseProject: "project-af18fcaf-c46e-4ec5-93a",
    schemaSha256: hash(schemaBytes),
    tables: [
      { table: "media_assets", rowCount: 1, sha256: hash(tableBytes) },
    ],
    excludedVirtualTables: [],
  };
  const d1ManifestBytes = JSON.stringify(d1Manifest) + "\n";
  await writeFile(join(d1Directory, "manifest.json"), d1ManifestBytes);
  await writeFile(join(r2Directory, "objects", digest), bytes);
  const r2Manifest = {
    schemaVersion: 1,
    bucket: "rawaj-listing-images-production",
    worker: "rawaj-classifieds-hub",
    databaseId: d1Manifest.databaseId,
    firebaseProject: d1Manifest.firebaseProject,
    objects: [
      {
        key: objectKey,
        sha256: digest,
        byteSize: bytes.length,
        etag: asset.etag,
        httpMetadata: { contentType: "image/png", cacheControl: "private, no-store" },
        customMetadata: {},
        ownerId: "u1",
      },
    ],
  };
  const pinR2 = async () => {
    const data = JSON.stringify(r2Manifest) + "\n";
    await writeFile(join(r2Directory, "manifest.json"), data);
    return hash(data);
  };
  return {
    r2Directory,
    d1Directory,
    r2Manifest,
    pinR2,
    options: {
      r2Directory,
      d1Directory,
      expectedD1ManifestSha256: hash(d1ManifestBytes),
      expectedR2ManifestSha256: await pinR2(),
    },
  };
}

test("verifies object bytes, metadata and D1 ready-media ownership without remote access", async () => {
  const f = await fixture();
  const report = await verifySyriaR2Recovery(f.options);
  assert.equal(report.verified, true);
  assert.equal(report.objectCount, 1);
  assert.equal(report.distinctBlobCount, 1);
  assert.equal(report.readyMediaReferencesVerified, 1);
  assert.equal(report.unreferencedObjectCount, 0);
  assert.equal(report.remoteWrites, false);
});

test("refuses tampered media bytes", async () => {
  const f = await fixture();
  const key = f.r2Manifest.objects[0].sha256;
  await writeFile(join(f.r2Directory, "objects", key), "tampered bytes");
  await assert.rejects(verifySyriaR2Recovery(f.options), /payload checksum mismatch/);
});

test("refuses a ready D1 asset missing from the media snapshot", async () => {
  const f = await fixture();
  const key = f.r2Manifest.objects[0].sha256;
  await rm(join(f.r2Directory, "objects", key));
  f.r2Manifest.objects = [];
  f.options.expectedR2ManifestSha256 = await f.pinR2();
  await assert.rejects(verifySyriaR2Recovery(f.options), /absent from the R2 snapshot/);
});

test("refuses a wrong-country R2 bucket even with a fresh checksum", async () => {
  const f = await fixture();
  f.r2Manifest.bucket = "wrong-bucket";
  f.options.expectedR2ManifestSha256 = await f.pinR2();
  await assert.rejects(verifySyriaR2Recovery(f.options), /wrong Syria R2 bucket/);
});

test("rejects ownership and ETag conflicts against verified D1 metadata", async () => {
  const f = await fixture();
  f.r2Manifest.objects[0].ownerId = "other-owner";
  f.options.expectedR2ManifestSha256 = await f.pinR2();
  await assert.rejects(verifySyriaR2Recovery(f.options), /ownership mismatch/);
  f.r2Manifest.objects[0].ownerId = "u1";
  f.r2Manifest.objects[0].etag = '"different"';
  f.options.expectedR2ManifestSha256 = await f.pinR2();
  await assert.rejects(verifySyriaR2Recovery(f.options), /ETag mismatch/);
});

test("rejects invalid object digests instead of permitting path traversal", async () => {
  const f = await fixture();
  f.r2Manifest.objects[0].sha256 = "../../escape";
  f.options.expectedR2ManifestSha256 = await f.pinR2();
  await assert.rejects(verifySyriaR2Recovery(f.options), /invalid object SHA-256/);
});

test("requires independently pinned D1 and R2 manifests", async () => {
  const f = await fixture();
  await assert.rejects(
    verifySyriaR2Recovery({
      ...f.options,
      expectedD1ManifestSha256: undefined,
    }),
    /independent D1 manifest/,
  );
  await assert.rejects(
    verifySyriaR2Recovery({
      ...f.options,
      expectedR2ManifestSha256: undefined,
    }),
    /independent R2 manifest/,
  );
});
