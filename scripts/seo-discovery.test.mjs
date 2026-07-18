import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seoPath = new URL("../src/lib/seo.ts", import.meta.url);
const robotsPath = new URL("../public/robots.txt", import.meta.url);
const sitemapPath = new URL("../src/routes/sitemap[.]xml.ts", import.meta.url);

const [seo, robots, sitemap] = await Promise.all([
  readFile(seoPath, "utf8"),
  readFile(robotsPath, "utf8"),
  readFile(sitemapPath, "utf8"),
]);

test("canonical URLs are production safe and require an explicit route path", () => {
  assert.match(seo, /const fallbackSiteUrl = "https:\/\/rawa-j\.com"/);
  assert.doesNotMatch(seo, /fallbackSiteUrl = "http:\/\/localhost:3000"/);
  assert.match(seo, /links: options\.path \? \[\{ rel: "canonical", href: url \}\] : \[\]/);
});

test("robots advertises the sitemap and keeps private workspaces out of crawl", () => {
  assert.match(robots, /Sitemap: https:\/\/rawa-j\.com\/sitemap\.xml/);
  for (const path of ["/admin", "/profile", "/chats", "/activity", "/notifications"]) {
    assert.match(robots, new RegExp(`Disallow: ${path.replace("/", "\\/")}(?:\\n|$)`));
  }
});

test("dynamic sitemap keeps stable public routes and excludes private workspaces", () => {
  assert.match(sitemap, /createFileRoute\("\/sitemap\.xml"\)/);

  for (const path of ["/", "/listings", "/categories"]) {
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(sitemap, new RegExp(`absoluteUrl\\("${escapedPath}"\\)`));
  }

  for (const privatePath of ["/admin", "/profile", "/chats", "/activity", "/notifications"]) {
    const escapedPath = privatePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.doesNotMatch(sitemap, new RegExp(`absoluteUrl\\("${escapedPath}"\\)`));
  }

  assert.doesNotMatch(sitemap, /localhost/i);
});
