import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const addPath = new URL("../src/routes/add-listing.tsx", import.meta.url);
const editPath = new URL("../src/routes/profile/listings.$id.tsx", import.meta.url);
const listingsApiPath = new URL("../src/lib/api/listings.ts", import.meta.url);
const processingPath = new URL("../src/lib/listing-image-processing.ts", import.meta.url);
const [addRoute, editRoute, listingsApi, processing] = await Promise.all([
  readFile(addPath, "utf8"),
  readFile(editPath, "utf8"),
  readFile(listingsApiPath, "utf8"),
  readFile(processingPath, "utf8"),
]);

test("add and edit listing image flows keep per-image upload state", () => {
  assert.match(
    addRoute,
    /type ImageUploadState = "pending" \| "uploading" \| "uploaded" \| "failed"/,
  );
  assert.match(editRoute, /type EditImageUploadState = "pending" \| "uploading" \| "failed"/);
  assert.match(editRoute, /state: "pending" as const/);
  assert.match(editRoute, /state: "uploading" as const/);
  assert.match(editRoute, /state: "failed" as const/);
});

test("edit listing image selection is bounded and duplicate safe", () => {
  assert.match(editRoute, /const MAX_IMAGES = 6/);
  assert.match(editRoute, /fileFingerprint/);
  assert.match(editRoute, /MAX_IMAGES - images\.length - current\.length/);
  assert.match(editRoute, /!existing\.has\(fileFingerprint\(file\)\)/);
});

test("edit listing preserves failed photos for one-photo retry", () => {
  assert.match(editRoute, /async function uploadSelectedImage\(entryId: string\)/);
  assert.match(editRoute, /async function retrySelectedImage\(entryId: string\)/);
  assert.match(editRoute, /retrySelectedImage\(preview\.id\)/);
  assert.match(editRoute, /preview\.state === "failed"/);
  assert.doesNotMatch(editRoute, /if \(errors\.length > 0\)[\s\S]{0,120}setSelectedImages\(\[\]\)/);
});

test("edit listing revokes local preview URLs on removal and unmount", () => {
  assert.match(editRoute, /URL\.revokeObjectURL\(entry\.url\)/);
  assert.match(
    editRoute,
    /selectedImagesRef\.current\.forEach\(\(entry\) => URL\.revokeObjectURL\(entry\.url\)\)/,
  );
});

test("listing images are resized, metadata-stripped and uploaded as processed files", () => {
  assert.match(processing, /MAX_LISTING_IMAGE_DIMENSION = 2048/);
  assert.match(processing, /Math\.min\(1, maxDimension \/ Math\.max\(width, height\)\)/);
  assert.match(processing, /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/);
  assert.match(processing, /canvasToBlob\(canvas, "image\/webp", LISTING_IMAGE_QUALITY\)/);
  assert.match(processing, /new File\(\[blob\], `\$\{baseName\}\.webp`/);
  assert.match(listingsApi, /prepareListingImageForUpload\(file\)/);
  assert.match(listingsApi, /upload\(storagePath, preparedFile/);
  assert.match(listingsApi, /contentType: preparedFile\.type/);
});

test("unsupported browser processing falls back without blocking upload", () => {
  assert.match(processing, /typeof document === "undefined"/);
  assert.match(processing, /typeof createImageBitmap !== "function"/);
  assert.match(processing, /catch \{[\s\S]*return file;/);
});
