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
  adminAdApi,
  storage,
  studioImageValidation,
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
  readFile(new URL("../src/lib/api/ad-placements-cloudflare.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/storage.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-studio-image-validation.ts", import.meta.url), "utf8"),
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

test("public and admin ad media share one 1600:700 presentation contract", () => {
  assert.match(auditCss, /\.rawaj-ad-placement__frame/);
  assert.match(auditCss, /aspect-ratio: 16 \/ 7/);
  assert.match(slot, /width=\{1600\}/);
  assert.match(slot, /height=\{700\}/);
  assert.match(adminAdApi, /AD_PLACEMENT_TARGET_WIDTH = 1600/);
  assert.match(adminAdApi, /AD_PLACEMENT_TARGET_HEIGHT = 700/);
  assert.match(adminAdApi, /-1600x700\.webp/);
  assert.match(storage, /AD_PLACEMENT_IMAGE_MIN_WIDTH = 960/);
  assert.match(storage, /AD_PLACEMENT_IMAGE_MIN_HEIGHT = 420/);
  assert.match(storage, /AD_PLACEMENT_IMAGE_RATIO = 16 \/ 7/);
});

test("public ad slot refresh stays bounded and broken media fails independently", () => {
  assert.doesNotMatch(slot, /AD_PLACEMENT_SCHEDULE_REFRESH_MS/);
  assert.doesNotMatch(slot, /window\.setInterval\(/);
  assert.match(slot, /AD_PLACEMENT_RETRY_BASE_MS = 2_000/);
  assert.match(slot, /AD_PLACEMENT_RETRY_MAX_MS = 15_000/);
  assert.match(slot, /AD_PLACEMENT_RETRY_LIMIT = 3/);
  assert.match(slot, /AD_PLACEMENT_FRESHNESS_REFRESH_MS = 5 \* 60_000/);
  assert.match(slot, /failedImageUrls\.has\(placement\.imageUrl\)/);
  assert.match(slot, /onError=\{\(\) => markImageFailed\(placement\.imageUrl\)\}/);
  assert.match(slot, /rawaj-ad-placement__backdrop/);
  assert.match(slot, /rawaj-ad-placement__image/);
});

test("public ad API deduplicates and caches Cloudflare Worker reads for five minutes", () => {
  assert.match(api, /ACTIVE_PLACEMENT_CACHE_TTL_MS = 5 \* 60_000/);
  assert.match(api, /activePlacementCache/);
  assert.match(api, /activePlacementRequests/);
  assert.match(api, /const pending = activePlacementRequests\.get\(cacheKey\)/);
  assert.match(api, /if \(pending\) return pending/);
  assert.match(api, /fetchCloudflareAdPlacements\(placementPage, device\)/);
  assert.match(
    cloudflareClient,
    /requestJson<CloudflarePublicAdPlacement\[]>\("\/v1\/ad-placements"/,
  );
  assert.match(cloudflareClient, /imageUrl: absoluteMediaUrl\(placement\.imageUrl\)/);
});

test("draft and paused ad creative is not exposed by the managed public media layer", () => {
  assert.doesNotMatch(managedMedia, /publicAdPlacementMedia/);
  assert.doesNotMatch(managedMedia, /object_key LIKE 'ad-placements\/%'/);
  assert.match(managedMedia, /const adminImages = path\.match/);
  assert.match(managedMedia, /const adminAsset = path\.match/);
  assert.match(managedMedia, /hasModeratorRole/);
});

test("owner ad previews use authenticated blobs but save the original media reference", () => {
  assert.match(authenticatedMedia, /export async function resolveOwnedMediaPreviewUrl/);
  assert.match(authenticatedMedia, /\/v1\/account\/media\/assets\//);
  assert.match(authenticatedMedia, /typeof window !== "undefined"/);
  assert.match(authenticatedMedia, /cloudflareAuthorizedFetch\(path\)/);
  assert.match(authenticatedMedia, /URL\.createObjectURL\(blob\)/);
  assert.match(adminAdApi, /resolveOwnedMediaPreviewUrl/);
  assert.match(adminAdApi, /persistedUrlByPreviewUrl/);
  assert.match(adminAdApi, /rememberPersistedMediaUrl/);
  assert.match(adminAdApi, /imageUrl: persistedMediaUrl\(payload\.imageUrl\)/);
  assert.match(adminAdApi, /imageUrl: await ownerPreviewUrl\(placement\.imageUrl\)/);
});

test("listing photos accept up to the Worker limit while ad creative remains capped at 5MB", () => {
  assert.match(storage, /MAX_IMAGE_SIZE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(storage, /MAX_AD_PLACEMENT_IMAGE_SIZE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(studioImageValidation, /MAX_LISTING_IMAGE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(studioImageValidation, /حجم الصورة يتجاوز 8MB/);
});

test("protected listing images continue to resolve through authenticated media", () => {
  assert.match(listingImageGuard, /resolveAuthenticatedMediaUrl/);
  assert.match(listingImageGuard, /cloudflareApiRequest<Record<string, unknown>\[]>/);
  assert.match(listingCardImage, /resolveAuthenticatedMediaUrl\(src\)/);
  assert.match(resilientImage, /resolveAuthenticatedMediaUrl\(source\)/);
});
