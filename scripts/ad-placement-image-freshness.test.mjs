import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [publicApi, facade, slot, route, storage] = await Promise.all([
  readFile(new URL("../src/lib/api/public-ad-placements.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.ad-placements.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/storage.ts", import.meta.url), "utf8"),
]);

test("public ad placement cache broadcasts invalidation across tabs", () => {
  assert.match(publicApi, /BroadcastChannel/);
  assert.match(publicApi, /broadcastChannel\.postMessage/);
  assert.match(publicApi, /window\.addEventListener\("storage"/);
  assert.match(publicApi, /export function onAdPlacementInvalidation/);
});

test("PublicAdPlacementSlot refetches after an explicit invalidation event", () => {
  assert.match(slot, /onAdPlacementInvalidation\(load\)/);
  assert.match(slot, /const unsubscribe = onAdPlacementInvalidation\(load\)/);
  assert.match(slot, /return \(\) => \{\s*cancelled = true;\s*unsubscribe\(\);\s*\}/);
});

test("stale in-flight placement reads cannot repopulate invalidated image data", () => {
  assert.match(publicApi, /const requestGeneration = activePlacementCacheGeneration/);
  assert.match(
    publicApi,
    /result\.ok && requestGeneration === activePlacementCacheGeneration/,
  );
});

test("owner placement saves (image replacement) invalidate the public cache", () => {
  assert.match(facade, /ownerSaveAdPlacement as ownerSaveAdPlacementBase/);
  assert.match(facade, /const result = await ownerSaveAdPlacementBase\(\.\.\.args\)/);
  assert.match(facade, /if \(result\.ok\) invalidateActiveAdPlacementCache\(\)/);
});

test("admin UI validates ad image dimensions/ratio and adds change + remove buttons", () => {
  assert.match(route, /validateAdPlacementImageDimensions/);
  assert.match(route, /readImageDimensions/);
  assert.match(route, /validateAdPlacementImageFile/);
  assert.match(route, /{text\("تغيير الصورة", "Change image"\)}/);
  assert.match(route, /{text\("إزالة الصورة المحددة", "Remove selected image"\)}/);
  assert.match(route, /clearImage\(\)/);
  assert.match(route, /~16:7 ratio/);
});

test("ad placement image contract exposes required dimensions and ratio", () => {
  assert.match(storage, /export const AD_PLACEMENT_IMAGE_MIN_WIDTH/);
  assert.match(storage, /export const AD_PLACEMENT_IMAGE_MIN_HEIGHT/);
  assert.match(storage, /export const AD_PLACEMENT_IMAGE_RATIO/);
  assert.match(storage, /export function validateAdPlacementImageDimensions/);
});
