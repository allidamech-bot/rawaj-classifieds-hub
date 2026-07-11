import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const offers = await readFile(new URL("../src/routes/offers.tsx", import.meta.url), "utf8");

test("verified price drops are loaded before offers render", () => {
  assert.match(offers, /createFileRoute\("\/offers"\)\(\{[\s\S]*loader: async/);
  assert.match(offers, /Route\.useLoaderData\(\)/);
  assert.match(offers, /fetchActivePriceDropOffers\(30\)/);
  assert.doesNotMatch(offers, /useEffect\(\(\) => \{[\s\S]*fetchActivePriceDropOffers/);
  assert.doesNotMatch(offers, /useState<ListingPriceDropOffer/);
  assert.doesNotMatch(offers, /جاري تحميل التخفيضات الحقيقية/);
});
