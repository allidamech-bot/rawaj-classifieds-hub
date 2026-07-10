import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100005_seller_review_response.sql",
  import.meta.url,
);
const apiPath = new URL("../src/lib/api/reviews.ts", import.meta.url);

const [migration, api] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(apiPath, "utf8"),
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
