import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  home,
  homeData,
  categories,
  categoryData,
  listings,
  listingData,
  listingReferences,
  listingResults,
] = await Promise.all([
  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/public-home-page-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/categories/public-categories-page-data.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/listings.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listings/public-listings-page-data.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/features/listings/use-listings-references.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/use-listings-results.ts", import.meta.url), "utf8"),
]);

test("home marketplace data is loaded before render", () => {
  assert.match(home, /createFileRoute\("\/"\)\(\{[\s\S]*loader: loadPublicHomePageData/);
  assert.match(home, /Route\.useLoaderData\(\)/);
  assert.match(homeData, /fetchPublicListings\(\{\}, null, 18\)/);
  assert.match(homeData, /fetchPublicTaxonomyNodes\(\)/);
  assert.match(homeData, /fetchPublicCategories\(\)/);
  assert.match(homeData, /buildCanonicalHomeCategoryWorlds/);
  assert.match(homeData, /taxonomyResult\.error\.code === "schema_missing"/);
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
  assert.match(categories, /const \[loading, setLoading\] = useState\(false\)/);
  assert.match(categoryData, /Promise\.all\(\[/);
  assert.match(categoryData, /fetchPublicTaxonomyNodes\(\)/);
  assert.match(categoryData, /fetchPublicCategories\(\)/);
  assert.match(categoryData, /fetchPublicSubcategories\(\)/);
});

test("listing results SSR is filter-aware and uses public APIs only", () => {
  assert.match(listings, /loaderDeps: \(\{ search \}\) => search/);
  assert.match(listings, /loader: \(\{ deps, location \}\) =>/);
  assert.match(listings, /loadPublicListingsPageData\(deps\)/);
  assert.match(listings, /location\.pathname === "\/listings"/);
  assert.match(listingData, /buildListingFilters\(\{/);
  assert.match(listingData, /fetchPublicListings\(filters, null, 30\)/);
  assert.match(listingData, /searchPublicSellers\(search\.q\?\.trim\(\) \?\? ""\)/);
  assert.match(
    listingData,
    /\.id === categorySearchValue \|\| category\.slug === categorySearchValue/,
  );
  assert.match(listingData, /\.id === search\.gov \|\| governorate\.slug === search\.gov/);
  assert.doesNotMatch(listingData, /service_role|SUPABASE_SERVICE_ROLE|auth\.admin/);
});

test("listing hooks hydrate from SSR data instead of an empty loading shell", () => {
  assert.match(listingReferences, /getRouteApi\("\/listings"\)/);
  assert.match(listingReferences, /references\.categories/);
  assert.match(listingReferences, /loading: false/);
  assert.match(listingResults, /getRouteApi\("\/listings"\)/);
  assert.match(listingResults, /initialResults\.items/);
  assert.match(listingResults, /initialResults\.filterKey/);
  assert.match(listingResults, /lastCompletedFilterKeyRef/);
});
