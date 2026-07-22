import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const config = read("src/lib/public-data/config.ts");
const client = read("src/lib/public-data/cloudflare-client.ts");
const references = read("src/lib/api/references.ts");
const listings = read("src/lib/api/location-aware-listings-v2.ts");
const detail = read("src/lib/api/listing-detail-read-guarded.ts");
const images = read("src/lib/api/listing-images-read-guarded.ts");
const placements = read("src/lib/api/public-ad-placements.ts");
const workerEntry = read("cloudflare/worker/src/entry.ts");
const workerListings = read("cloudflare/worker/src/public-listings.ts");
const wrangler = read("cloudflare/worker/wrangler.base.jsonc");

test("public data provider is selected explicitly and defaults safely", () => {
  assert.match(config, /VITE_PUBLIC_DATA_PROVIDER/);
  assert.match(config, /VITE_PUBLIC_DATA_API_BASE_URL/);
  assert.match(config, /"supabase"/);
  assert.match(config, /configuredProvider === "cloudflare"/);
  assert.match(config, /https:/);
  assert.doesNotMatch(config, /catch[\s\S]*provider\s*=\s*"supabase"/);
});

test("Cloudflare client has bounded requests and no Supabase dependency", () => {
  assert.match(client, /REQUEST_TIMEOUT_MS/);
  assert.match(client, /AbortController/);
  assert.match(client, /credentials:\s*"omit"/);
  assert.doesNotMatch(client, /unsupportedCloudflareFilters/);
  assert.doesNotMatch(client, /@supabase\/supabase-js/);
  assert.doesNotMatch(client, /publicSupabase|supabase\.from|createClient/);
});

test("all public marketplace surfaces use the explicit provider boundary", () => {
  for (const source of [references, listings, detail, images, placements]) {
    assert.match(source, /isCloudflarePublicDataProvider/);
    assert.doesNotMatch(source, /catch[\s\S]{0,500}fetch.*Supabase/i);
  }
  assert.match(listings, /There is deliberately no silent cross-provider fallback/);
});

test("Cloudflare public API coverage includes references, listings, detail, media and placements", () => {
  for (const endpoint of [
    "/v1/references",
    "/v1/ad-placements",
    "/v1/listings",
    "/v1/listings/",
  ]) {
    assert.ok(client.includes(endpoint), `missing client endpoint ${endpoint}`);
  }
  assert.match(client, /absoluteMediaUrl/);
  assert.match(client, /encodeWorkerCursor/);
  assert.match(client, /decodeWorkerCursor/);
});

test("advanced listing filters are carried end-to-end into bound D1 predicates", () => {
  for (const filter of [
    "legacyScope",
    "carMake",
    "carModel",
    "yearFrom",
    "yearTo",
    "fuelType",
    "transmission",
    "taxonomyPropertyPurpose",
    "taxonomyPropertyType",
    "rooms",
    "rentalDuration",
    "electronicsBrand",
    "detailCondition",
    "employmentType",
    "salaryType",
  ]) {
    assert.ok(client.includes(filter), `client does not transmit ${filter}`);
  }

  assert.match(workerListings, /json_extract\(l\.details/);
  assert.match(workerListings, /WITH RECURSIVE location_scope/);
  assert.match(workerListings, /listing_taxonomy_assignments/);
  assert.match(workerListings, /legacyScopes/);
  assert.match(workerListings, /\.bind\(\.\.\.values\)/);
  assert.doesNotMatch(
    workerListings,
    /\$\{filters\.(?:carMake|carModel|fuelType|transmission|propertyPurpose|propertyType|electronicsBrand|employmentType|salaryType)/,
  );
});

test("modular Worker entry owns listing search without changing other API routes", () => {
  assert.match(workerEntry, /handlePublicListingsRequest/);
  assert.match(workerEntry, /baseWorker\.fetch/);
  assert.match(wrangler, /"main": "src\/entry\.ts"/);
});
