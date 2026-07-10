import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100008_seller_review_traits_optional_comment.sql",
  import.meta.url,
);
const typesPath = new URL("../src/lib/classifieds-types.ts", import.meta.url);
const apiPath = new URL("../src/lib/api/reviews.ts", import.meta.url);
const cardPath = new URL("../src/features/reviews/SellerReviewCard.tsx", import.meta.url);
const sellerRoutePath = new URL("../src/routes/seller.$id.tsx", import.meta.url);

const [migration, types, api, card, sellerRoute] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(typesPath, "utf8"),
  readFile(apiPath, "utf8"),
  readFile(cardPath, "utf8"),
  readFile(sellerRoutePath, "utf8"),
]);

test("written seller-review comments become optional but stay bounded when present", () => {
  assert.match(migration, /alter column comment drop not null/);
  assert.match(migration, /comment is null/);
  assert.match(migration, /char_length\(btrim\(comment\)\) between 10 and 1200/);
  assert.match(migration, /v_comment text := nullif\(btrim\(coalesce\(p_comment, ''\)\), ''\)/);
});

test("quick traits are controlled unique arrays capped at three", () => {
  assert.match(migration, /add column if not exists traits text\[\] not null default '\{\}'::text\[\]/);
  assert.match(migration, /cardinality\(v_traits\) > 3/);
  assert.match(migration, /v_trait = any\(v_seen\)/);
  for (const trait of [
    "accurate_description",
    "good_communication",
    "fast_response",
    "fair_deal",
    "punctual",
    "trustworthy",
  ]) {
    assert.match(migration, new RegExp(`'${trait}'`));
  }
  assert.match(migration, /seller_reviews_traits_allowed_check/);
});

test("trait-aware creation keeps eligibility enforcement and a legacy compatibility wrapper", () => {
  assert.match(
    migration,
    /rawaj_create_eligible_seller_review\([\s\S]*p_related_listing_id uuid,[\s\S]*p_traits text\[\]/,
  );
  assert.match(migration, /v_reviewer uuid := auth\.uid\(\)/);
  assert.match(migration, /rawaj_get_seller_review_eligibility/);
  assert.match(migration, /seller_review_invalid_traits/);
  assert.match(
    migration,
    /select public\.rawaj_create_eligible_seller_review\([\s\S]*p_related_listing_id,[\s\S]*'\{\}'::text\[\]/,
  );
  assert.match(
    migration,
    /revoke all on function public\.rawaj_create_eligible_seller_review\(uuid, integer, text, uuid\) from anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.rawaj_create_eligible_seller_review\(uuid, integer, text, uuid, text\[\]\) to authenticated/,
  );
});

test("TypeScript review contracts expose nullable comments and controlled traits", () => {
  assert.match(types, /export type SellerReviewTrait =/);
  assert.match(types, /comment: string \| null/);
  assert.match(types, /traits: SellerReviewTrait\[\]/);
  assert.match(types, /traits\?: SellerReviewTrait\[\]/);
});

test("review API validates and submits traits through the governed RPC", () => {
  assert.match(api, /SELLER_REVIEW_TRAITS/);
  assert.match(api, /new Set\(payload\.traits \?\? \[\]\)/);
  assert.match(api, /traits\.length > 3/);
  assert.match(api, /p_traits: traits/);
  assert.match(api, /comment: rowNullableString\(row, "comment"\)/);
  assert.match(api, /traits: rowArray\(row, "traits"\)/);
});

test("seller storefront composes up to three traits with an optional comment", () => {
  assert.match(sellerRoute, /selectedTraits/);
  assert.match(sellerRoute, /selectedTraits\.length >= 3/);
  assert.match(sellerRoute, /traits: selectedTraits/);
  assert.match(sellerRoute, /Optional written comment/);
});

test("public review cards render traits and omit empty written comments", () => {
  assert.match(card, /review\.traits\.length > 0/);
  assert.match(card, /sellerReviewTraitLabel/);
  assert.match(card, /review\.comment \?/);
});
