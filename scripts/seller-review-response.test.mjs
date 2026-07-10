import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100005_seller_review_response.sql",
  import.meta.url,
);
const repairMigrationPath = new URL(
  "../supabase/migrations/202607100007_repair_seller_review_response_update_path.sql",
  import.meta.url,
);
const apiPath = new URL("../src/lib/api/reviews.ts", import.meta.url);
const cardPath = new URL("../src/features/reviews/SellerReviewCard.tsx", import.meta.url);
const sellerRoutePath = new URL("../src/routes/seller.$id.tsx", import.meta.url);

const [migration, repairMigration, api, card, sellerRoute] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(repairMigrationPath, "utf8"),
  readFile(apiPath, "utf8"),
  readFile(cardPath, "utf8"),
  readFile(sellerRoutePath, "utf8"),
]);

test("seller review responses are stored with bounded public fields", () => {
  assert.match(migration, /add column if not exists seller_response text null/);
  assert.match(migration, /seller_response_updated_at timestamptz null/);
  assert.match(migration, /char_length\(btrim\(seller_response\)\) between 3 and 800/);
});

test("response RPC derives seller identity and requires ownership plus approved status", () => {
  assert.match(migration, /v_seller uuid := auth\.uid\(\)/);
  assert.match(migration, /v_review\.seller_user_id <> v_seller/);
  assert.match(migration, /v_review\.status <> 'approved'/);
  assert.match(migration, /for update/);
});

test("empty response clears the seller reply and anonymous execution is denied", () => {
  assert.match(migration, /nullif\(btrim\(coalesce\(p_response, ''\)\), ''\)/);
  assert.match(
    migration,
    /seller_response_updated_at = case when v_response is null then null else now\(\) end/,
  );
  assert.match(
    migration,
    /revoke all on function public\.rawaj_set_seller_review_response\(uuid, text\) from anon/,
  );
});

test("response trigger repair only opens a transaction-local owned approved response path", () => {
  assert.match(
    repairMigration,
    /current_setting\('rawaj\.seller_review_response_write', true\) = 'on'/,
  );
  assert.match(repairMigration, /auth\.uid\(\) is null or old\.seller_user_id <> auth\.uid\(\)/);
  assert.match(repairMigration, /old\.status <> 'approved'/);
  assert.match(
    repairMigration,
    /to_jsonb\(new\) - array\['seller_response', 'seller_response_updated_at', 'updated_at'\]/,
  );
  assert.match(repairMigration, /set_config\('rawaj\.seller_review_response_write', 'on', true\)/);
  assert.doesNotMatch(repairMigration, /create policy[\s\S]*seller_reviews[\s\S]*for update/i);
});

test("response trigger repair preserves a moderation-only field whitelist", () => {
  assert.match(repairMigration, /not public\.current_user_can_moderate\(\)/);
  assert.match(
    repairMigration,
    /to_jsonb\(new\) - array\[[\s\S]*'status'[\s\S]*'admin_note'[\s\S]*'reviewed_by'[\s\S]*'reviewed_at'[\s\S]*'updated_at'/,
  );
  assert.match(repairMigration, /new\.reviewed_by := auth\.uid\(\)/);
  assert.match(repairMigration, /new\.reviewed_at := now\(\)/);
});

test("client routes seller responses through the protected RPC and maps public response fields", () => {
  assert.match(api, /setSellerReviewResponse/);
  assert.match(api, /rpc\("rawaj_set_seller_review_response"/);
  assert.doesNotMatch(api, /\.from\("seller_reviews"\)[\s\S]*\.update\(/);
  assert.match(api, /sellerResponse: rowNullableString\(row, "seller_response"\)/);
  assert.match(
    api,
    /sellerResponseUpdatedAt: rowNullableString\(row, "seller_response_updated_at"\)/,
  );
});

test("seller storefront displays responses publicly and gates response management to the owner", () => {
  assert.match(sellerRoute, /import \{ SellerReviewCard \}/);
  assert.match(sellerRoute, /canManageResponse=\{isOwnProfile\}/);
  assert.match(card, /readSellerReviewResponse\(review\)/);
  assert.match(card, /setSellerReviewResponse\(review\.id, responseText\)/);
  assert.match(card, /Seller response/);
  assert.match(card, /canManageResponse \?/);
});
