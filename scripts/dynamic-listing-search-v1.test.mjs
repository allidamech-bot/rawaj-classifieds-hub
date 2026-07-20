import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const facetsMigration = await readFile(
  "supabase/migrations/202607190041_dynamic_listing_facets_repair_v1.sql",
  "utf8",
);
const searchMigration = await readFile(
  "supabase/migrations/202607190042_dynamic_listing_search_page_v1.sql",
  "utf8",
);
const facetsClient = await readFile("src/lib/api/listing-facets.ts", "utf8");
const searchClient = await readFile("src/lib/api/dynamic-listing-search.ts", "utf8");
const hydrationClient = await readFile("src/lib/api/dynamic-filtered-listings.ts", "utf8");
const listingApi = await readFile("src/lib/api/listings.ts", "utf8");
const filterState = await readFile(
  "src/features/listings/listing-attribute-filter-state.ts",
  "utf8",
);
const filterComponent = await readFile(
  "src/features/listings/DynamicListingFacetFilters.tsx",
  "utf8",
);
const searchSchema = await readFile(
  "src/features/listings/listings-search-schema.ts",
  "utf8",
);
const resultsHook = await readFile("src/features/listings/use-listings-results.ts", "utf8");
const paginationHook = await readFile("src/features/listings/use-listings-pagination.ts", "utf8");
const route = await readFile("src/routes/listings.index.tsx", "utf8");
const toolbar = await readFile("src/features/search/SearchResultsToolbar.tsx", "utf8");

test("dynamic search applies governed fields for every published leaf", () => {
  assert.match(searchMigration, /taxonomy_field_rules/);
  assert.match(searchMigration, /field_row\.is_filterable/);
  assert.match(searchMigration, /not field_row\.is_sensitive/);
  assert.match(searchMigration, /listing_attribute_values/);
  assert.match(searchMigration, /p_attribute_filters/);
  assert.doesNotMatch(searchMigration, /category_id\s*=\s*['"]vehicles['"]/i);
});

test("dynamic search returns stable pages and an exact total", () => {
  assert.match(searchMigration, /totalCount/);
  assert.match(searchMigration, /listingIds/);
  assert.match(searchMigration, /nextCursor/);
  assert.match(searchMigration, /latest/);
  assert.match(searchMigration, /featured/);
  assert.match(searchMigration, /cheapest/);
  assert.match(searchMigration, /expensive/);
  assert.match(searchMigration, /v_page_size \+ 1/);
});

test("dynamic search hydrates through the public listing allowlist", () => {
  assert.match(searchClient, /rawaj_public_listing_search_page_v1/);
  assert.match(hydrationClient, /publicListingSelect/);
  assert.match(hydrationClient, /sanitizePublicListing/);
  assert.match(hydrationClient, /hydrateListingsWithPrimaryImages/);
  assert.match(listingApi, /hasDynamicListingFilters/);
  assert.match(listingApi, /fetchDynamicFilteredPublicListings/);
  assert.doesNotMatch(hydrationClient, /select\(["'`]\*["'`]\)/);
});

test("URL and saved-search state preserve bounded governed filters", () => {
  assert.match(filterState, /MAX_FILTER_FIELDS = 50/);
  assert.match(filterState, /MAX_ENCODED_LENGTH = 6000/);
  assert.match(filterState, /encodeListingAttributeFilters/);
  assert.match(filterState, /parseListingAttributeFilters/);
  assert.match(searchSchema, /attrs: cleanAttributeFilters/);
  assert.match(toolbar, /attrs: ""/);
  assert.match(route, /encodedAttributeFilters/);
  assert.match(route, /attrs: encodedAttributeFilters/);
});

test("results and pagination carry the same attribute filter object", () => {
  assert.match(resultsHook, /filterInputs\.attributeFilters/);
  assert.match(paginationHook, /attributeFilters/);
  assert.match(route, /attributeFilters,/);
  assert.match(route, /totalCount/);
});

test("facets render generically on desktop and mobile", () => {
  assert.match(facetsClient, /rawaj_public_listing_facets_v1/);
  assert.match(filterComponent, /data-dynamic-listing-facets="all-categories"/);
  assert.match(filterComponent, /facet\.fieldType === "multi_select"/);
  assert.match(filterComponent, /onChange\(selected \? undefined : option\.valueKey\)/);
  assert.match(route, /DynamicListingFacetFilters/);
  assert.match(route, /تفاصيل القسم/);
  assert.doesNotMatch(filterComponent, /carMake|vehicleMake|vehicles-only/i);
});

test("public dynamic search functions are read-only and pinned", () => {
  for (const migration of [facetsMigration, searchMigration]) {
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = public, pg_temp/i);
    assert.match(migration, /grant execute[\s\S]*to anon, authenticated/i);
    assert.doesNotMatch(migration, /\binsert\s+into\b/i);
    assert.doesNotMatch(migration, /\bupdate\s+public\./i);
    assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  }
});
