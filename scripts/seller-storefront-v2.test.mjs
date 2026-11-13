import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PublicSellerProfileLoadError,
  guardPublicSellerProfileResult,
  isUnavailableSellerProfileError,
} from "../src/lib/api/seller-profile-load-guard.ts";

const [root, routeStyles, shared, publicRoute, ownerRoute, css, qualityGate, barrel] =
  await Promise.all([
    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/storefront/StorefrontIdentityHero.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/seller-storefront-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  ]);

const [approvedIdentity, approvedCss] = await Promise.all([
  readFile(new URL("../src/features/storefront/MyStoreIdentity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/storefront/my-store.css", import.meta.url), "utf8"),
]);

const sellerLoadError = {
  message: "Temporary seller profile read failure",
};

test("seller storefront V2 stylesheet loads after existing storefront layers", () => {
  assert.match(
    routeStyles,
    /import sellerStorefrontV2Css from "\.\.\/seller-storefront-v2\.css\?url"/,
  );
  const foundation = root.indexOf("routeStyleHrefs.sellerStorefrontFoundation");
  const v2 = root.indexOf("routeStyleHrefs.sellerStorefrontV2");
  assert.notEqual(foundation, -1);
  assert.notEqual(v2, -1);
  assert.ok(v2 > foundation);
});

test("public and owner storefronts share the approved identity without invented metrics", () => {
  assert.match(approvedIdentity, /export function MyStoreIdentity/);
  assert.match(approvedIdentity, /mode\?: "owner" \| "public"/);
  assert.match(approvedIdentity, /approvedCount/);
  assert.match(approvedIdentity, /ratingAverage/);
  assert.match(approvedIdentity, /ratingCount/);
  assert.match(approvedIdentity, /followerCount \?\? "—"/);
  assert.doesNotMatch(approvedIdentity, /response time|transactions completed|sales count/i);
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

test("public seller uses the same approved visual identity as the owner but not owner privileges", () => {
  assert.match(approvedIdentity, /mode\?: "owner" \| "public"/);
  assert.match(approvedIdentity, /<SellerFollowButton/);
  assert.match(approvedIdentity, /isPublic \? \(/);
  assert.match(publicRoute, /<MyStoreIdentity/);
  assert.match(publicRoute, /mode="public"/);
  assert.match(publicRoute, /<PublicStoreListingCard/);
  assert.match(publicRoute, /to="\/listings\/\$id"/);
  assert.match(publicRoute, /seller\.listings\.map/);
  assert.match(publicRoute, /seller\.inventoryStatus !== "ready"/);
  assert.match(publicRoute, /fetchSellerReviewEligibility/);
  assert.match(publicRoute, /createSellerReview/);
  assert.match(publicRoute, /buildSellerStructuredData/);
  assert.doesNotMatch(publicRoute, /<OwnerListingsToolbar|deleteOwnerListing|closeOwnerListing/);
});

test("only genuine unavailable seller outcomes remain eligible for the 404 path", () => {
  assert.equal(isUnavailableSellerProfileError({ ...sellerLoadError, code: "not_found" }), true);
  assert.equal(
    isUnavailableSellerProfileError({ ...sellerLoadError, code: "validation_error" }),
    true,
  );
  assert.equal(isUnavailableSellerProfileError({ ...sellerLoadError, code: "unknown" }), false);
  assert.equal(
    isUnavailableSellerProfileError({ ...sellerLoadError, code: "schema_missing" }),
    false,
  );

  const unavailableResult = {
    ok: false,
    error: { code: "not_found", message: "Seller unavailable" },
  };
  assert.equal(guardPublicSellerProfileResult(unavailableResult), unavailableResult);
  assert.match(publicRoute, /if \(!seller\.ok\) throw notFound\(\)/);
  assert.match(publicRoute, /notFoundComponent:/);
});

test("transient seller profile failures reach the retryable route error boundary", () => {
  const retryableError = {
    code: "unknown",
    message: "Network request failed",
    operation: "public_seller_profile_read",
  };

  assert.throws(
    () => guardPublicSellerProfileResult({ ok: false, error: retryableError }),
    (error) => {
      assert.ok(error instanceof PublicSellerProfileLoadError);
      assert.equal(error.code, retryableError.code);
      assert.equal(error.operation, retryableError.operation);
      assert.equal(error.message, retryableError.message);
      return true;
    },
  );

  assert.match(
    barrel,
    /export \{ fetchPublicSellerProfileGuarded as fetchPublicSellerProfile \} from "@\/lib\/api\/seller-profile-read-guarded"/,
  );
  assert.match(publicRoute, /await fetchPublicSellerProfile\(params\.id\)/);
  assert.match(publicRoute, /errorComponent: \(\{ reset \}\) => <SellerError reset=\{reset\} \/>/);
  assert.match(publicRoute, /إعادة المحاولة/);
});

test("owner storefront preserves management actions and reuses approved identity", () => {
  assert.match(ownerRoute, /<MyStoreIdentity/);
  assert.match(ownerRoute, /onManage=\{\(\) => setToolsOpen\(true\)\}/);
  assert.match(ownerRoute, /my-store-dialog/);
  assert.match(ownerRoute, /<OwnerListingsToolbar/);
  assert.match(ownerRoute, /fetchCurrentUserListings/);
  assert.match(ownerRoute, /closeOwnerListing/);
  assert.match(ownerRoute, /reactivateOwnerListing/);
  assert.match(ownerRoute, /reduceOwnerListingPrice/);
  assert.match(ownerRoute, /setOwnerListingExpiry/);
  assert.match(ownerRoute, /setOwnerListingReserved/);
  assert.match(ownerRoute, /deleteOwnerListing/);
  assert.match(approvedCss, /\.my-store-public-card/);
  assert.match(approvedCss, /\.my-store-dialog\[role="dialog"\]/);
  assert.match(approvedCss, /data-resolved-pathname\^="\/seller\/"/);
});

test("owner listings and public store metadata recover independently", () => {
  assert.match(ownerRoute, /const \[listingsHasLoaded, setListingsHasLoaded\]/);
  assert.match(ownerRoute, /const \[sellerHasLoaded, setSellerHasLoaded\]/);
  assert.match(ownerRoute, /const \[listingsError, setListingsError\]/);
  assert.match(ownerRoute, /const \[sellerError, setSellerError\]/);
  assert.match(ownerRoute, /const loadListings = useCallback/);
  assert.match(ownerRoute, /const loadSellerProfile = useCallback/);
  assert.match(ownerRoute, /listingsError && !listingsHasLoaded/);
  assert.match(ownerRoute, /sellerError && !sellerHasLoaded/);
  assert.match(ownerRoute, /onAction=\{\(\) => void loadListings\(\)\}/);
  assert.match(ownerRoute, /onAction=\{\(\) => void loadSellerProfile\(\)\}/);
  assert.match(ownerRoute, /setListingsHasLoaded\(true\)/);
  assert.match(ownerRoute, /setSellerHasLoaded\(true\)/);
});

test("owner store requests reject stale account and route responses", () => {
  assert.match(ownerRoute, /const listingsRequestIdRef = useRef\(0\)/);
  assert.match(ownerRoute, /const sellerRequestIdRef = useRef\(0\)/);
  assert.match(ownerRoute, /requestId !== listingsRequestIdRef\.current/);
  assert.match(ownerRoute, /requestId !== sellerRequestIdRef\.current/);
  assert.match(ownerRoute, /currentProfileId !== profileIdRef\.current/);
  assert.match(
    ownerRoute,
    /return \(\) => \{[\s\S]*listingsRequestIdRef\.current \+= 1;[\s\S]*sellerRequestIdRef\.current \+= 1;/,
  );
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
