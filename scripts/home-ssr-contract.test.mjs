import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");

test("home marketplace data is loaded before render", () => {
  assert.match(home, /createFileRoute\("\/"\)\(\{[\s\S]*loader: async/);
  assert.match(home, /Route\.useLoaderData\(\)/);
  assert.match(home, /fetchPublicListings\(\{\}, null, 18\)/);
  assert.match(home, /fetchPublicCategories\(\)/);
  assert.doesNotMatch(home, /useEffect\(\(\) => \{[\s\S]*fetchPublicListings/);
});

test("featured cards are excluded from latest cards", () => {
  assert.match(home, /const featuredListingIds = new Set/);
  assert.match(home, /!featuredListingIds\.has\(listing\.id\)/);
  assert.match(home, /\.slice\(0, 12\)/);
});
