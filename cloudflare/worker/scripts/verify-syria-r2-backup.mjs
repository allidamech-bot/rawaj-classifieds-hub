#!/usr/bin/env node
// Offline Syria R2 media verification against an independently pinned D1 snapshot.
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifySyriaD1Backup } from "./verify-syria-d1-backup.mjs";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const isSha256 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const fail = (message) => {
  throw new Error("Syria R2 recovery verification failed: " + message);
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

async function regularFile(path) {
  const stat = await lstat(path);
  expect(stat.isFile() && !stat.isSymbolicLink(), "expected a regular file");
  return readFile(path);
}

async function directory(path) {
  const stat = await lstat(path);
  expect(stat.isDirectory() && !stat.isSymbolicLink(), "expected a real directory");
}

export async function verifySyriaR2Recovery({
  r2Directory,
  expectedR2ManifestSha256,
  d1Directory,
  expectedD1ManifestSha256,
}) {
  expect(isSha256(expectedR2ManifestSha256), "independent R2 manifest SHA-256 is required");
  expect(isSha256(expectedD1ManifestSha256), "independent D1 manifest SHA-256 is required");
  expect(r2Directory && d1Directory, "both offline snapshot directories are required");

  const d1 = await verifySyriaD1Backup(d1Directory, {
    expectedManifestSha256: expectedD1ManifestSha256,
  });
  const d1Root = resolve(d1Directory);
  const d1ManifestBytes = await regularFile(resolve(d1Root, "manifest.json"));
  expect(
    sha256(d1ManifestBytes) === d1.manifestSha256,
    "D1 manifest changed after verification",
  );
  const d1Manifest = JSON.parse(d1ManifestBytes.toString("utf8"));
  const mediaRecord = d1Manifest.tables.find((entry) => entry.table === "media_assets");
  expect(mediaRecord, "verified D1 backup is missing media_assets");
  const mediaBytes = await regularFile(resolve(d1Root, "media_assets.json"));
  expect(
    sha256(mediaBytes) === mediaRecord.sha256.toLowerCase(),
    "D1 media_assets changed after verification",
  );
  const rows = JSON.parse(mediaBytes.toString("utf8"));
  const ready = rows.filter((row) => row.status === "ready");
  const readyKeys = new Set(ready.map((row) => row.object_key));
  expect(readyKeys.size === ready.length, "duplicate ready-media object keys in D1");

  const root = resolve(r2Directory);
  const blobs = resolve(root, "objects");
  await directory(root);
  await directory(blobs);
  const manifestBytes = await regularFile(resolve(root, "manifest.json"));
  const manifestHash = sha256(manifestBytes);
  expect(
    manifestHash === expectedR2ManifestSha256.toLowerCase(),
    "R2 manifest checksum mismatch",
  );
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  expect(manifest.schemaVersion === 1, "unsupported R2 manifest version");
  expect(manifest.bucket === "rawaj-listing-images-production", "wrong Syria R2 bucket");
  expect(manifest.worker === "rawaj-classifieds-hub", "wrong Syria Worker");
  expect(manifest.databaseId === d1.databaseId, "R2/D1 database identity mismatch");
  expect(
    manifest.firebaseProject === "project-af18fcaf-c46e-4ec5-93a",
    "wrong Syria Firebase project",
  );
  expect(Array.isArray(manifest.objects), "missing R2 object manifest");

  const byKey = new Map();
  const usedDigests = new Set();
  let totalBytes = 0;
  for (const item of manifest.objects) {
    expect(
      typeof item?.key === "string" && item.key.length > 0,
      "invalid R2 object key",
    );
    expect(!byKey.has(item.key), "duplicate R2 object key");
    expect(isSha256(item.sha256), "invalid object SHA-256");
    expect(
      Number.isSafeInteger(item.byteSize) && item.byteSize >= 0,
      "invalid object byte size",
    );
    expect(
      typeof item.etag === "string" && item.etag.length > 0,
      "missing R2 ETag metadata",
    );
    expect(
      item.httpMetadata &&
        typeof item.httpMetadata.contentType === "string" &&
        item.httpMetadata.contentType.length > 0,
      "missing object HTTP content type",
    );
    expect(
      item.customMetadata === undefined ||
        (item.customMetadata !== null &&
          typeof item.customMetadata === "object" &&
          !Array.isArray(item.customMetadata)),
      "invalid custom metadata",
    );
    const digest = item.sha256.toLowerCase();
    const payload = await regularFile(resolve(blobs, digest));
    expect(sha256(payload) === digest, "R2 media payload checksum mismatch");
    expect(payload.byteLength === item.byteSize, "R2 media payload size mismatch");
    usedDigests.add(digest);
    totalBytes += payload.byteLength;
    byKey.set(item.key, item);
  }
  const presentDigests = await readdir(blobs);
  expect(
    presentDigests.length === usedDigests.size &&
      presentDigests.every((name) => usedDigests.has(name)),
    "missing or unexpected R2 media blob files",
  );

  for (const asset of ready) {
    const item = byKey.get(asset.object_key);
    expect(item, "ready D1 media asset absent from the R2 snapshot");
    expect(
      Number(asset.byte_size) === item.byteSize,
      "D1/R2 media byte-size mismatch",
    );
    expect(
      isSha256(asset.checksum_sha256) &&
        asset.checksum_sha256.toLowerCase() === item.sha256.toLowerCase(),
      "D1/R2 media content checksum mismatch",
    );
    expect(
      asset.content_type === item.httpMetadata.contentType,
      "D1/R2 media content-type mismatch",
    );
    if (asset.etag !== null && asset.etag !== undefined) {
      expect(asset.etag === item.etag, "D1/R2 media ETag mismatch");
    }
    if (item.ownerId !== undefined) {
      expect(
        item.ownerId === asset.owner_id,
        "D1/R2 media ownership mismatch",
      );
    }
  }

  return {
    verified: true,
    bucket: manifest.bucket,
    manifestSha256: manifestHash,
    pinnedD1ManifestSha256: d1.manifestSha256,
    objectCount: byKey.size,
    distinctBlobCount: usedDigests.size,
    totalBytes,
    readyMediaReferencesVerified: ready.length,
    unreferencedObjectCount: [...byKey.keys()].filter((key) => !readyKeys.has(key))
      .length,
    remoteWrites: false,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const values = {};
  for (const arg of process.argv.slice(2)) {
    const matched = /^--(r2-dir|r2-sha256|d1-dir|d1-sha256)=(.+)$/.exec(arg);
    if (!matched || matched[1] in values) fail("invalid or duplicate CLI argument");
    values[matched[1]] = matched[2];
  }
  expect(Object.keys(values).length === 4, "four explicit snapshot arguments required");
  console.log(
    JSON.stringify(
      await verifySyriaR2Recovery({
        r2Directory: values["r2-dir"],
        expectedR2ManifestSha256: values["r2-sha256"],
        d1Directory: values["d1-dir"],
        expectedD1ManifestSha256: values["d1-sha256"],
      }),
      null,
      2,
    ),
  );
}
