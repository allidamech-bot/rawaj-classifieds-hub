import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../cloudflare/worker/src/marketplace-private.ts", import.meta.url),
  "utf8",
);

function functionSource(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, next >= 0 ? next : undefined);
}

test("listing deletion commits D1 removal before best-effort R2 cleanup", () => {
  const deletion = functionSource("deleteListing");
  const batch = deletion.indexOf("await env.DB.batch(statements)");
  const storageDelete = deletion.indexOf("env.MEDIA.delete(asset.object_key)");

  assert.ok(batch >= 0, "deleteListing must use a D1 batch");
  assert.ok(storageDelete > batch, "D1 deletion must complete before R2 cleanup");
  assert.match(deletion, /results\.some\(\(result\) => !result\.success\)/);
  assert.match(deletion, /rawaj_listing_media_orphan_cleanup_failed/);
  assert.match(deletion, /\.catch\(\(error\) =>/);
});

test("individual image deletion commits D1 removal before best-effort R2 cleanup", () => {
  const deletion = functionSource("deleteImage");
  const batch = deletion.indexOf("await env.DB.batch([");
  const storageDelete = deletion.indexOf("env.MEDIA.delete(String(row.object_key))");

  assert.ok(batch >= 0, "deleteImage must use a D1 batch");
  assert.ok(storageDelete > batch, "D1 deletion must complete before R2 cleanup");
  assert.match(deletion, /results\.some\(\(result\) => !result\.success\)/);
  assert.match(deletion, /rawaj_listing_image_orphan_cleanup_failed/);
  assert.match(deletion, /\.catch\(\(error\) =>/);
  assert.doesNotMatch(deletion, /storage_error/);
  assert.doesNotMatch(deletion, /SET status = 'deleted'/);
});

test("new upload rollback still removes an unlinked R2 object", () => {
  const upload = functionSource("uploadImage");
  const failedBatch = upload.indexOf("results.some((result) => !result.success)");
  const storageDelete = upload.indexOf("env.MEDIA.delete(objectKey)", failedBatch);

  assert.ok(failedBatch >= 0);
  assert.ok(storageDelete > failedBatch);
});
