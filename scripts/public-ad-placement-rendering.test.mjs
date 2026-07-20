import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [header, routeResolver, slot, api] = await Promise.all([
  readFile(new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/ad-placement-route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/public-ad-placements.ts", import.meta.url), "utf8"),
]);

test("supported marketplace pages resolve to their ad placement inventory", () => {
  for (const placement of ["home", "search_results", "listing_detail", "categories", "offers"]) {
    assert.match(routeResolver, new RegExp(`return \"${placement}\"`));
  }
  assert.match(routeResolver, /export function resolveAdPlacementPage/);
  assert.match(header, /resolveAdPlacementPage\(pathname\)/);
  assert.match(header, /PublicAdPlacementSlot/);
});

test("public ad slot loads device-targeted active placements and renders one banner", () => {
  assert.match(slot, /MOBILE_PLACEMENT_QUERY = "\(max-width: 767px\)"/);
  assert.match(slot, /window\.matchMedia\(MOBILE_PLACEMENT_QUERY\)/);
  assert.match(slot, /fetchActiveAdPlacements\(page, activeDevice\)/);
  assert.match(slot, /placement: result\.data\[0\] \?\? null/);
  assert.match(slot, /rel="noopener noreferrer sponsored"/);
});

test("public ad slot preserves the accepted 16:7 frame and resilient refresh behavior", () => {
  assert.match(slot, /aspect-\[16\/7\]/);
  assert.match(slot, /AD_PLACEMENT_SCHEDULE_REFRESH_MS = 30_000/);
  assert.match(slot, /AD_PLACEMENT_RETRY_BASE_MS = 1_500/);
  assert.match(slot, /AD_PLACEMENT_RETRY_MAX_MS = 30_000/);
  assert.match(slot, /refreshActiveAdPlacements\(page, activeDevice\)/);
  assert.match(slot, /onAdPlacementInvalidation\(\(\) => load\(\)\)/);
});

test("broken public ad media is replaced while preserving stable banner dimensions", () => {
  assert.match(slot, /useState<string \| null>\(null\)/);
  assert.match(slot, /failedImageUrl === placement\.imageUrl/);
  assert.match(slot, /onError=\{\(\) => setFailedImageUrl\(placement\.imageUrl\)\}/);
  assert.match(slot, /loading="eager"/);
  assert.match(slot, /decoding="async"/);
  assert.match(slot, /width=\{1600\}/);
  assert.match(slot, /height=\{700\}/);
  assert.match(slot, /draggable=\{false\}/);
});

test("public ad API deduplicates active-placement reads and repairs media URLs", () => {
  assert.match(api, /ACTIVE_PLACEMENT_CACHE_TTL_MS = 60_000/);
  assert.match(api, /activePlacementCache/);
  assert.match(api, /activePlacementRequests/);
  assert.match(api, /const pending = activePlacementRequests\.get\(cacheKey\)/);
  assert.match(api, /if \(pending\) return pending/);
  assert.match(api, /rawaj_fetch_active_ad_placements/);
  assert.match(api, /normalizeAdPlacementMediaUrl/);
  assert.match(api, /p_placement_page: placementPage/);
  assert.match(api, /p_device: device/);
});
