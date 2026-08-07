#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [imageSecurity, security, marketplace] = await Promise.all([
  read("cloudflare/worker/src/image-security.ts"),
  read("cloudflare/worker/src/security.ts"),
  read("cloudflare/worker/src/marketplace-private.ts"),
]);

test("marketplace image uploads remain size and MIME constrained", () => {
  assert.match(marketplace, /MAX_IMAGE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(marketplace, /image\/jpeg/);
  assert.match(marketplace, /image\/png/);
  assert.match(marketplace, /image\/webp/);
  assert.match(security, /MAX_MARKETPLACE_IMAGE_REQUEST_BYTES = 9 \* 1024 \* 1024/);
  assert.match(security, /MAX_MARKETPLACE_IMAGE_BYTES = 8 \* 1024 \* 1024/);
});

test("deep image inspection executes only after upload rate limiting", () => {
  const limiterIndex = security.indexOf("await decision.binding.limit({ key })");
  const inspectionIndex = security.indexOf("await inspectMarketplaceImageRequest(request, requestId, path)");
  assert.ok(limiterIndex >= 0);
  assert.ok(inspectionIndex > limiterIndex);
  assert.match(security, /request\s*\.clone\(\)\s*\.formData\(\)/);
});

test("JPEG PNG and WebP dimensions are structurally parsed and bounded", () => {
  assert.match(imageSecurity, /inspectJpeg/);
  assert.match(imageSecurity, /inspectPng/);
  assert.match(imageSecurity, /inspectWebp/);
  assert.match(imageSecurity, /MAX_IMAGE_DIMENSION = 8_000/);
  assert.match(imageSecurity, /MAX_IMAGE_PIXELS = 40_000_000/);
  assert.match(imageSecurity, /dimensions_too_large/);
  assert.match(imageSecurity, /pixel_count_too_large/);
  assert.match(imageSecurity, /invalid_structure/);
});

test("privacy-bearing image metadata is detected without logging its contents", () => {
  assert.match(imageSecurity, /"eXIf", "tEXt", "zTXt", "iTXt"/);
  assert.match(imageSecurity, /marker === 0xe1/);
  assert.match(imageSecurity, /type === "EXIF" \|\| type === "XMP "/);
  assert.match(security, /image_privacy_metadata_detected/);
  assert.doesNotMatch(security, /EXIF payload|GPS|metadataValue|metadataContent/);
});

test("malformed or oversized-dimension images fail before marketplace storage", () => {
  assert.match(security, /invalid_image_structure/);
  assert.match(security, /Image dimensions or structure are not supported/);
  const inspectionIndex = security.indexOf("await inspectMarketplaceImageRequest(request, requestId, path)");
  const adminIndex = security.indexOf("await enforceAdminSecurityPerimeter(request, env, requestId, path)");
  assert.ok(inspectionIndex >= 0 && adminIndex > inspectionIndex);
});
