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
    assert.match(routeResolver, new RegExp(`return "${placement}"`));
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

test("public ad slot preserves the accepted 16:7 frame with bounded event-driven refresh", () => {
  assert.match(slot, /aspect-\[16\/7\]/);
  assert.doesNotMatch(slot, /AD_PLACEMENT_SCHEDULE_REFRESH_MS/);
  assert.doesNotMatch(slot, /window\.setInterval\(/);
  assert.match(slot, /AD_PLACEMENT_RETRY_BASE_MS = 2_000/);
  assert.match(slot, /AD_PLACEMENT_RETRY_MAX_MS = 15_000/);
  assert.match(slot, /AD_PLACEMENT_RETRY_LIMIT = 3/);
  assert.match(slot, /retryAttempt >= AD_PLACEMENT_RETRY_LIMIT/);
  assert.match(slot, /onAdPlacementInvalidation\(refreshWhenAvailable\)/);
  assert.match(slot, /window\.addEventListener\("online", refreshWhenAvailable\)/);
  assert.match(slot, /window\.addEventListener\("focus", refreshWhenAvailable\)/);
  assert.match(slot, /document\.addEventListener\("visibilitychange", refreshWhenAvailable\)/);
});

test("broken public ad media is replaced while preserving stable banner dimensions", () => {
  assert.match(slot, /useState<string \| null>\(null\)/);
  assert.match(slot, /failedImageUrl === placement\.imageUrl/);
  assert.match(slot, /onError=\{\(\) => setFailedImageUrl\(placement\.imageUrl\)\}/);
  assert.match(slot, /loading=\{placementPage === "home" \? "eager" : "lazy"\}/);
  assert.match(slot, /decoding="async"/);
  assert.match(slot, /width=\{1600\}/);
  assert.match(slot, /height=\{700\}/);
  assert.match(slot, /draggable=\{false\}/);
});

test("public ad API deduplicates and caches active-placement reads for five minutes", () => {
  assert.match(api, /ACTIVE_PLACEMENT_CACHE_TTL_MS = 5 \* 60_000/);
  assert.match(api, /activePlacementCache/);
  assert.match(api, /activePlacementRequests/);
  assert.match(api, /const pending = activePlacementRequests\.get\(cacheKey\)/);
  assert.match(api, /if \(pending\) return pending/);
  assert.match(api, /rawaj_fetch_active_ad_placements/);
  assert.match(api, /normalizeAdPlacementMediaUrl/);
  assert.match(api, /p_placement_page: placementPage/);
  assert.match(api, /p_device: device/);
});
