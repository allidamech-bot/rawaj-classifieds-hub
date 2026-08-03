import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const publicCore = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const privateCore = fs.readFileSync(
  new URL("../src/marketplace-private.ts", import.meta.url),
  "utf8",
);

test("public listing media revalidates D1 before cached bytes", () => {
  assert.match(publicCore, /public, max-age=0, must-revalidate/);
  assert.match(publicCore, /Cloudflare-CDN-Cache-Control", "no-store"/);
  assert.match(publicCore, /CDN-Cache-Control", "no-store"/);
  const mediaHandler = publicCore.indexOf("async function mediaAsset(");
  const authorizationLookup = publicCore.indexOf("FROM media_assets m", mediaHandler);
  const conditional = publicCore.indexOf(
    'request.headers.get("If-None-Match")',
    authorizationLookup,
  );
  const r2Read = publicCore.indexOf("await env.MEDIA.get", conditional);
  assert.ok(mediaHandler >= 0 && authorizationLookup > mediaHandler);
  assert.ok(conditional > authorizationLookup);
  assert.ok(r2Read > conditional);
});

test("new listing media is never marked immutable", () => {
  const uploadStart = privateCore.indexOf("async function uploadImage(");
  const uploadEnd = privateCore.indexOf("async function listImages(", uploadStart);
  const listingUpload = privateCore.slice(uploadStart, uploadEnd);
  assert.match(listingUpload, /public, max-age=0, must-revalidate/);
  assert.doesNotMatch(listingUpload, /max-age=31536000, immutable/);
});
