import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  publicApi,
  facade,
  slot,
  route,
  storage,
  floatingHeader,
  pageHeader,
  listingMedia,
  routeResolver,
  supabaseClient,
  httpsMigration,
] = await Promise.all([
  readFile(new URL("../src/lib/api/public-ad-placements.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.ad-placements.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/storage.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PageHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listing-detail/ListingMediaExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/ad-placement-route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/migrations/202607190001_enforce_ad_placement_https_urls.sql", import.meta.url),
    "utf8",
  ),
]);

test("public ad placement cache broadcasts explicit invalidation only in browsers", () => {
  assert.match(publicApi, /typeof window === "undefined" \|\| typeof BroadcastChannel === "undefined"/);
  assert.match(publicApi, /broadcastChannel\.postMessage/);
  assert.match(publicApi, /window\.addEventListener\("storage"/);
  assert.match(publicApi, /export function onAdPlacementInvalidation/);
});

test("PublicAdPlacementSlot refetches after an explicit invalidation event", () => {
  assert.ok(
    slot.includes("const unsubscribe = onAdPlacementInvalidation(refreshWhenAvailable);"),
  );
  assert.ok(slot.includes("setFailedImageUrl(null);"));
  assert.ok(slot.includes("requestId !== requestSequence"));
  assert.ok(slot.includes("cancelled = true;"));
  assert.ok(slot.includes("unsubscribe();"));
});

test("scheduled placement refresh is event-driven, cached, low-frequency, and bounded", () => {
  assert.ok(publicApi.includes("const ACTIVE_PLACEMENT_CACHE_TTL_MS = 5 * 60_000;"));
  assert.ok(publicApi.includes("export async function refreshActiveAdPlacements("));
  assert.ok(publicApi.includes("activePlacementCache.delete(cacheKey);"));
  assert.ok(publicApi.includes("activePlacementRequests.delete(cacheKey);"));
  assert.equal(slot.includes("AD_PLACEMENT_SCHEDULE_REFRESH_MS"), false);
  assert.equal(slot.includes("window.setInterval("), false);
  assert.ok(slot.includes("const AD_PLACEMENT_RETRY_LIMIT = 3;"));
  assert.ok(slot.includes("retryAttempt >= AD_PLACEMENT_RETRY_LIMIT"));
  assert.ok(slot.includes("const AD_PLACEMENT_FRESHNESS_REFRESH_MS = 5 * 60_000;"));
  assert.ok(slot.includes("refreshActiveAdPlacements(page, activeDevice)"));
  assert.ok(slot.includes("window.setTimeout(() =>"));
  assert.ok(slot.includes("}, AD_PLACEMENT_FRESHNESS_REFRESH_MS);"));
  assert.ok(slot.includes("clearFreshnessTimer();"));
  assert.ok(slot.includes('window.addEventListener("online", refreshWhenAvailable);'));
  assert.ok(slot.includes('window.addEventListener("focus", refreshWhenAvailable);'));
  assert.ok(slot.includes('document.addEventListener("visibilitychange", refreshWhenAvailable);'));
});

test("public ad placement reads are isolated from account auth transitions", () => {
  assert.match(supabaseClient, /export const publicSupabase/);
  assert.match(supabaseClient, /persistSession: false/);
  assert.match(supabaseClient, /autoRefreshToken: false/);
  assert.match(supabaseClient, /detectSessionInUrl: false/);
  assert.match(supabaseClient, /storageKey: "rawaj-public-read-client"/);
  assert.match(publicApi, /import \{ publicSupabase \} from "@\/lib\/supabase"/);
  assert.match(publicApi, /const client =[\s\S]*publicSupabase/);
});

test("supported routes mount one public ad slot across headers and listing detail media", () => {
  for (const placement of ["home", "search_results", "listing_detail", "categories", "offers"]) {
    assert.match(routeResolver, new RegExp(`return \\"${placement}\\"`));
  }
  assert.match(floatingHeader, /resolveAdPlacementPage\(pathname\)/);
  assert.match(floatingHeader, /<PublicAdPlacementSlot/);
  assert.match(pageHeader, /resolveAdPlacementPage\(pathname\)/);
  assert.match(pageHeader, /resolveTitlePlacement\(title\)/);
  assert.match(pageHeader, /<PublicAdPlacementSlot/);
  assert.match(listingMedia, /<PublicAdPlacementSlot placementPage="listing_detail"/);
});

test("PublicAdPlacementSlot follows mobile and desktop viewport changes", () => {
  assert.match(slot, /window\.matchMedia\(MOBILE_PLACEMENT_QUERY\)/);
  assert.match(slot, /mediaQuery\.addEventListener\("change", syncDevice\)/);
  assert.match(slot, /mediaQuery\.removeEventListener\("change", syncDevice\)/);
  assert.match(slot, /loaded\.device === device/);
  assert.match(slot, /data-placement-device={device}/);
});

test("public ad rendering uses the same 16:7 image contract as admin validation", () => {
  assert.ok(slot.includes("width={1600}"));
  assert.ok(slot.includes("height={700}"));
  assert.ok(slot.includes("aspect-[16/7]"));
  assert.equal(slot.includes("aspect-[3.2/1]"), false);
  assert.equal(slot.includes("aspect-[5/1]"), false);
  assert.match(route, /~16:7 ratio/);
  assert.match(storage, /export const AD_PLACEMENT_IMAGE_RATIO = 16 \/ 7/);
});

test("public ad rendering reserves its frame and preserves a broken-image fallback", () => {
  assert.match(slot, /data-placement-loading="true"/);
  assert.match(slot, /hasResolvedCurrentPlacement/);
  assert.match(slot, /imageFailed \?/);
  assert.match(slot, /Promotional advertisement/);
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

test("server-side owner RPC enforces HTTPS image and destination URLs", () => {
  assert.match(httpsMigration, /v_safe_https_pattern constant text/);
  assert.match(httpsMigration, /v_image_url !~\* v_safe_https_pattern/);
  assert.match(httpsMigration, /v_destination_url !~\* v_safe_https_pattern/);
  assert.match(httpsMigration, /security definer/);
  assert.match(httpsMigration, /current_user_has_role\('owner'\)/);
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
