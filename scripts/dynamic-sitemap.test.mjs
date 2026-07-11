import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const sitemap = await readFile(new URL("../src/routes/sitemap[.]xml.ts", import.meta.url), "utf8");

test("sitemap is served dynamically as XML", () => {
  assert.match(sitemap, /createFileRoute\("\/sitemap\.xml"\)/);
  assert.match(sitemap, /server: \{[\s\S]*handlers: \{[\s\S]*GET: async/);
  assert.match(sitemap, /Content-Type": "application\/xml; charset=utf-8"/);
  assert.match(sitemap, /Cache-Control/);
  assert.match(sitemap, /escapeXml/);
});

test("sitemap contains only current public marketplace records", () => {
  assert.match(sitemap, /\.eq\("status", "approved"\)/);
  assert.match(sitemap, /\.is\("archived_at", null\)/);
  assert.match(sitemap, /publicListingExpiryFilter\(\)/);
  assert.match(sitemap, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(sitemap, /maxRows = 10_000/);
});

test("sitemap publishes listing and eligible seller URLs with lastmod", () => {
  assert.match(sitemap, /`\/listings\/\$\{encodeURIComponent\(row\.id\)\}`/);
  assert.match(sitemap, /`\/seller\/\$\{encodeURIComponent\(ownerId\)\}`/);
  assert.match(sitemap, /lastmod: toIsoDate/);
  assert.match(sitemap, /sellerLastModified/);
});

test("legacy static sitemap no longer shadows the server route", async () => {
  await assert.rejects(access(new URL("../public/sitemap.xml", import.meta.url)));
});
