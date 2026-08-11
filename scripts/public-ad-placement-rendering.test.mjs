import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  pageHeader,
  routeResolver,
  slot,
  api,
  cloudflareClient,
  auditCss,
  managedMedia,
  authenticatedMedia,
  listingImageGuard,
  listingCardImage,
  resilientImage,
] = await Promise.all([
  readFile(new URL("../src/components/PageHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/ad-placement-route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/public-ad-placements.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/public-data/cloudflare-client.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-audit-corrections-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/worker/src/managed-media.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/authenticated-media-url.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-images-read-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/ListingCardImage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/media/ResilientImage.tsx", import.meta.url), "utf8"),
]);

test("supported marketplace pages resolve to their ad placement inventory", () => {
  for (const placement of ["home", "search_results", "listing_detail", "categories", "offers"]) {
    assert.match(routeResolver, new RegExp(`return "${placement}"`));
  }
  assert.match(routeResolver, /export function resolveAdPlacementPage/);
  assert.match(pageHeader, /resolveAdPlacementPage\(pathname\)/);
  assert.match(pageHeader, /PublicAdPlacementSlot/);
});

test("public ad slot loads device-targeted placements and can render two distinct home banners", () => {
  assert.match(slot, /MOBILE_PLACEMENT_QUERY = "\(max-width: 767px\)"/);
  assert.match(slot, /window\.matchMedia\(MOBILE_PLACEMENT_QUERY\)/);
  assert.match(slot, /fetchActiveAdPlacements\(page, activeDevice\)/);
  assert.match(slot, /function uniquePlacements/);
  assert.match(slot, /const maximum = placementPage === "home" \? 2 : 1/);
  assert.match(slot, /\.slice\(0, maximum\)/);
  assert.match(slot, /rawaj-ad-placement__grid/);
  assert.match(slot, /data-placement-count=\{visiblePlacements\.length\}/);
  assert.match(slot, /rel="noopener noreferrer sponsored"/);
});

test("public ad slot preserves its 1600:700 frame with bounded low-frequency refresh", () => {
  assert.match(auditCss, /\.rawaj-ad-placement__frame/);
  assert.match(auditCss, /aspect-ratio: 16 \/ 7/);
  assert.match(auditCss, /data-count="2"/);
  assert.doesNotMatch(slot, /AD_PLACEMENT_SCHEDULE_REFRESH_MS/);
  assert.doesNotMatch(slot, /window\.setInterval\(/);
  assert.match(slot, /AD_PLACEMENT_RETRY_BASE_MS = 2_000/);
  assert.match(slot, /AD_PLACEMENT_RETRY_MAX_MS = 15_000/);
  assert.match(slot, /AD_PLACEMENT_RETRY_LIMIT = 3/);
  assert.match(slot, /retryAttempt >= AD_PLACEMENT_RETRY_LIMIT/);
  assert.match(slot, /AD_PLACEMENT_FRESHNESS_REFRESH_MS = 5 \* 60_000/);
  assert.match(slot, /refreshActiveAdPlacements\(page, activeDevice\)/);
  assert.match(slot, /window\.setTimeout\([\s\S]*AD_PLACEMENT_FRESHNESS_REFRESH_MS/);
  assert.match(slot, /clearFreshnessTimer\(\)/);
  assert.match(slot, /onAdPlacementInvalidation\(refreshWhenAvailable\)/);
  assert.match(slot, /window\.addEventListener\("online", refreshWhenAvailable\)/);
  assert.match(slot, /window\.addEventListener\("focus", refreshWhenAvailable\)/);
  assert.match(slot, /document\.addEventListener\("visibilitychange", refreshWhenAvailable\)/);
});

test("broken public ad media is removed independently while other placements remain visible", () => {
  assert.match(slot, /useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(slot, /failedImageUrls\.has\(placement\.imageUrl\)/);
  assert.match(slot, /function markImageFailed\(imageUrl: string\)/);
  assert.match(slot, /onError=\{\(\) => markImageFailed\(placement\.imageUrl\)\}/);
  assert.match(slot, /loading=\{placementPage === "home" && index === 0 \? "eager" : "lazy"\}/);
  assert.match(
    slot,
    /fetchPriority=\{placementPage === "home" && index === 0 \? "high" : "auto"\}/,
  );
  assert.match(slot, /rawaj-ad-placement__backdrop/);
  assert.match(slot, /rawaj-ad-placement__image/);
  assert.match(slot, /decoding="async"/);
  assert.match(slot, /width=\{1600\}/);
  assert.match(slot, /height=\{700\}/);
  assert.match(slot, /draggable=\{false\}/);
});

test("public ad API deduplicates and caches Cloudflare Worker reads for five minutes", () => {
  assert.match(api, /ACTIVE_PLACEMENT_CACHE_TTL_MS = 5 \* 60_000/);
  assert.match(api, /activePlacementCache/);
  assert.match(api, /activePlacementRequests/);
  assert.match(api, /const pending = activePlacementRequests\.get\(cacheKey\)/);
  assert.match(api, /if \(pending\) return pending/);
  assert.match(api, /fetchCloudflareAdPlacements\(placementPage, device\)/);
  assert.doesNotMatch(api, /rawaj_fetch_active_ad_placements/);
  assert.match(
    cloudflareClient,
    /requestJson<CloudflarePublicAdPlacement\[]>\("\/v1\/ad-placements"/,
  );
  assert.match(cloudflareClient, /page: placementPage/);
  assert.match(cloudflareClient, /device/);
  assert.match(cloudflareClient, /imageUrl: absoluteMediaUrl\(placement\.imageUrl\)/);
});

test("new ad uploads and protected listing images have renderable media paths", () => {
  assert.match(managedMedia, /object_key LIKE 'ad-placements\/%'/);
  assert.match(managedMedia, /const adminImages = path\.match/);
  assert.match(managedMedia, /const adminAsset = path\.match/);
  assert.match(managedMedia, /hasModeratorRole/);
  assert.match(authenticatedMedia, /cloudflareAuthorizedFetch\(path\)/);
  assert.match(authenticatedMedia, /URL\.createObjectURL\(blob\)/);
  assert.match(listingImageGuard, /resolveAuthenticatedMediaUrl/);
  assert.match(listingImageGuard, /cloudflareApiRequest<Record<string, unknown>\[]>/);
  assert.match(listingCardImage, /resolveAuthenticatedMediaUrl\(src\)/);
  assert.match(resilientImage, /resolveAuthenticatedMediaUrl\(source\)/);
});
