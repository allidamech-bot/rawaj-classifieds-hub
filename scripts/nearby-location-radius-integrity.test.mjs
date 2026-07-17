import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [helper, geolocation, api, migration, ledger] = await Promise.all([
  readFile(new URL("../src/lib/nearby-location.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/nearby-geolocation.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/nearby-listings.ts", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/202607170005_nearby_location_radius_integrity.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
]);

const returnSignature = migration.match(/returns table \(([\s\S]*?)\)\s*language sql/)?.[1] ?? "";

test("nearby coordinates are rounded and radius is allowlisted", () => {
  assert.match(helper, /NEARBY_RADIUS_OPTIONS_KM = \[5, 10, 25, 50, 100\]/);
  assert.match(helper, /COORDINATE_PRECISION = 2/);
  assert.match(api, /roundNearbyPoint\(request\.point\)/);
  assert.match(api, /normalizeNearbyRadius\(request\.radiusKm\)/);
});

test("geolocation remains optional and privacy-conscious", () => {
  assert.match(geolocation, /enableHighAccuracy: false/);
  assert.match(geolocation, /maximumAge: 5 \* 60 \* 1000/);
  assert.match(geolocation, /permission_denied/);
  assert.doesNotMatch(geolocation, /localStorage/);
  assert.doesNotMatch(geolocation, /analytics/);
});

test("database computes distance without exposing coordinates", () => {
  assert.match(migration, /rawaj_public_nearby_listing_matches/);
  assert.match(migration, /round\(user_latitude::numeric, 2\)/);
  assert.match(migration, /6371\.0088 \* 2 \* asin/);
  assert.match(returnSignature, /listing_id uuid/);
  assert.match(returnSignature, /distance_km double precision/);
  assert.doesNotMatch(returnSignature, /latitude/);
  assert.doesNotMatch(returnSignature, /longitude/);
});

test("nearby hydration reauthorizes public listing visibility", () => {
  assert.match(api, /\.eq\("status", "approved"\)/);
  assert.match(api, /\.is\("archived_at", null\)/);
  assert.match(api, /publicListingExpiryFilter\(\)/);
  assert.match(api, /publicListingSelect/);
  assert.match(api, /hydrateListingsWithPrimaryImages/);
});

test("repository migration ledger records phase 17", () => {
  assert.match(ledger, /202607170005_nearby_location_radius_integrity\.sql/);
});
