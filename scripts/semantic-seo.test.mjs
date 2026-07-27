import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seoPath = new URL("../src/lib/seo.ts", import.meta.url);
const rootPath = new URL("../src/routes/__root.tsx", import.meta.url);
const listingPath = new URL("../src/routes/listings.$id.tsx", import.meta.url);
const listingStructuredDataPath = new URL("../src/lib/listing-structured-data.ts", import.meta.url);

const [seo, rootRoute, listingRoute, listingStructuredData] = await Promise.all([
  readFile(seoPath, "utf8"),
  readFile(rootPath, "utf8"),
  readFile(listingPath, "utf8"),
  readFile(listingStructuredDataPath, "utf8"),
]);

test("site structured data exposes organization, website and real listings search", () => {
  assert.match(seo, /"@type": "Organization"/);
  assert.match(seo, /"@type": "WebSite"/);
  assert.match(seo, /"@type": "SearchAction"/);
  assert.match(seo, /\?q=\{search_term_string\}/);
  assert.match(seo, /"query-input": "required name=search_term_string"/);
});

test("root leaves canonical ownership to the active public route", () => {
  assert.doesNotMatch(rootRoute, /\.\.\.seo\.links/);
  assert.match(rootRoute, /jsonLdScript\(buildSiteStructuredData\(\)\)/);
});

test("not-found metadata is noindex and does not reuse the home canonical", () => {
  assert.match(rootRoute, /<title>\{text\("الصفحة غير موجودة \| رواج"/);
  assert.match(rootRoute, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.doesNotMatch(rootRoute, /NotFoundComponent[\s\S]*rel="canonical"/);
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
  assert.match(listingRoute, /\?category=\$\{encodeURIComponent\(categoryId\)\}/);
  assert.match(listingRoute, /path: `\/listings\/\$\{listing\.id\}`/);
});

test("listing structured data uses honest category-specific schema types", () => {
  assert.match(listingStructuredData, /return "RealEstateListing"/);
  assert.match(listingStructuredData, /return "Vehicle"/);
  assert.match(listingStructuredData, /return "JobPosting"/);
  assert.match(listingStructuredData, /return "Service"/);
  assert.match(listingStructuredData, /return "Product"/);
  assert.match(listingRoute, /buildListingStructuredData\([\s\S]*categoryFieldKind/);
  assert.match(listingStructuredData, /publicSeoDescription\(listing\.description, 300\)/);
});

test("listing offer availability reflects reservation state", () => {
  assert.match(listingStructuredData, /listing\.reservedAt/);
  assert.match(listingStructuredData, /https:\/\/schema\.org\/LimitedAvailability/);
  assert.match(listingStructuredData, /https:\/\/schema\.org\/InStock/);
});

test("job postings do not inherit commerce offers", () => {
  assert.match(listingStructuredData, /kind !== "jobs" && listing\.price !== null/);
  assert.match(listingStructuredData, /employmentType/);
  assert.match(listingStructuredData, /validThrough/);
});
