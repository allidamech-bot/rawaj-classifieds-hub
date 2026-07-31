import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../cloudflare/worker/src/marketplace-private.ts", import.meta.url),
  "utf8",
);

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next >= 0 ? next : undefined);
}

test("approved owner listings expose public media while unpublished listings remain private", () => {
  const mapper = functionSource("mapListingRow");

  assert.match(mapper, /const status = stringValue\(row\.status\)/);
  assert.match(mapper, /status === "approved"/);
  assert.match(mapper, /"\/v1\/media\/assets"/);
  assert.match(mapper, /"\/v1\/account\/media\/assets"/);
  assert.match(mapper, /primaryImageUrl:/);

  const publicPrefix = mapper.indexOf('"/v1/media/assets"');
  const privatePrefix = mapper.indexOf('"/v1/account/media/assets"');
  const primaryImage = mapper.indexOf("primaryImageUrl:");
  assert.ok(publicPrefix >= 0 && privatePrefix >= 0);
  assert.ok(publicPrefix < primaryImage && privatePrefix < primaryImage);
});

test("listing detail and image-list responses keep the same status-aware media boundary", () => {
  const approvedPublic =
    'row.status === "approved"\n              ? `/v1/media/assets/${encodeURIComponent(stringValue(image.media_asset_id))}`';
  const listPrefix =
    'listing.status === "approved" ? "/v1/media/assets" : "/v1/account/media/assets"';

  assert.ok(source.includes(approvedPublic));
  assert.ok(source.includes(listPrefix));
});
