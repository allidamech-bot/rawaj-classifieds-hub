import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [publicApi, facade, slot, route, storage, floatingHeader, pageHeader, routeResolver] =
  await Promise.all([
    readFile(new URL("../src/lib/api/public-ad-placements.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/admin.ad-placements.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/PageHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/ad-placement-route.ts", import.meta.url), "utf8"),
  ]);

test("public ad placement cache broadcasts explicit invalidation across tabs", () => {
  assert.match(publicApi, /BroadcastChannel/);
  assert.match(publicApi, /broadcastChannel\.postMessage/);
  assert.match(publicApi, /window\.addEventListener\("storage"/);
  assert.match(publicApi, /export function onAdPlacementInvalidation/);
});

test("PublicAdPlacementSlot refetches after an explicit invalidation event", () => {
  assert.match(slot, /const unsubscribe = onAdPlacementInvalidation\(\(\) => load\(\)\)/);
  assert.match(slot, /setFailedImageUrl\(null\)/);
  assert.match(slot, /requestId !== requestSequence/);
  assert.match(slot, /cancelled = true;/);
  assert.match(slot, /unsubscribe\(\);/);
});

test("scheduled placement state refreshes locally without broadcasting every poll", () => {
  assert.match(publicApi, /export async function refreshActiveAdPlacements/);
  assert.match(publicApi, /activePlacementCache\.delete\(cacheKey\)/);
  assert.match(publicApi, /activePlacementRequests\.delete\(cacheKey\)/);
  const refreshFunction =
    publicApi.match(/export async function refreshActiveAdPlacements[\s\S]*?\n}/)?.[0] ?? "";
  assert.doesNotMatch(refreshFunction, /postMessage|localStorage|emitAdPlacementInvalidation/);

  assert.match(slot, /AD_PLACEMENT_SCHEDULE_REFRESH_MS = 30_000/);
  assert.match(slot, /window\.setInterval\(/);
  assert.match(slot, /\(\) => load\(true\)/);
  assert.match(slot, /window\.clearInterval\(scheduleRefreshTimer\)/);
});

test("supported routes mount the same public ad slot across both header systems", () => {
  for (const placement of ["home", "search_results", "listing_detail", "categories", "offers"]) {
    assert.match(routeResolver, new RegExp(`return \\"${placement}\\"`));
  }
  assert.match(floatingHeader, /resolveAdPlacementPage\(pathname\)/);
  assert.match(floatingHeader, /<PublicAdPlacementSlot/);
  assert.match(pageHeader, /resolveAdPlacementPage\(pathname\)/);
  assert.match(pageHeader, /<PublicAdPlacementSlot/);
});

test("PublicAdPlacementSlot follows mobile and desktop viewport changes", () => {
  assert.match(slot, /window\.matchMedia\(MOBILE_PLACEMENT_QUERY\)/);
  assert.match(slot, /mediaQuery\.addEventListener\("change", syncDevice\)/);
  assert.match(slot, /mediaQuery\.removeEventListener\("change", syncDevice\)/);
  assert.match(slot, /loaded\.device === device/);
  assert.match(slot, /data-placement-device={device}/);
});

test("public ad rendering uses the same 16:7 image contract as admin validation", () => {
  assert.match(slot, /width=\{1600\}/);
  assert.match(slot, /height=\{700\}/);
  assert.match(slot, /aspect-\[16\/7\]/);
  assert.doesNotMatch(slot, /aspect-\[3\.2\/1\]/);
  assert.doesNotMatch(slot, /aspect-\[5\/1\]/);
  assert.match(route, /~16:7 ratio/);
  assert.match(storage, /export const AD_PLACEMENT_IMAGE_RATIO = 16 \/ 7/);
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
