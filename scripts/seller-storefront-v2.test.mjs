import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, shared, publicRoute, ownerRoute, css, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/storefront/StorefrontIdentityHero.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/seller-storefront-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("seller storefront V2 stylesheet loads after existing storefront layers", () => {
  assert.match(root, /import sellerStorefrontV2Css from "\.\.\/seller-storefront-v2\.css\?url"/);
  const foundation = root.indexOf("href: sellerStorefrontFoundationCss");
  const v2 = root.indexOf("href: sellerStorefrontV2Css");
  assert.notEqual(foundation, -1);
  assert.notEqual(v2, -1);
  assert.ok(v2 > foundation);
});

test("public and owner storefronts share one factual identity component", () => {
  assert.match(shared, /export function StorefrontIdentityHero/);
  assert.match(shared, /mode: "public" \| "owner"/);
  assert.match(shared, /approvedCount/);
  assert.match(shared, /ratingAverage/);
  assert.match(shared, /ratingCount/);
  assert.match(shared, /This page shows public information and approved listings only/);
  assert.doesNotMatch(shared, /response time|transactions completed|sales count/i);
});

test("storefront identity media falls back without blocking refreshed URLs", () => {
  assert.match(shared, /useState<string \| null>\(null\)/);
  assert.match(shared, /failedCoverUrl !== coverUrl/);
  assert.match(shared, /failedAvatarUrl !== avatarUrl/);
  assert.match(shared, /onError=\{\(\) => setFailedCoverUrl\(coverUrl \?\? null\)\}/);
  assert.match(shared, /onError=\{\(\) => setFailedAvatarUrl\(avatarUrl \?\? null\)\}/);
  assert.match(shared, /displayName\.trim\(\)\.slice\(0, 1\)\.toUpperCase\(\) \|\| "R"/);
  assert.doesNotMatch(shared, /useEffect/);
});

test("public seller uses adaptive cards and preserves review privacy contracts", () => {
  assert.match(publicRoute, /rawaj-storefront-v2/);
  assert.match(publicRoute, /<StorefrontIdentityHero/);
  assert.match(publicRoute, /<AdaptiveListingCard/);
  assert.doesNotMatch(publicRoute, /function SellerListingCard/);
  assert.match(publicRoute, /fetchSellerReviewEligibility/);
  assert.match(publicRoute, /createSellerReview/);
  assert.match(publicRoute, /buildSellerStructuredData/);
});

test("owner store shares the identity system and preserves lifecycle operations", () => {
  assert.match(ownerRoute, /rawaj-storefront-v2--owner/);
  assert.match(ownerRoute, /<StorefrontIdentityHero/);
  assert.match(ownerRoute, /rawaj-storefront-owner-tabs/);
  assert.match(ownerRoute, /rawaj-storefront-owner-grid/);
  assert.match(ownerRoute, /fetchCurrentUserListings/);
  assert.match(ownerRoute, /closeOwnerListing/);
  assert.match(ownerRoute, /reactivateOwnerListing/);
  assert.match(ownerRoute, /reduceOwnerListingPrice/);
  assert.match(ownerRoute, /setOwnerListingExpiry/);
  assert.match(ownerRoute, /setOwnerListingReserved/);
  assert.match(ownerRoute, /deleteOwnerListing/);
});

test("storefront CSS is mobile-first, responsive, RTL-neutral and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-storefront-identity/);
  assert.match(css, /inset-inline/);
  assert.match(css, /\.rawaj-storefront-v2__product-grid/);
  assert.match(css, /\.rawaj-storefront-owner-tabs/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 389px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("quality gate permanently runs storefront V2 with read-only permissions", () => {
  assert.match(qualityGate, /contents: read/);
  assert.match(qualityGate, /Seller Storefront V2 contract/);
  assert.match(qualityGate, /node --test scripts\/seller-storefront-v2\.test\.mjs/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
