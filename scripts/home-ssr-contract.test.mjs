import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [home, categories, categoryData, listings, listingData, listingReferences, listingResults] =
  await Promise.all([
    readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/categories/public-categories-page-data.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/listings/public-listings-page-data.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/features/listings/use-listings-references.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/listings/use-listings-results.ts", import.meta.url), "utf8"),
  ]);

test("home marketplace data is loaded before render", () => {
  assert.match(home, /createFileRoute\("\/"\)\(\{[\s\S]*loader: async/);
  assert.match(home, /Route\.useLoaderData\(\)/);
  assert.match(home, /fetchPublicListings\(\{\}, null, 18\)/);
  assert.match(home, /fetchPublicCategories\(\)/);
  assert.doesNotMatch(home, /useEffect\(\(\) => \{[\s\S]*fetchPublicListings/);
});

test("featured cards are excluded from latest cards and category diversity is preserved", () => {
  assert.match(home, /const featuredListingIds = new Set/);
  assert.match(home, /!featuredListingIds\.has\(listing\.id\)/);
  assert.match(home, /selectDiverseListings\(/);
  assert.match(home, /12,\s*2,/);
});

test("category discovery data is present in the initial HTML contract", () => {
  assert.match(categories, /loader: loadPublicCategoriesPageData/);
  assert.match(categories, /const initialData = Route\.useLoaderData\(\)/);
  assert.match(categories, /useState<TaxonomyNode\[]>\(\s*initialData\.taxonomyNodes/);
  assert.match(categories, /useState<ClassifiedCategory\[]>\(initialData\.categories\)/);
  assert.match(categories, /useState\(false\)/);
  assert.match(categoryData, /Promise\.all\(\[/);
  assert.match(categoryData, /fetchPublicTaxonomyNodes\(\)/);
  assert.match(categoryData, /fetchPublicCategories\(\)/);
  assert.match(categoryData, /fetchPublicSubcategories\(\)/);
});

test("listing results SSR is filter-aware and uses public APIs only", () => {
  assert.match(listings, /loaderDeps: \(\{ search \}\) => search/);
  assert.match(listings, /loader: \(\{ deps \}\) => loadPublicListingsPageData\(deps\)/);
  assert.match(listingData, /buildListingFilters\(\{/);
  assert.match(listingData, /fetchPublicListings\(filters, null, 30\)/);
  assert.match(listingData, /searchPublicSellers\(search\.q\?\.trim\(\) \?\? ""\)/);
  assert.match(listingData, /\.id === categorySearchValue \|\| category\.slug === categorySearchValue/);
  assert.match(listingData, /\.id === search\.gov \|\| governorate\.slug === search\.gov/);
  assert.doesNotMatch(listingData, /service_role|SUPABASE_SERVICE_ROLE|auth\.admin/);
});

test("listing hooks hydrate from SSR data instead of an empty loading shell", () => {
  assert.match(listingReferences, /getRouteApi\("\/listings\/"\)/);
  assert.match(listingReferences, /initialReferences\.categories/);
  assert.match(listingReferences, /useState\(false\)/);
  assert.match(listingResults, /initialResults\.items/);
  assert.match(listingResults, /initialResults\.filterKey/);
  assert.match(listingResults, /lastCompletedFilterKeyRef/);
});
