import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Saudi posting and search surfaces use the isolated region-city selector", () => {
  const component = read("src/features/locations/SaudiRegionCitySelector.tsx");
  assert.match(component, /data-saudi-region-select/);
  assert.match(component, /data-saudi-city-select/);
  assert.ok(component.includes("selectedGovernorate?.districtsAr"));

  for (const path of [
    "src/routes/add-listing.tsx",
    "src/routes/listings.index.tsx",
    "src/routes/profile/listings.$id.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /SaudiRegionCitySelector/);
    assert.doesNotMatch(source, /CanonicalLocationSelector/);
  }
});

test("Saudi listing filters recover references in the browser when SSR is empty", () => {
  const hook = read("src/features/listings/use-listings-references.ts");
  assert.ok(hook.includes("needsBrowserRecovery"));
  assert.ok(hook.includes("fetchPublicGovernorates()"));
  assert.ok(hook.includes("fetchPublicCategories()"));
  assert.ok(hook.includes("browserRecovery ??"));
  assert.ok(hook.includes("references.categories.length === 0"));
  assert.ok(hook.includes("references.governorates.length === 0"));
});

test("Saudi canonical location defaults never request Syria", () => {
  const levels = read("src/features/locations/use-location-levels.ts");
  const api = read("src/lib/api/location-taxonomy.ts");
  const client = read("src/lib/public-data/cloudflare-client.ts");
  assert.ok(levels.includes('fetchLocationRoots("SA")'));
  assert.ok(!levels.includes("ocha-hdx-cod-ab-syr"));
  assert.ok(!levels.includes('fetchLocationRoots("SY")'));
  assert.match(api, /countryCode = "SA"/);
  assert.match(client, /country = "SA"/);
});

test("Saudi references remain the authoritative region contract", () => {
  const references = read("src/lib/api/references.ts");
  const worker = read("cloudflare/worker/src/index.ts");
  assert.match(references, /result.data.governorates/);
  assert.ok(worker.includes("governorates: (results[2].results"));
});
