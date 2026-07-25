import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [worker, entry, publicListings, cloudflareClient, facets, nearby, sitemap, draft, dynamicSearch, dynamicHydration] = await Promise.all([
  read("cloudflare/worker/src/discovery.ts"),
  read("cloudflare/worker/src/entry.ts"),
  read("cloudflare/worker/src/public-listings.ts"),
  read("src/lib/public-data/cloudflare-client.ts"),
  read("src/lib/api/listing-facets.ts"),
  read("src/lib/api/nearby-listings.ts"),
  read("src/routes/sitemap[.]xml.ts"),
  read("src/lib/api/draft-recovery.ts"),
  read("src/lib/api/dynamic-listing-search.ts"),
  read("src/lib/api/dynamic-filtered-listings.ts"),
]);

test("discovery clients and sitemap are Cloudflare-only", () => {
  for (const source of [facets, nearby, sitemap, draft, dynamicSearch, dynamicHydration]) {
    assert.doesNotMatch(source, /@supabase\/supabase-js|\bgetClient\b|\.rpc\(|\.from\(["']|\.storage\b/);
  }
  assert.match(facets, /fetchCloudflareListingFacets/);
  assert.match(nearby, /fetchCloudflareNearbyListings/);
  assert.match(sitemap, /fetchCloudflareSitemapCount/);
});

test("generic dynamic attribute filters are encoded and safely bound", () => {
  assert.match(cloudflareClient, /attrs:/);
  assert.match(publicListings, /decodeAttributeFilters/);
  assert.match(publicListings, /applyAttributeFilters/);
  assert.match(publicListings, /json_extract\(l\.details, \?\)/);
  assert.match(publicListings, /\^\[A-Za-z0-9_\.-\]/);
});

test("facets use governed field definitions and option labels", () => {
  assert.match(worker, /field_definitions/);
  assert.match(worker, /is_filterable = 1/);
  assert.match(worker, /option_values/);
  assert.match(worker, /filter_schema_key/);
});

test("nearby search applies a bounding box and exact haversine distance", () => {
  assert.match(worker, /n\.latitude BETWEEN \? AND \?/);
  assert.match(worker, /n\.longitude BETWEEN \? AND \?/);
  assert.match(worker, /haversine/);
  assert.match(worker, /distanceKm <= radius/);
});

test("sitemap only exposes approved non-archived non-expired listings", () => {
  assert.match(worker, /status = 'approved'/);
  assert.match(worker, /archived_at IS NULL/);
  assert.match(worker, /expires_at IS NULL OR expires_at/);
  assert.match(worker, /\/v1\/sitemap\/references/);
  assert.match(worker, /\/v1\/sitemap\/listings/);
});

test("entry owns discovery routes before listing and the final 404", () => {
  const discovery = entry.indexOf("handleDiscovery(request, env)");
  const publicListingsIndex = entry.indexOf("handlePublicListingsRequest(request, env)");
  const finalNotFound = entry.lastIndexOf('code: "not_found"');
  assert.ok(discovery >= 0 && publicListingsIndex > discovery && finalNotFound > publicListingsIndex);
  assert.doesNotMatch(entry, /baseWorker\.fetch/);
});
