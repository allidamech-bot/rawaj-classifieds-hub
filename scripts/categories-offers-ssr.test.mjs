import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [categories, offers] = await Promise.all([
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/offers.tsx", import.meta.url), "utf8"),
]);

test("category directory data is loaded before render with taxonomy fallback", () => {
  assert.match(categories, /createFileRoute\("\/categories"\)\(\{[\s\S]*loader: async/);
  assert.match(categories, /Route\.useLoaderData\(\)/);
  assert.match(categories, /fetchPublicTaxonomyNodes\(\)/);
  assert.match(categories, /fetchPublicCategories\(\)/);
  assert.match(categories, /fetchPublicSubcategories\(\)/);
  assert.match(categories, /taxonomyResult\.error\.code === "schema_missing"/);
  assert.doesNotMatch(categories, /useEffect\(\(\) => \{[\s\S]*fetchPublicTaxonomyNodes/);
});

test("verified price drops are loaded before offers render", () => {
  assert.match(offers, /createFileRoute\("\/offers"\)\(\{[\s\S]*loader: async/);
  assert.match(offers, /Route\.useLoaderData\(\)/);
  assert.match(offers, /fetchActivePriceDropOffers\(30\)/);
  assert.doesNotMatch(offers, /useEffect\(\(\) => \{[\s\S]*fetchActivePriceDropOffers/);
  assert.doesNotMatch(offers, /جاري تحميل التخفيضات الحقيقية/);
});
