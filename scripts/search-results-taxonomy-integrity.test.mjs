import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const [
  route,
  pageData,
  schema,
  filters,
  resultsHook,
  paginationHook,
  publicRead,
  publicFields,
  taxonomy,
  categoriesRoute,
  savedSearches,
  savedSearchGuard,
  savedNormalization,
  toolbar,
  workflow,
  qualityGate,
  migrations,
] = await Promise.all([
  readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listings/public-listings-page-data.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/features/listings/listings-search-schema.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/listings-filters.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/use-listings-results.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/use-listings-pagination.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/public-fields.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/taxonomy.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/saved-searches.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/saved-searches-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/saved-search-normalization.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/search/SearchResultsToolbar.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/search-results-taxonomy-integrity.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  readdir(new URL("../supabase/migrations/", import.meta.url)),
]);

test("listing search URL state is canonical, bounded, and self-healing", () => {
  assert.match(schema, /cleanText/);
  assert.match(schema, /safeNumber/);
  assert.match(schema, /safeUuid/);
  assert.match(schema, /Number\.isFinite\(parsed\) && parsed >= 0/);
  assert.match(schema, /\.catch\("latest"\)/);
  assert.match(schema, /priceMin > priceMax/);
  assert.match(schema, /district: search\.location \? `@\$\{search\.location\}`/);
  assert.match(filters, /q: debouncedQ \|\| undefined/);
  assert.match(route, /replace: true/);
});

test("canonical taxonomy parents resolve leaf descendants and safe legacy scopes", () => {
  assert.match(taxonomy, /export function getTaxonomyLeafDescendants/);
  assert.match(taxonomy, /export function resolveTaxonomyFilterScope/);
  assert.match(taxonomy, /resolveTaxonomyListingSearch\(leaf, path\)/);
  assert.match(taxonomy, /taxonomyNodeIds: leaves\.map/);
  assert.match(pageData, /resolveTaxonomyFilterScope\(taxonomyIndex, selectedTaxonomyNode\)/);
  assert.match(filters, /taxonomyLegacyScopes: taxonomyFilterScope\?\.legacyScopes/);
  assert.match(categoriesRoute, /const canOpenCurrentLevel = currentListingSearch !== null/);
  assert.match(publicRead, /listing_taxonomy_assignments/);
  assert.match(publicRead, /buildTaxonomyFilterExpression/);
  assert.match(publicRead, /category_id\.eq/);
  assert.doesNotMatch(route + pageData, /assignOwnerListingTaxonomy|updateOwnerListing/);
});

test("public results apply all filters at the data source", () => {
  for (const contract of [
    /\.eq\("status", "approved"\)/,
    /\.is\("archived_at", null\)/,
    /publicListingExpiryFilter\(\)/,
    /\.eq\("subcategory_id"/,
    /\.eq\("governorate_id"/,
    /\.gte\("price"/,
    /\.lte\("price"/,
    /\.eq\("price_type"/,
    /\.eq\("listing_condition"/,
    /applyCategoryFilters\(query, filters\)/,
  ]) {
    assert.match(publicRead, contract);
  }
  assert.match(publicRead, /resolveCanonicalLocationIds/);
  assert.match(publicRead, /location_node_id\.in/);
  assert.match(publicRead, /location_node_id\.is\.null,governorate_id\.eq/);
  assert.match(publicRead, /withPhotos/);
});

test("text search is normalized, escaped, and limited to public title/description", () => {
  const resultsRead = publicRead.slice(
    publicRead.indexOf("export async function fetchPublicListings("),
    publicRead.indexOf("async function hydrateSavedTaxonomyFilter"),
  );
  assert.match(publicRead, /normalizeArabicSearchTerm/);
  assert.match(publicRead, /supportsNormalizedListingSearch/);
  assert.match(publicRead, /escapePostgrestSearchTerm/);
  assert.match(publicRead, /title\.ilike/);
  assert.match(publicRead, /description\.ilike/);
  assert.doesNotMatch(resultsRead, /email|rejection_reason|details->>phone|details->>whatsapp/);
  assert.doesNotMatch(publicFields, /,details,/);
});

test("results use explicit schema and clear incompatible category filters only", () => {
  assert.match(route, /resolveCategoryFieldKind\(selectedTaxonomyNode, selectedCategory\)/);
  assert.match(route, /categoryUsesGlobalCondition\(categoryFieldKind\)/);
  assert.doesNotMatch(route, /detectCategoryFieldKind/);
  assert.match(route, /prevDraftFieldKindRef/);
  assert.match(route, /if \(prev === "vehicles"\)/);
  assert.match(route, /if \(prev === "real_estate"\)/);
  assert.match(route, /if \(prev === "electronics"\)/);
  assert.match(route, /if \(prev === "jobs"\)/);
});

test("sorting, pagination, and stale responses preserve result integrity", () => {
  assert.match(publicRead, /order\("created_at"/);
  assert.match(publicRead, /order\("price"/);
  assert.match(publicRead, /order\("is_featured"/);
  assert.match(publicRead, /order\("id"/);
  assert.match(publicRead, /encodeListingCursor|nextCursor/);
  assert.match(resultsHook, /filterVersionRef/);
  assert.match(resultsHook, /let cancelled = false/);
  assert.match(resultsHook, /version !== filterVersionRef\.current/);
  assert.match(paginationHook, /loadingMoreRef\.current/);
  assert.match(route, /new Set\(prev\.map\(\(item\) => item\.id\)\)/);
});

test("mobile filters are draft-first and current URL state is saveable", () => {
  assert.match(route, /filtersOpen/);
  assert.match(route, /buildListingsMobileApplySearch/);
  assert.match(resultsHook, /filterDraftActive/);
  assert.match(toolbar, /savedSearch/);
  assert.match(toolbar, /to="\/saved-searches"/);
  assert.match(route, /taxonomy: selectedTaxonomyNode\?\.id/);
});

test("saved searches normalize, deduplicate, reopen, and retain alerts", () => {
  assert.match(savedNormalization, /normalizeSavedSearchFilters/);
  assert.match(savedNormalization, /\.sort\(\(\[left\], \[right\]\)/);
  assert.match(savedSearchGuard, /normalizeSavedSearchFilters\(payload\.filters\)/);
  assert.match(savedSearches, /rawaj_create_my_saved_search_v2/);
  assert.match(savedSearches, /p_filters: filters/);
  assert.match(savedSearches, /p_alert_frequency: payload\.alertFrequency/);
  assert.match(savedSearches, /rawaj_record_saved_search_alert_match/);
  assert.match(publicRead, /hydrateSavedTaxonomyFilter/);
});

test("public cards receive explicit aliases without contact or full details", () => {
  assert.match(route, /<RealListingCard key=\{listing\.id\} listing=\{listing\}/);
  assert.match(publicFields, /categoryDetailKeys\.map/);
  assert.match(publicFields, /detail_taxonomy_node_id/);
  assert.doesNotMatch(publicFields, /details->>phone|details->>whatsapp/);
  assert.match(route, /ListingCardSkeleton/);
  assert.match(route, /SearchEmptyState/);
});

test("workflow is permanent, read-only, and Phase 8 adds no migration", () => {
  assert.match(workflow, /name: Search Results Taxonomy Integrity Contract/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(workflow, /node --test scripts\/search-results-taxonomy-integrity\.test\.mjs/);
  assert.match(qualityGate, /name: Search Results Taxonomy Integrity contract/);
  assert.match(
    qualityGate,
    /run: node --test scripts\/search-results-taxonomy-integrity\.test\.mjs/,
  );
  assert.equal(
    migrations.some((name) => /phase.?8|search.?results.?taxonomy/i.test(name)),
    false,
  );
  assert.doesNotMatch(route + pageData, /\.insert\(|\.update\(|\.delete\(/);
});
