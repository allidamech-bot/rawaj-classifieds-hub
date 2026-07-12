import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [seoSource, robots, manifest, privacyRoute, termsRoute] = await Promise.all([
  readFile(new URL("../src/lib/seo.ts", import.meta.url), "utf8"),
  readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
  readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/privacy.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/terms.tsx", import.meta.url), "utf8"),
]);

test("public pages always expose complete social-sharing metadata", () => {
  assert.match(seoSource, /const defaultSocialImage = "\/brand\/rawaj-mark-transparent-512\.png"/);
  assert.match(seoSource, /property: "og:site_name"/);
  assert.match(seoSource, /property: "og:locale", content: "ar_SY"/);
  assert.match(seoSource, /property: "og:locale:alternate", content: "en_US"/);
  assert.match(seoSource, /property: "og:image"/);
  assert.match(seoSource, /property: "og:image:alt"/);
  assert.match(seoSource, /name: "twitter:card", content: "summary_large_image"/);
  assert.match(seoSource, /name: "twitter:image"/);
  assert.match(seoSource, /name: "twitter:image:alt"/);
  assert.doesNotMatch(seoSource, /const twitterCard = image/);
});

test("canonical production identity remains fixed to RAWAJ", () => {
  assert.match(seoSource, /const fallbackSiteUrl = "https:\/\/rawa-j\.com"/);
  assert.match(seoSource, /links: \[\{ rel: "canonical", href: url \}\]/);
  assert.match(seoSource, /name: siteName/);
  assert.match(manifest, /"name": "رواج RAWAJ"/);
  assert.match(manifest, /"lang": "ar"/);
  assert.match(manifest, /"dir": "rtl"/);
});

test("robots keeps private and authentication utility routes out of search", () => {
  for (const path of [
    "/admin",
    "/chats",
    "/notifications",
    "/profile",
    "/add-listing",
    "/login",
    "/reset-password",
    "/auth/callback",
    "/verification",
    "/favorites",
    "/saved-searches",
  ]) {
    assert.match(robots, new RegExp(`Disallow: ${path.replace("/", "\\/")}(?:\\n|$)`));
  }

  assert.match(robots, /Sitemap: https:\/\/rawa-j\.com\/sitemap\.xml/);
});

test("public legal pages use final launch copy with an explicit effective date", () => {
  for (const source of [privacyRoute, termsRoute]) {
    assert.match(source, /12 تموز 2026/);
    assert.match(source, /July 12, 2026/);
    assert.doesNotMatch(source, /بعد إطلاق النسخة الكاملة/);
    assert.doesNotMatch(source, /عند إطلاق النسخة الكاملة/);
    assert.doesNotMatch(source, /بعد تفعيل الخدمة الفعلية/);
    assert.doesNotMatch(source, /after full launch/i);
    assert.doesNotMatch(source, /when RAWAJ's full version launches/i);
    assert.doesNotMatch(source, /after the service is fully enabled/i);
  }

  assert.match(privacyRoute, /الاتصالات المشفرة وحدود الوصول والصلاحيات/);
  assert.match(privacyRoute, /Privacy requests are reviewed/);
  assert.match(termsRoute, /تسري هذه الشروط على استخدام موقع وتطبيق رَوَاج/);
});
