import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8");
const categories = await readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8");
const listings = await readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8");
const more = await readFile(new URL("../src/routes/more.tsx", import.meta.url), "utf8");

test("core marketplace pages use the canonical width contract", () => {
  assert.match(home, /PageContainer className="rawaj-home-v3 rawaj-content-stack/);
  assert.match(categories, /container-wide mobile-page-bottom/);
  assert.match(listings, /container-wide mobile-page-bottom/);
  assert.match(more, /container-wide mobile-page-bottom/);
});

test("core page routes do not introduce one-off max-width utilities", () => {
  for (const source of [home, categories, listings, more]) {
    assert.doesNotMatch(source, /max-w-\[(?:7|8|9)\drem\]/);
  }
});
