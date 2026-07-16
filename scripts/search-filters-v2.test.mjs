import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, routeStyles, toolbar, css, gate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/search/SearchResultsToolbar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/search-filters-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("Search and Filters V2 loads after V1 and before desktop overrides", () => {
  assert.match(routeStyles, /searchFiltersV2Css/);
  const v1 = root.indexOf("routeStyleHrefs.searchFiltersV1");
  const v2 = root.indexOf("routeStyleHrefs.searchFiltersV2");
  const desktop = root.indexOf("href: desktopExperienceV1Css");
  assert.ok(v2 > v1);
  assert.ok(desktop > v2);
});

test("search toolbar supports recovery and keyboard-first discovery", () => {
  assert.match(toolbar, /RECENT_SEARCHES_KEY/);
  assert.match(toolbar, /window\.localStorage/);
  assert.match(toolbar, /event\.key === "\/"/);
  assert.match(toolbar, /rawaj-search-toolbar__clear-query/);
  assert.match(toolbar, /rawaj-recent-searches/);
  assert.match(toolbar, /aria-haspopup="dialog"/);
});

test("recent searches are bounded and do not require backend state", () => {
  assert.match(toolbar, /MAX_RECENT_SEARCHES = 5/);
  assert.match(toolbar, /typeof window === "undefined"/);
  assert.doesNotMatch(toolbar, /supabase|fetch\(|axios/i);
});

test("V2 visual layer is responsive, safe-area aware, and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-search-toolbar-v2/);
  assert.match(css, /position: sticky/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width: 389px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /margin-left|margin-right|padding-left|padding-right/);
});

test("quality gate permanently runs Search and Filters V2 read-only", () => {
  assert.match(gate, /contents: read/);
  assert.match(gate, /Search and Filters V2 contract/);
  assert.match(gate, /node --test scripts\/search-filters-v2\.test\.mjs/);
  assert.doesNotMatch(gate, /contents: write/);
});
