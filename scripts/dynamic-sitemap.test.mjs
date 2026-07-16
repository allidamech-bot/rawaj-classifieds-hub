import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const sitemap = await readFile(new URL("../src/routes/sitemap[.]xml.ts", import.meta.url), "utf8");

test("sitemap serves an XML index and cacheable XML shards", () => {
  assert.match(sitemap, /createFileRoute\("\/sitemap\.xml"\)/);
  assert.match(sitemap, /GET: async \(\{ request \}/);
  assert.match(sitemap, /buildSitemapIndexXml/);
  assert.match(sitemap, /<sitemapindex xmlns=/);
  assert.match(sitemap, /Content-Type": "application\/xml; charset=utf-8"/);
  assert.match(sitemap, /Cache-Control/);
  assert.match(sitemap, /escapeXml/);
});

test("sitemap scales by exact public count instead of silently stopping at ten thousand", () => {
  assert.match(sitemap, /SITEMAP_PAGE_SIZE = 1_000/);
  assert.match(sitemap, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(sitemap, /Math\.ceil\(listingCount \/ SITEMAP_PAGE_SIZE\)/);
  assert.match(sitemap, /section=\$\{encodeURIComponent\(section\)\}&page=\$\{page\}/);
  assert.doesNotMatch(sitemap, /maxRows\s*=\s*10_000/);
});

test("every marketplace shard keeps the public visibility contract", () => {
  assert.match(sitemap, /\.eq\("status", "approved"\)/);
  assert.match(sitemap, /\.is\("archived_at", null\)/);
  assert.match(sitemap, /publicListingExpiryFilter\(\)/);
  assert.match(sitemap, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(sitemap, /\.range\(offset, offset \+ SITEMAP_PAGE_SIZE - 1\)/);
  assert.doesNotMatch(sitemap, /service_role|SUPABASE_SERVICE_ROLE|auth\.admin/);
});

test("marketplace shards publish listings and eligible sellers with lastmod", () => {
  assert.match(sitemap, /`\/listings\/\$\{encodeURIComponent\(row\.id\)\}`/);
  assert.match(sitemap, /`\/seller\/\$\{encodeURIComponent\(ownerId\)\}`/);
  assert.match(sitemap, /lastmod: toIsoDate/);
  assert.match(sitemap, /sellerLastModified/);
});

test("reference failures do not produce a silently incomplete cached sitemap", () => {
  assert.match(sitemap, /throw categoriesResult\.error/);
  assert.match(sitemap, /throw governoratesResult\.error/);
  assert.match(sitemap, /public_sitemap_render_failed/);
  assert.match(sitemap, /status: 503/);
  assert.match(sitemap, /Retry-After": "300"/);
});

test("legacy static sitemap no longer shadows the server route", async () => {
  await assert.rejects(access(new URL("../public/sitemap.xml", import.meta.url)));
});
