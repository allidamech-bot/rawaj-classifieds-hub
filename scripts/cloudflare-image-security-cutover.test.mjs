#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [imageSecurity, security, marketplace, entry] = await Promise.all([
  read("cloudflare/worker/src/image-security.ts"),
  read("cloudflare/worker/src/security.ts"),
  read("cloudflare/worker/src/marketplace-private.ts"),
  read("cloudflare/worker/src/entry.ts"),
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

test("privacy-bearing metadata is removed losslessly before marketplace handlers", () => {
  assert.match(imageSecurity, /stripImagePrivacyMetadata/);
  assert.match(imageSecurity, /PNG_PRIVACY_CHUNKS/);
  assert.match(imageSecurity, /JPEG_PRIVACY_MARKERS/);
  assert.match(imageSecurity, /type === "EXIF" \|\| type === "XMP "/);
  assert.match(imageSecurity, /chunk\[8\] &= ~0x0c/);
  assert.match(security, /image_privacy_metadata_stripped/);
  assert.match(security, /metadata_sanitization_failed/);
  assert.match(security, /rebuildImageUploadRequest/);
  assert.match(security, /const sanitizedBuffer = sanitizedBytes\.buffer\.slice/);
  assert.match(security, /new File\(\[sanitizedBuffer\]/);
  assert.match(security, /form\.forEach\(\(value, key\)/);
  assert.doesNotMatch(security, /EXIF payload|GPS|metadataValue|metadataContent/);
});

test("sanitized upload request replaces the original before route dispatch", () => {
  assert.match(security, /Promise<Response \| Request \| null>/);
  assert.match(entry, /securityResult instanceof Response/);
  assert.match(entry, /securityResult instanceof Request \? securityResult : request/);
  const securityIndex = entry.indexOf("await enforceRequestSecurity(request, env, requestId)");
  const routeIndex = entry.indexOf("await routeRequest(securedRequest, env)");
  assert.ok(securityIndex >= 0 && routeIndex > securityIndex);
});

test("sanitization preserves image coding and strips only metadata containers", () => {
  assert.doesNotMatch(imageSecurity, /resize|reencode|canvas|sharp|wasm/i);
  assert.match(imageSecurity, /parts\.push\(bytes\.slice/);
  assert.match(imageSecurity, /chunks\.push\(bytes\.slice/);
  assert.match(imageSecurity, /writeUint32Le\(output, 4, 4 \+ chunksLength\)/);
});

test("malformed or unsanitizable images fail before marketplace storage", () => {
  assert.match(security, /invalid_image_structure/);
  assert.match(security, /Image dimensions or structure are not supported/);
  assert.match(security, /Image could not be sanitized safely/);
  const inspectionIndex = security.indexOf("await inspectMarketplaceImageRequest(request, requestId, path)");
  const adminIndex = security.indexOf("await enforceAdminSecurityPerimeter(request, env, requestId, path)");
  assert.ok(inspectionIndex >= 0 && adminIndex > inspectionIndex);
});
