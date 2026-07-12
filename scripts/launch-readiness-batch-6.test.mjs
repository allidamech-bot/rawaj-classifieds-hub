import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  seo,
  sitemap,
  robots,
  categoryRoute,
  governoratesRoute,
  governorateRoute,
  listingsApi,
  categoryWorlds,
  categoriesDirectory,
  root,
  capacitor,
  packageJson,
  qualityGate,
] = await Promise.all([
  readFile(new URL("../src/lib/seo.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/sitemap[.]xml.ts", import.meta.url), "utf8"),
  readFile(new URL("../public/robots.txt", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.$slug.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/governorates.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/governorates.$slug.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/CategoryWorlds.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("all indexable pages receive complete default Open Graph and Twitter cards", () => {
  assert.ok(seo.includes('defaultSocialImage = "/brand/rawaj-mark-transparent-512.png"'));
  assert.ok(seo.includes('property: "og:site_name"'));
  assert.ok(seo.includes('property: "og:locale", content: "ar_AR"'));
  assert.ok(seo.includes('property: "og:image", content: image'));
  assert.ok(seo.includes('name: "twitter:card", content: "summary_large_image"'));
  assert.ok(seo.includes('name: "twitter:image", content: image'));
  assert.ok(seo.includes('"index, follow, max-image-preview:large"'));
});

test("category and governorate SEO pages are canonical SSR marketplace landings", () => {
  assert.ok(categoryRoute.includes('createFileRoute("/categories/$slug")'));
  assert.ok(categoryRoute.includes("fetchPublicListings({ categoryId: category.id }"));
  assert.ok(categoryRoute.includes("buildBreadcrumbStructuredData"));
  assert.ok(categoryRoute.includes('path: `/categories/${params.slug}`'));
  assert.ok(governoratesRoute.includes('createFileRoute("/governorates")'));
  assert.ok(governoratesRoute.includes('to="/governorates/$slug"'));
  assert.ok(governorateRoute.includes('createFileRoute("/governorates/$slug")'));
  assert.ok(governorateRoute.includes("fetchPublicListings({ governorateId: governorate.id }"));
  assert.ok(governorateRoute.includes('path: `/governorates/${params.slug}`'));
});

test("governorate landing listings are filtered at the public query boundary", () => {
  assert.ok(
    listingsApi.includes(
      "filters: { categoryId?: string; governorateId?: string; sort?: string }",
    ),
  );
  assert.ok(
    listingsApi.includes(
      'if (filters.governorateId) query = query.eq("governorate_id", filters.governorateId)',
    ),
  );
});

test("canonical category pages receive internal links from discovery surfaces", () => {
  assert.ok(categoryWorlds.includes('to="/categories/$slug"'));
  assert.ok(categoryWorlds.includes("params={{ slug: category.slug }}"));
  assert.ok(categoriesDirectory.includes('to="/categories/$slug"'));
  assert.ok(categoriesDirectory.includes("params={{ slug: category.slug }}"));
});

test("sitemap covers public directories and active category and governorate pages", () => {
  assert.ok(sitemap.includes('absoluteUrl("/governorates")'));
  assert.ok(sitemap.includes('absoluteUrl("/support")'));
  assert.ok(sitemap.includes('.from("categories")'));
  assert.ok(sitemap.includes('.from("governorates")'));
  assert.ok(sitemap.includes("/categories/${encodeURIComponent(row.slug)}"));
  assert.ok(sitemap.includes("/governorates/${encodeURIComponent(row.slug)}"));
  assert.ok(sitemap.includes("return referenceEntries"));
});

test("robots keeps recovery, verification, and private workspaces out of crawl queues", () => {
  for (const path of [
    "/auth/",
    "/reset-password",
    "/verification",
    "/admin",
    "/profile",
    "/chats",
    "/notifications",
    "/promotion",
  ]) {
    assert.ok(robots.includes(`Disallow: ${path}`));
  }
  assert.ok(robots.includes("Sitemap: https://rawa-j.com/sitemap.xml"));
});

test("production analytics and Android HTTPS WebView contracts remain enabled", () => {
  assert.ok(root.includes('import { Analytics } from "@vercel/analytics/react"'));
  assert.ok(root.includes("<Analytics />"));
  assert.ok(capacitor.includes('url: "https://rawa-j.com"'));
  assert.ok(capacitor.includes('androidScheme: "https"'));
  assert.ok(capacitor.includes("cleartext: false"));
});

test("Batch 6 launch regression is permanent in local and GitHub gates", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:launch-readiness-batch-6"]);
  assert.ok(parsed.scripts.check.includes("test:launch-readiness-batch-6"));
  assert.ok(qualityGate.includes("Launch readiness Batch 6 contract"));
  assert.ok(qualityGate.includes("npm run test:launch-readiness-batch-6"));
});
