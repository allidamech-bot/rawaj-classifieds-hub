import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [categoryRoute, governorateRoute, landingPage, categoryWorlds, sitemap, packageJson, qualityGate] =
  await Promise.all([
    readFile(new URL("../src/routes/category.$slug.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/syria.$slug.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/seo/MarketplaceLandingPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/CategoryWorlds.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/sitemap[.]xml.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  ]);

test("category landing pages resolve active categories and expose canonical SEO", () => {
  assert.match(categoryRoute, /createFileRoute\("\/category\/\$slug"\)/);
  assert.match(categoryRoute, /fetchPublicCategories/);
  assert.match(categoryRoute, /fetchPublicListings\(\{ category: category\.slug \}/);
  assert.match(categoryRoute, /path: loaderData \? `\/category\/\$\{loaderData\.category\.slug\}`/);
  assert.match(categoryRoute, /noindex: !loaderData/);
});

test("governorate landing pages resolve active governorates and expose canonical SEO", () => {
  assert.match(governorateRoute, /createFileRoute\("\/syria\/\$slug"\)/);
  assert.match(governorateRoute, /fetchPublicGovernorates/);
  assert.match(governorateRoute, /fetchPublicListings\(\{ governorate: governorate\.id \}/);
  assert.match(governorateRoute, /path: loaderData \? `\/syria\/\$\{loaderData\.governorate\.slug\}`/);
  assert.match(governorateRoute, /noindex: !loaderData/);
});

test("landing pages provide useful marketplace content rather than redirect-only SEO pages", () => {
  assert.match(landingPage, /<h1/);
  assert.match(landingPage, /<h2/);
  assert.match(landingPage, /<RealListingCard/);
  assert.match(landingPage, /to="\/listings"/);
  assert.match(categoryWorlds, /to="\/category\/\$slug"/);
  assert.match(categoryWorlds, /params=\{\{ slug: category\.slug \}\}/);
});

test("sitemap discovers every active category and governorate landing page", () => {
  assert.match(sitemap, /from\("categories"\).*select\("slug"\)/s);
  assert.match(sitemap, /from\("governorates"\).*select\("slug"\)/s);
  assert.match(sitemap, /`\/category\/\$\{encodeURIComponent\(row\.slug\)\}`/);
  assert.match(sitemap, /`\/syria\/\$\{encodeURIComponent\(row\.slug\)\}`/);
});

test("Batch 8 remains part of package and Quality Gate checks", () => {
  assert.match(packageJson, /"test:launch-readiness-batch-8"/);
  assert.match(qualityGate, /Launch readiness Batch 8 contract/);
  assert.match(qualityGate, /npm run test:launch-readiness-batch-8/);
});
