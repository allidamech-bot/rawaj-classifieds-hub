import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, routeStyles, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

const scopedStyles = [
  "home-signature.css",
  "home-marketplace-v2.css",
  "home-discovery-v3.css",
  "listings-results.css",
  "search-filters-v1.css",
  "search-filters-v2.css",
  "listing-detail-foundation.css",
  "listing-detail-v2.css",
  "listing-detail-v3.css",
  "offers-signature.css",
  "seller-storefront-foundation.css",
  "seller-storefront-v2.css",
];

test("twelve page-specific styles are no longer imported directly by the root route", () => {
  for (const stylesheet of scopedStyles) {
    assert.doesNotMatch(root, new RegExp(`from "\\.\\./${stylesheet.replaceAll(".", "\\.")}\\?url"`));
    assert.match(routeStyles, new RegExp(`${stylesheet.replaceAll(".", "\\.")}\\?url`));
  }
});

test("root head resolves stylesheet scope from the active matched pathname", () => {
  assert.match(root, /head: \(\{ matches \}\) =>/);
  assert.match(root, /matches\[matches\.length - 1\]/);
  assert.match(root, /resolveRouteStyleScope\(activeMatch\?\.pathname \?\? "\/"\)/);
  assert.match(root, /routeStyleHrefs\.homeSignature/);
  assert.match(root, /routeStyleHrefs\.listingsResults/);
  assert.match(root, /routeStyleHrefs\.listingDetailV3/);
  assert.match(root, /routeStyleHrefs\.offersSignature/);
  assert.match(root, /routeStyleHrefs\.sellerStorefrontV2/);
});

test("route scopes remain explicit and exclude unrelated child pages", () => {
  assert.match(routeStyles, /home: normalizedPathname === "\/"/);
  assert.match(routeStyles, /listingResults: normalizedPathname === "\/listings"/);
  assert.match(routeStyles, /listingDetail: \/\^\\\/listings\\\/\[\^\/\]\+\$\//);
  assert.match(routeStyles, /offers: normalizedPathname === "\/offers"/);
  assert.match(routeStyles, /normalizedPathname === "\/profile\/listings"/);
  assert.doesNotMatch(routeStyles, /profile\/listings\/\[\^/);
});

test("conditional links preserve the established stylesheet cascade order", () => {
  const homeMarketplace = root.indexOf("routeStyleHrefs.homeMarketplaceV2");
  const homeDiscovery = root.indexOf("routeStyleHrefs.homeDiscoveryV3");
  const searchV1 = root.indexOf("routeStyleHrefs.searchFiltersV1");
  const searchV2 = root.indexOf("routeStyleHrefs.searchFiltersV2");
  const detailV2 = root.indexOf("routeStyleHrefs.listingDetailV2");
  const detailV3 = root.indexOf("routeStyleHrefs.listingDetailV3");
  const storefrontFoundation = root.indexOf("routeStyleHrefs.sellerStorefrontFoundation");
  const storefrontV2 = root.indexOf("routeStyleHrefs.sellerStorefrontV2");

  assert.ok(homeDiscovery > homeMarketplace);
  assert.ok(searchV2 > searchV1);
  assert.ok(detailV3 > detailV2);
  assert.ok(storefrontV2 > storefrontFoundation);
});

test("quality gate permanently enforces route CSS isolation read-only", () => {
  assert.match(qualityGate, /Route CSS isolation contract/);
  assert.match(qualityGate, /node --test scripts\/route-css-isolation\.test\.mjs/);
  assert.match(qualityGate, /contents: read/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
