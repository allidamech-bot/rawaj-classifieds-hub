import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seoPath = new URL("../src/lib/seo.ts", import.meta.url);
const robotsPath = new URL("../public/robots.txt", import.meta.url);
const sitemapPath = new URL("../public/sitemap.xml", import.meta.url);

const [seo, robots, sitemap] = await Promise.all([
  readFile(seoPath, "utf8"),
  readFile(robotsPath, "utf8"),
  readFile(sitemapPath, "utf8"),
]);

test("canonical fallback is production safe and never defaults to localhost", () => {
  assert.match(seo, /const fallbackSiteUrl = "https:\/\/rawa-j\.com"/);
  assert.doesNotMatch(seo, /fallbackSiteUrl = "http:\/\/localhost:3000"/);
  assert.match(seo, /links: \[\{ rel: "canonical", href: url \}\]/);
});

test("robots advertises the sitemap and keeps private workspaces out of crawl", () => {
  assert.match(robots, /Sitemap: https:\/\/rawa-j\.com\/sitemap\.xml/);
  for (const path of ["/admin", "/profile", "/chats", "/activity", "/notifications"]) {
    assert.match(robots, new RegExp(`Disallow: ${path.replace("/", "\\/")}(?:\\n|$)`));
  }
});

test("sitemap contains only stable public discovery routes", () => {
  for (const url of [
    "https://rawa-j.com/",
    "https://rawa-j.com/listings",
    "https://rawa-j.com/categories",
  ]) {
    assert.match(sitemap, new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>`));
  }

  for (const privatePath of ["/admin", "/profile", "/chats", "/activity", "/notifications"]) {
    assert.doesNotMatch(sitemap, new RegExp(`<loc>[^<]*${privatePath}`));
  }

  assert.doesNotMatch(sitemap, /localhost/i);
});
