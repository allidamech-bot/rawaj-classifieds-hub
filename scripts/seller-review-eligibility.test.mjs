import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100004_seller_review_eligibility.sql",
  import.meta.url,
);
const apiPath = new URL("../src/lib/api/reviews.ts", import.meta.url);
const sellerRoutePath = new URL("../src/routes/seller.$id.tsx", import.meta.url);

const [migration, api, sellerRoute] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(apiPath, "utf8"),
  readFile(sellerRoutePath, "utf8"),
]);

test("seller review eligibility requires a seller-owned listing and bidirectional messages", () => {
  assert.match(migration, /join public\.listings l[\s\S]*l\.owner_id = p_seller_user_id/);
  assert.match(
    migration,
    /buyer_message\.sender_user_id = v_reviewer[\s\S]*buyer_message\.deleted_at is null/,
  );
  assert.match(
    migration,
    /seller_message\.sender_user_id = p_seller_user_id[\s\S]*seller_message\.deleted_at is null/,
  );
});

test("seller review eligibility blocks open duplicates and direct client inserts", () => {
  assert.match(migration, /r\.status in \('pending_review', 'approved'\)/);
  assert.match(migration, /drop policy if exists "seller_reviews_user_insert"/);
});

test("seller review creation derives reviewer identity from auth and uses the eligibility RPC", () => {
  assert.match(migration, /v_reviewer uuid := auth\.uid\(\)/);
  assert.match(migration, /rawaj_create_eligible_seller_review/);
  assert.match(api, /rpc\("rawaj_create_eligible_seller_review"/);
  assert.doesNotMatch(api, /\.from\("seller_reviews"\)\s*\.insert/);
});

test("client exposes an eligibility read contract", () => {
  assert.match(api, /fetchSellerReviewEligibility/);
  assert.match(api, /rpc\("rawaj_get_seller_review_eligibility"/);
});

test("seller storefront fails closed until review eligibility is verified", () => {
  assert.match(sellerRoute, /fetchSellerReviewEligibility\(seller\.id\)/);
  assert.match(sellerRoute, /if \(eligibilityState !== "eligible" \|\| !currentProfileId\) return;/);
  assert.match(
    sellerRoute,
    /if \(reviewSubmitProfilesRef\.current\.has\(currentProfileId\)\) return;/,
  );
  assert.match(sellerRoute, /eligibilityState === "error"/);
  assert.match(sellerRoute, /Reviews are temporarily unavailable/);
  assert.match(sellerRoute, /const reviewSubmitProfilesRef = useRef<Set<string>>\(new Set\(\)\)/);
});
