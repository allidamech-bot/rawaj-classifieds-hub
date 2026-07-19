import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [
  homeRoute,
  homeLoader,
  homeWorlds,
  homeModel,
  categoriesRoute,
  categoriesData,
  legacyLanding,
  taxonomySource,
  references,
  listingsApi,
  packageJson,
  workflow,
  qualityGate,
] = await Promise.all([
  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/public-home-page-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/CategoryWorlds.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/home-category-discovery.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/categories/public-categories-page-data.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/category.$slug.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/taxonomy.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/references.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/home-category-discovery-integrity.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

const transpiledTaxonomy = ts.transpileModule(taxonomySource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const taxonomy = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledTaxonomy).toString("base64")}`
);

function node(overrides) {
  return {
    id: "node",
    parentId: null,
    slug: "node",
    nameAr: "تصنيف",
    nameEn: "Category",
    descriptionAr: null,
    descriptionEn: null,
    iconKey: null,
    sortOrder: 0,
    depth: 0,
    isActive: true,
    isLeaf: false,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: null,
    legacySubcategoryId: null,
    ...overrides,
  };
}

test("home SSR keeps listing and taxonomy discovery reads independent", () => {
  assert.match(homeRoute, /loader: loadPublicHomePageData/);
  assert.match(homeLoader, /fetchPublicListings\(\{\}, null, 18\)/);
  assert.match(homeLoader, /fetchPublicTaxonomyNodes\(\)/);
  assert.match(homeLoader, /fetchPublicCategories\(\)/);
  assert.match(homeLoader, /Promise\.all\(\[/);
  assert.match(homeLoader, /listingLoadFailed: !listingsResult\.ok/);
  assert.match(homeLoader, /categoryLoadFailed:/);
  assert.doesNotMatch(homeRoute, /useEffect[\s\S]*fetchPublicListings/);
});

test("canonical roots are the primary stable home discovery model", () => {
  assert.match(homeLoader, /taxonomyResult\.ok[\s\S]*buildCanonicalHomeCategoryWorlds/);
  assert.match(homeModel, /getTaxonomyRootNodes\(index\)/);
  assert.match(homeModel, /resolveTaxonomyDiscoveryTarget\(index, node\)/);
  assert.match(homeModel, /buildLegacyHomeCategoryWorlds/);
  assert.match(homeModel, /a\.sortOrder - b\.sortOrder/);
  assert.match(homeWorlds, /world\.target\.kind === "directory"/);
  assert.match(homeWorlds, /world\.target\.kind === "legacy"/);
  assert.match(homeWorlds, /to="\/listings"/);
  assert.match(homeWorlds, /to="\/categories"/);
});

test("legacy fallback is limited to supported taxonomy schema absence", () => {
  assert.match(homeLoader, /taxonomyResult\.error\.code === "schema_missing"/);
  assert.match(homeLoader, /taxonomySchemaMissing && categoriesResult\.ok/);
  assert.match(homeLoader, /\(!taxonomyResult\.ok && !taxonomySchemaMissing\)/);
  assert.match(categoriesData, /taxonomyError \?\? \(taxonomyAvailable \? null : categoryError\)/);
  assert.match(categoriesRoute, /taxonomyResult\.error\.code === "schema_missing"/);
});

test("taxonomy discovery distinguishes parent drill-down and exact leaf results", () => {
  const root = node({ id: "root", slug: "vehicles", legacyCategoryId: "cars" });
  const leaf = node({
    id: "leaf",
    parentId: "root",
    slug: "sedans",
    depth: 1,
    isLeaf: true,
    legacyCategoryId: "cars",
    legacySubcategoryId: "sedan",
  });
  const index = taxonomy.buildTaxonomyIndex([leaf, root]);

  assert.deepEqual(taxonomy.resolveTaxonomyDiscoveryTarget(index, root), {
    kind: "directory",
    node: "root",
  });
  assert.deepEqual(taxonomy.resolveTaxonomyDiscoveryTarget(index, leaf), {
    kind: "listings",
    search: { taxonomy: "leaf", category: "cars" },
  });
  assert.deepEqual(taxonomy.resolveTaxonomyFilterScope(index, root), {
    taxonomyNodeIds: ["leaf"],
    legacyScopes: [
      {
        categoryId: "cars",
        subcategoryId: "sedan",
        propertyPurpose: undefined,
        propertyType: undefined,
      },
    ],
  });
});

test("directory navigation is active-only, ancestry-based, normalized, and canonical", () => {
  assert.match(categoriesRoute, /buildTaxonomyIndex\(taxonomyNodes\)/);
  assert.match(categoriesRoute, /getTaxonomyPath\(taxonomyIndex, currentNode\)/);
  assert.match(categoriesRoute, /taxonomyListingUrlSearch\(/);
  assert.match(categoriesRoute, /hasInvalidNode/);
  assert.match(categoriesRoute, /searchTaxonomyNodes\(index, term, currentNode\)/);
  assert.match(categoriesRoute, /z\.string\(\)\.max\(160\)\.optional\(\)/);
  assert.match(taxonomySource, /filterReachableActiveNodes/);
  assert.match(taxonomySource, /node\.isActive/);
  assert.match(taxonomySource, /normalizeTaxonomySearchText/);
  assert.equal(taxonomy.normalizeTaxonomySearchText("  إِعلانات آلية  "), "اعلانات اليه");
  assert.equal(taxonomy.normalizeTaxonomySearchText("  VEHICLES  "), "vehicles");

  const root = node({ id: "root", nameAr: "سيارات", slug: "vehicles" });
  const child = node({
    id: "child",
    parentId: "root",
    depth: 1,
    isLeaf: true,
    nameAr: "سيدان",
    slug: "sedan",
  });
  const other = node({ id: "other", nameAr: "خدمات سيارات", slug: "car-services" });
  const index = taxonomy.buildTaxonomyIndex([other, child, root]);
  assert.deepEqual(
    taxonomy.searchTaxonomyNodes(index, "سيارات", root).map(({ node: match }) => match.id),
    ["root", "child"],
  );
});

test("legacy landing maps only through explicit legacy ids and preserves fallback", () => {
  assert.match(legacyLanding, /createFileRoute\("\/category\/\$slug"\)/);
  assert.match(legacyLanding, /findLegacyCategoryTaxonomyNode/);
  assert.match(legacyLanding, /taxonomyNodeId: taxonomyNode\.id/);
  assert.match(legacyLanding, /: \{ categoryId: category\.id \}/);
  assert.match(legacyLanding, /taxonomyListingUrlSearch\(taxonomySearch\)/);
  assert.match(legacyLanding, /taxonomyResult\.error\.code !== "schema_missing"/);
  assert.doesNotMatch(taxonomySource, /legacyCategoryId[\s\S]{0,80}nameAr ===/);

  const mapped = node({ id: "mapped", legacyCategoryId: "cars" });
  const unrelated = node({ id: "other", legacyCategoryId: "homes", sortOrder: 1 });
  const index = taxonomy.buildTaxonomyIndex([mapped, unrelated]);
  assert.equal(taxonomy.findLegacyCategoryTaxonomyNode(index, "cars")?.id, "mapped");
  assert.equal(taxonomy.findLegacyCategoryTaxonomyNode(index, "missing"), undefined);
});

test("public discovery reads remain privacy-safe, cached, and deduplicate dual matches", () => {
  assert.match(references, /from\("taxonomy_nodes"\)[\s\S]*\.select\([\s\S]*legacy_subcategory_id/);
  assert.match(references, /const publicTaxonomyCache = new WeakMap/);
  assert.match(references, /readCachedPublicReference\(client, publicTaxonomyCache/);
  assert.doesNotMatch(
    references.match(/fetchPublicTaxonomyNodes[\s\S]*?\n\}/)?.[0] ?? "",
    /select\("\*"\)/,
  );
  assert.match(listingsApi, /\.eq\("status", "approved"\)/);
  assert.match(listingsApi, /\.is\("archived_at", null\)/);
  assert.match(listingsApi, /publicListingExpiryFilter\(\)/);
  assert.match(listingsApi, /buildTaxonomyFilterExpression/);
  assert.match(listingsApi, /new Set\(/);
  assert.doesNotMatch(
    [homeLoader, categoriesData, legacyLanding].join("\n"),
    /service_role|auth\.admin|owner_listing/i,
  );
});

test("home listing sections remain deterministic and non-overlapping", () => {
  assert.match(homeRoute, /const featuredListingIds = new Set/);
  assert.match(homeRoute, /!featuredListingIds\.has\(listing\.id\)/);
  assert.match(homeRoute, /selectDiverseListings/);
  assert.match(homeRoute, /<CategoryWorlds worlds=\{categoryWorlds\}/);
  assert.doesNotMatch(homeRoute, /useEffect/);
});

test("the permanent contract is wired into read-only automation", () => {
  const scripts = JSON.parse(packageJson).scripts;
  assert.equal(
    scripts["test:home-category-discovery"],
    "node --test scripts/home-category-discovery-integrity.test.mjs",
  );
  assert.match(scripts.check, /npm run test:home-category-discovery/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run test:home-category-discovery/);
  assert.match(workflow, /npm run typecheck/);
  assert.doesNotMatch(workflow, /contents: write|service_role|supabase db|deploy|git push/i);
  assert.match(qualityGate, /Home and Category Discovery Integrity contract/);
  assert.match(qualityGate, /npm run test:home-category-discovery/);
});

test("phase does not add geolocation, radius, production writes, or migrations", () => {
  const combined = [
    homeRoute,
    homeLoader,
    homeWorlds,
    homeModel,
    categoriesRoute,
    legacyLanding,
  ].join("\n");
  assert.doesNotMatch(combined, /navigator\.geolocation|getCurrentPosition|radius/i);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  assert.doesNotMatch(workflow, /migration|production|supabase/i);
});
