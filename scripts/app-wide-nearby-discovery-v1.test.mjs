import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [preferences, hook, control, geolocation, nearbyApi] = await Promise.all([
  readFile(new URL("../src/lib/nearby-preferences.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/use-nearby-discovery.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/NearbyDiscoveryControl.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/nearby-geolocation.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/nearby-listings.ts", import.meta.url), "utf8"),
]);

test("nearby preference stores only consent and radius", () => {
  assert.match(preferences, /enabled: preference\.enabled/);
  assert.match(preferences, /radiusKm: preference\.radiusKm/);
  assert.doesNotMatch(preferences, /latitude|longitude|point|coords/i);
  assert.match(preferences, /VALID_RADII.*5, 10, 25, 50, 100/s);
});

test("saved nearby preference restores with a fresh position", () => {
  assert.match(hook, /readNearbyDiscoveryPreference\(\)/);
  assert.match(hook, /locateAndLoad\(false, preference\.radiusKm\)/);
  assert.match(hook, /requestNearbyPosition\(\)/);
  assert.match(hook, /clearNearbyDiscoveryPreference\(\)/);
  assert.doesNotMatch(hook, /watchPosition/);
});

test("nearby results remain server-filtered and distance ordered", () => {
  assert.match(nearbyApi, /fetchNearbyPublicListings/);
  assert.match(nearbyApi, /radiusKm/);
  assert.match(nearbyApi, /distanceKm/);
  assert.match(geolocation, /roundNearbyPoint/);
});

test("nearby control explains privacy, refresh and disable actions", () => {
  assert.match(control, /الإعلانات الأقرب إليك/);
  assert.match(control, /ولا نحفظ إحداثياتك/);
  assert.match(control, /تحديث الموقع/);
  assert.match(control, /تعطيل القريب/);
  assert.match(control, /5, 10, 25, 50, 100/);
});
