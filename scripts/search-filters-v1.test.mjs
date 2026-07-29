import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  root,
  routeStyles,
  route,
  categories,
  schema,
  filters,
  api,
  toolbar,
  quickFilters,
  sheet,
  empty,
  css,
  cssV2,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/listings-search-schema.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/listings-filters.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/search/SearchResultsToolbar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/search/QuickFilterRail.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/search/FilterBottomSheet.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/search/SearchEmptyState.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/search-filters-v1.css", import.meta.url), "utf8"),
  readFile(new URL("../src/search-filters-v2.css", import.meta.url), "utf8"),
]);

test("search and filter styles load after adaptive listing cards", () => {
  assert.match(routeStyles, /import searchFiltersV1Css from "\.\.\/search-filters-v1\.css\?url";/);
  const cardsIndex = root.indexOf("href: adaptiveListingCardsCss");
  const searchIndex = root.indexOf("routeStyleHrefs.searchFiltersV1");
  assert.notEqual(cardsIndex, -1);
  assert.notEqual(searchIndex, -1);
  assert.ok(searchIndex > cardsIndex);
});

test("listing URL schema supports presentation mode and real image filtering", () => {
  assert.match(schema, /listingsViewValues = \["grid", "list"\]/);
  assert.match(schema, /view: z\.enum\(listingsViewValues\)\.optional\(\)/);
  assert.match(
    schema,
    /with_photos: z\.preprocess\(parseBooleanParam, z\.boolean\(\)\.optional\(\)\)/,
  );
  assert.match(filters, /with_photos: withPhotos \|\| undefined/);
  assert.match(filters, /view: view === "grid" \? undefined : view/);
});

test("image-only search is enforced by the public listing query", () => {
  assert.match(api, /filters\.withPhotos/);
  assert.match(api, /listing_images!inner\(id\)/);
  assert.match(api, /\.select\(listingSelect\)/);
});

test("results use compact toolbar, contextual quick filters, and URL-backed view modes", () => {
  assert.match(route, /<SearchResultsToolbar/);
  assert.match(route, /<QuickFilterRail/);
  assert.match(route, /data-view=\{view\}/);
  assert.match(toolbar, /onViewChange\("grid"\)/);
  assert.match(toolbar, /onViewChange\("list"\)/);
  assert.match(toolbar, /data-view-foundation="map"/);
  assert.match(toolbar, /to="\/saved-searches"/);
  assert.match(quickFilters, /With photos/);
  assert.match(quickFilters, /Newest/);
});

test("filter sheet stays fixed while only the options area scrolls", () => {
  assert.match(route, /if \(!referencesLoaded \|\| filtersOpen\) return/);
  assert.match(route, /restoreFilterDraftFromSearch/);
  assert.match(route, /handleFilterSheetOpenChange/);
  assert.match(route, /<FilterBottomSheet/);
  assert.doesNotMatch(route, /fixed inset-0 z-50 bg-background/);

  assert.match(sheet, /dismissible=\{false\}/);
  assert.match(sheet, /handleOnly/);
  assert.match(sheet, /data-scroll-mode="content"/);
  assert.match(sheet, /data-vaul-no-drag/);
  assert.match(sheet, /overflowY: "auto"/);
  assert.match(sheet, /touchAction: "pan-y"/);
  assert.match(sheet, /rawaj-filter-sheet__footer/);
  assert.match(sheet, /Apply and show results/);
  assert.doesNotMatch(sheet, /snapPoints=/);
  assert.doesNotMatch(sheet, /activeSnapPoint/);
});

test("filters stay category aware and hide irrelevant fields", () => {
  assert.match(route, /draftCategoryFieldKind !== "general"/);
  assert.match(route, /<CategorySpecificFilterFields/);
  assert.match(route, /showCondition=\{categoryFieldKind === "electronics"\}/);
  assert.match(route, /<FilterCategoryGrid/);
});

test("categories retain taxonomy behavior inside a spatial directory", () => {
  assert.match(categories, /rawaj-categories-v2/);
  assert.match(categories, /rawaj-categories-v2__hero/);
  assert.match(categories, /rawaj-category-directory-grid/);
  assert.match(categories, /rawaj-category-directory-card/);
  assert.match(categories, /fetchPublicTaxonomyNodes\(\)/);
  assert.match(categories, /taxonomyListingUrlSearch/);
});

test("category directory load failures can retry all reference reads in place", () => {
  assert.match(categories, /const \[loadAttempt, setLoadAttempt\] = useState\(0\)/);
  assert.match(categories, /async function load\(\)[\s\S]*?try \{[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(categories, /operation: "categories_retry_load"/);
  assert.match(categories, /if \(!cancelled\) setLoading\(false\)/);
  assert.match(categories, /\}, \[loadAttempt, text\]\);/);
  assert.match(categories, /actionLabel=\{text\("إعادة المحاولة", "Try again"\)\}/);
  assert.match(categories, /setLoadAttempt\(\(attempt\) => attempt \+ 1\)/);
  assert.match(categories, /onClick=\{onAction\}/);
  assert.doesNotMatch(categories, /window\.location\.reload\(\)/);
});

test("empty results provide useful next actions", () => {
  assert.match(route, /<SearchEmptyState/);
  assert.match(empty, /to="\/categories"/);
  assert.match(empty, /to="\/add-listing"/);
  assert.match(empty, /onReset/);
});

test("search presentation is responsive, safe-area aware, and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-results-grid\[data-view="list"\]/);
  assert.match(cssV2, /data-scroll-mode="content"/);
  assert.match(cssV2, /overflow-y: auto !important/);
  assert.match(cssV2, /touch-action: pan-y !important/);
  assert.match(cssV2, /env\(safe-area-inset-bottom\)/);
  assert.match(cssV2, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssV2, /scroll-behavior: auto/);
});
