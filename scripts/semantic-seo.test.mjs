import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seoPath = new URL("../src/lib/seo.ts", import.meta.url);
const rootPath = new URL("../src/routes/__root.tsx", import.meta.url);
const listingPath = new URL("../src/routes/listings.$id.tsx", import.meta.url);

const [seo, rootRoute, listingRoute] = await Promise.all([
  readFile(seoPath, "utf8"),
  readFile(rootPath, "utf8"),
  readFile(listingPath, "utf8"),
]);

test("site structured data exposes organization, website and real listings search", () => {
  assert.match(seo, /"@type": "Organization"/);
  assert.match(seo, /"@type": "WebSite"/);
  assert.match(seo, /"@type": "SearchAction"/);
  assert.match(seo, /\?q=\{search_term_string\}/);
  assert.match(seo, /"query-input": "required name=search_term_string"/);
});

test("root keeps canonical links and emits site structured data", () => {
  assert.match(rootRoute, /\.\.\.seo\.links/);
  assert.match(rootRoute, /jsonLdScript\(buildSiteStructuredData\(\)\)/);
});

test("breadcrumb helper preserves route order and absolute item URLs", () => {
  assert.match(seo, /"@type": "BreadcrumbList"/);
  assert.match(seo, /position: index \+ 1/);
  assert.match(seo, /item: absoluteUrl\(item\.path\)/);
});

test("listing detail emits breadcrumb structured data with real route targets", () => {
  assert.match(listingRoute, /buildBreadcrumbStructuredData/);
  assert.match(listingRoute, /path: "\/listings"/);
  assert.match(listingRoute, /\?category=\$\{encodeURIComponent\(listing\.categoryId\)\}/);
  assert.match(listingRoute, /path: `\/listings\/\$\{listing\.id\}`/);
});

test("listing offer availability reflects reservation state", () => {
  assert.match(listingRoute, /listing\.reservedAt/);
  assert.match(listingRoute, /https:\/\/schema\.org\/LimitedAvailability/);
  assert.match(listingRoute, /https:\/\/schema\.org\/InStock/);
});
