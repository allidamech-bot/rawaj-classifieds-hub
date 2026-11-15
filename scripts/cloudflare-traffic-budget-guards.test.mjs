import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public shell status probes pause in background and back off during outages", async () => {
  const source = await read("src/components/OfflineNotice.tsx");
  assert.match(source, /SYSTEM_STATUS_REFRESH_MS = 5 \* 60_000/);
  assert.match(source, /SYSTEM_STATUS_FAILURE_BACKOFF_MS = 15 \* 60_000/);
  assert.match(source, /document\.visibilityState !== "visible"/);
  assert.match(source, /navigator\.onLine === false/);
  assert.match(source, /requestInFlightRef\.current/);
  assert.match(source, /nextRequestAtRef\.current/);
  assert.match(source, /refreshSystemStatus\(true\)/);
  assert.match(source, /window\.clearInterval\(interval\)/);
});

test("admin notification header avoids hidden-tab traffic and overlapping requests", async () => {
  const source = await read("src/components/shell/FloatingHeader.tsx");
  assert.match(source, /document\.visibilityState !== "visible"/);
  assert.match(source, /navigator\.onLine === false/);
  assert.match(source, /if \(inFlight/);
  assert.match(source, /nextAllowedFetchAt = Date\.now\(\) \+ 5 \* 60_000/);
  assert.match(source, /window\.clearInterval\(timer\)/);
});

test("listing detail SSR reads one bundle and reuses its images and location", async () => {
  const page = await read("src/features/listing-detail/public-listing-detail-page-data.ts");
  const location = await read("src/lib/api/listing-location-read.ts");
  assert.match(page, /fetchCloudflareListingDetail\(listingId\)/);
  assert.match(page, /normalizePublicListingImages\(listingResult\.data\.images, listing\)/);
  assert.match(page, /fetchPublicListingLocationPath\(listing\.id, listing\)/);
  assert.doesNotMatch(page, /fetchListingImages\(/);
  assert.match(location, /existingListing\?: Pick<ClassifiedListing/);
  assert.match(location, /existingListing\s*\?\s*\{ ok: true as const/);
});

test("references have short failure cooldown and successful data remain cached", async () => {
  const source = await read("src/lib/public-data/cloudflare-client.ts");
  assert.match(source, /REFERENCE_CACHE_TTL_MS = 5 \* 60_000/);
  assert.match(source, /REFERENCE_FAILURE_COOLDOWN_MS = 30_000/);
  assert.match(source, /referenceCache\.expiresAt = Date\.now\(\) \+ REFERENCE_FAILURE_COOLDOWN_MS/);
  assert.doesNotMatch(source, /referenceCache = null/);
});

test("link preload avoids tiny hover gestures triggering Worker traffic", async () => {
  const router = await read("src/router.tsx");
  assert.match(router, /defaultPreload: "intent"/);
  assert.match(router, /defaultPreloadDelay: 180/);
});
