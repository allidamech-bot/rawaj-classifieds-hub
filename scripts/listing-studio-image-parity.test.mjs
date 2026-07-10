import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const addPath = new URL("../src/routes/add-listing.tsx", import.meta.url);
const editPath = new URL("../src/routes/profile/listings.$id.tsx", import.meta.url);
const [addRoute, editRoute] = await Promise.all([
  readFile(addPath, "utf8"),
  readFile(editPath, "utf8"),
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
