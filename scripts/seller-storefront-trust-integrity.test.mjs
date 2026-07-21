import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPublicSellerRatingSummary,
  cleanPublicSellerText,
  mapPublicSellerReview,
  PUBLIC_SELLER_LISTING_LIMIT,
  PUBLIC_SELLER_REVIEW_DISPLAY_LIMIT,
  safePublicSellerMediaUrl,
} from "../src/lib/public-seller-storefront.ts";
import {
  guardPublicSellerProfileResult,
  PublicSellerProfileLoadError,
} from "../src/lib/api/seller-profile-load-guard.ts";

const [
  route,
  sellerApi,
  reviewApi,
  guardedReviewApi,
  publicFields,
  types,
  hero,
  reviewCard,
  eligibilitySql,
  publicSellerSql,
  qualityGate,
  workflow,
  packageJson,
] = await Promise.all([
  readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/seller.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/reviews.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/reviews-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/public-fields.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/storefront/StorefrontIdentityHero.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/features/reviews/SellerReviewCard.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/migrations/202607100004_seller_review_eligibility.sql", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL(
      "../supabase/migrations/202607090014_align_public_seller_visibility.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/seller-storefront-trust-integrity.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

function interfaceSource(name) {
  const start = types.indexOf(`export interface ${name} {`);
  const end = types.indexOf("\n}", start);
  assert.notEqual(start, -1, `Missing ${name}`);
  assert.notEqual(end, -1, `Missing ${name} boundary`);
  return types.slice(start, end + 2);
}

test("seller route uses only the guarded public seller read and preserves recoverable failures", () => {
  assert.match(route, /fetchPublicSellerProfile\(params\.id\)/);
  assert.doesNotMatch(route, /fetchOwner|admin|service.role|serviceRole/i);
  assert.match(route, /errorComponent: \(\{ reset \}\) => <SellerError reset=\{reset\} \/>/);

  const transient = {
    code: "unknown",
    message: "temporary read failure",
    operation: "public_seller_identity_read",
  };
  assert.throws(
    () => guardPublicSellerProfileResult({ ok: false, error: transient }),
    PublicSellerProfileLoadError,
  );
  assert.deepEqual(
    guardPublicSellerProfileResult({
      ok: false,
      error: { code: "not_found", message: "not public" },
    }),
    { ok: false, error: { code: "not_found", message: "not public" } },
  );
});

test("public seller and review DTOs are explicit privacy allowlists", () => {
  const profile = interfaceSource("PublicSellerProfile");
  const review = interfaceSource("PublicSellerReview");
  for (const forbidden of [
    "email",
    "phone",
    "birthDate",
    "avatarPath",
    "coverPath",
    "moderation",
    "verificationDocument",
    "reviewerUserId",
    "adminNote",
    "reviewedBy",
  ]) {
    assert.doesNotMatch(`${profile}\n${review}`, new RegExp(forbidden, "i"));
  }
  assert.equal(
    publicFields.match(/publicSellerReviewSelect\s*=\s*\n?\s*"([^"]+)"/)?.[1],
    "id,rating,comment,traits,seller_response,seller_response_updated_at,created_at",
  );
  assert.doesNotMatch(reviewCard, /review\.reviewerUserId|dangerouslySetInnerHTML/);
});

test("seller inventory reuses the sanitized public listing contract and exact visibility count", () => {
  assert.equal(PUBLIC_SELLER_LISTING_LIMIT, 24);
  assert.match(
    sellerApi,
    /\.select\(publicListingSelectForSchema\(supportsSypDenomination\), \{ count: "exact" \}\)/,
  );
  assert.match(sellerApi, /\.eq\("owner_id", sellerId\)/);
  assert.match(sellerApi, /\.eq\("status", "approved"\)/);
  assert.match(sellerApi, /\.is\("archived_at", null\)/);
  assert.match(sellerApi, /\.or\(publicListingExpiryFilter\(\)\)/);
  assert.match(sellerApi, /sanitizePublicListing\(mapListing/);
  assert.match(sellerApi, /new Map\(mapped\.map\(\(listing\) => \[listing\.id, listing\]\)\)/);
  assert.match(
    sellerApi,
    /\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.order\("id", \{ ascending: false \}\)/,
  );
  assert.match(route, /Showing the newest.*approved public listings/);
  assert.match(route, /<AdaptiveListingCard key=\{listing\.id\} listing=\{listing\} \/>/);
});

test("secondary inventory and review failures preserve the valid public identity", () => {
  assert.match(sellerApi, /Promise\.all\(\[/);
  assert.match(sellerApi, /inventoryStatus: inventory\.status/);
  assert.match(sellerApi, /reviewsStatus: reviewPopulation\.status/);
  assert.match(sellerApi, /approvedListingCount: inventory\.totalCount/);
  assert.match(route, /seller\.inventoryStatus !== "ready"/);
  assert.match(route, /seller\.reviewsStatus !== "ready"/);
  assert.match(route, /The public seller identity remains available/);
});

test("approved rating summary and deterministic public subset use one complete population", () => {
  const reviews = [
    mapPublicSellerReview({ id: "b", rating: 5, comment: "great", traits: [], created_at: "2" }),
    mapPublicSellerReview({ id: "a", rating: 3, comment: "okay", traits: [], created_at: "1" }),
  ];
  assert.deepEqual(buildPublicSellerRatingSummary(reviews), {
    average: 4,
    count: 2,
    distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
  });
  assert.equal(PUBLIC_SELLER_REVIEW_DISPLAY_LIMIT, 6);
  assert.match(sellerApi, /\.eq\("status", "approved"\)/);
  assert.match(
    sellerApi,
    /\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.order\("id", \{ ascending: false \}\)/,
  );
  assert.match(sellerApi, /buildPublicSellerRatingSummary\(reviews\)/);
  assert.match(sellerApi, /reviews: reviews\.slice\(0, PUBLIC_SELLER_REVIEW_DISPLAY_LIMIT\)/);
  assert.match(route, /Showing the newest.*approved reviews/);
});

test("public review mapping allowlists traits and sanitizes user-controlled text", () => {
  const mapped = mapPublicSellerReview({
    id: "review-1",
    rating: 8,
    comment: " safe\u0000 text ",
    traits: ["trustworthy", "internal_trait"],
    seller_response: " response ",
    created_at: "2026-07-17T00:00:00.000Z",
    reviewer_user_id: "private",
    admin_note: "private",
  });
  assert.deepEqual(mapped, {
    id: "review-1",
    rating: 5,
    comment: "safe text",
    traits: ["trustworthy"],
    sellerResponse: "response",
    sellerResponseUpdatedAt: null,
    createdAt: "2026-07-17T00:00:00.000Z",
  });
  assert.equal(cleanPublicSellerText("<b>shown as text</b>", 100), "<b>shown as text</b>");
});

test("review eligibility and submission are account-and-seller scoped with backend authority", () => {
  assert.match(route, /requestId !== eligibilityRequestIdRef\.current/);
  assert.match(route, /currentProfileId !== profileIdRef\.current/);
  assert.match(route, /seller\.id !== sellerIdRef\.current/);
  assert.match(route, /\[profileId, seller\.id\]/);
  assert.match(route, /const scopeKey = \[currentProfileId, currentSellerId\]\.join\(":"\)/);
  assert.match(route, /reviewSubmitScopesRef\.current\.has\(scopeKey\)/);
  assert.match(route, /currentSellerId !== sellerIdRef\.current/);
  assert.match(guardedReviewApi, /const pendingReviewCreates = new Map/);
  assert.match(guardedReviewApi, /return runOnce\(key, pendingReviewCreates/);
  assert.doesNotMatch(reviewApi, /payload\.reviewerUserId|p_reviewer/);
  assert.match(eligibilitySql, /v_reviewer uuid := auth\.uid\(\)/);
  assert.match(eligibilitySql, /p_seller_user_id = v_reviewer/);
  assert.match(eligibilitySql, /no_qualifying_interaction/);
  assert.match(eligibilitySql, /seller_review_already_exists/);
  assert.match(eligibilitySql, /'pending_review'/);
});

test("identity, verification, media, locale and structured data stay public and factual", () => {
  assert.match(hero, /width=\{1440\}[\s\S]*height=\{480\}/);
  assert.match(hero, /width=\{160\}[\s\S]*height=\{160\}/);
  assert.match(hero, /timeZone: "UTC"/);
  assert.match(hero, /does not guarantee a product, payment, delivery, or transaction/);
  assert.match(route, /"@type": "ProfilePage"/);
  assert.match(route, /"@type": "Person"/);
  assert.doesNotMatch(route, /"@type": "Organization"|telephone|email|contactPoint/);
  assert.match(route, /path: loaderData \? `\/seller\/\$\{loaderData\.id\}`/);
  assert.match(route, /noindex: !loaderData/);
  assert.match(route, /dir=\{language === "ar" \? "rtl" : "ltr"\}/);
  assert.match(reviewCard, /timeZone: "UTC"/);
  assert.equal(safePublicSellerMediaUrl("javascript:alert(1)"), null);
});

test("public seller SQL and client reads use anonymous-safe allowlists only", () => {
  assert.match(
    publicSellerSql,
    /grant execute on function public\.get_public_seller_profile\(uuid\) to anon, authenticated/,
  );
  assert.match(publicSellerSql, /l\.status = 'approved'/);
  assert.match(publicSellerSql, /l\.archived_at is null/);
  assert.match(publicSellerSql, /l\.expires_at is null or l\.expires_at > now\(\)/);
  assert.match(sellerApi, /import \{ publicSellerProfileSelect \} from "@\/lib\/profile-dto"/);
  assert.doesNotMatch(sellerApi, /service.role|serviceRole|adminFetch|fetchOwner/i);
  assert.doesNotMatch(route, /auth\.profile.*loader|loader.*auth\.profile/);
});

test("Phase 10 workflow and Quality Gate are permanent and read-only", () => {
  assert.match(packageJson, /"test:seller-storefront-trust"/);
  assert.match(packageJson, /"check": "[^"]*test:seller-storefront-trust/);
  assert.match(qualityGate, /Seller Storefront Trust Integrity contract/);
  assert.match(qualityGate, /npm run test:seller-storefront-trust/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run test:seller-storefront-trust/);
  assert.match(workflow, /npm run typecheck/);
  assert.doesNotMatch(
    workflow,
    /contents: write|SUPABASE_(SERVICE_ROLE|URL|ANON)|run:\s+.*(deploy|git push|supabase)/i,
  );
  assert.doesNotMatch(`${route}\n${sellerApi}`, /geolocation|radius|location permission/i);
});
