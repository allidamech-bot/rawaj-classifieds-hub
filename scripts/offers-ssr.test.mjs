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

test("offers load errors retry the route loader in place with a single-flight guard", () => {
  assert.match(offers, /useRouter\(\)/);
  assert.match(offers, /const retryInFlightRef = useRef\(false\)/);
  assert.match(offers, /const \[retrying, setRetrying\] = useState\(false\)/);
  assert.match(offers, /async function retryOffers[\s\S]*?await router\.invalidate\(\)[\s\S]*?finally/);
  assert.match(offers, /actionLabel=\{text\("إعادة المحاولة", "Try again"\)\}/);
  assert.match(offers, /onAction=\{\(\) => void retryOffers\(\)\}/);
  assert.match(offers, /actionDisabled=\{retrying\}/);
  assert.match(offers, /disabled=\{actionDisabled\}/);
  assert.match(offers, /aria-busy=\{actionDisabled\}/);
  assert.doesNotMatch(offers, /body=\{error\.message\}/);
  assert.doesNotMatch(offers, /window\.location\.reload\(\)/);
});
