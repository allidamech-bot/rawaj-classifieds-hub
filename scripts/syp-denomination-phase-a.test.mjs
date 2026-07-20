import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/202607210001_syp_denomination_phase_a.sql";
const rollbackPath = "scripts/sql/syp-denomination-phase-a-rollback.sql";

test("Phase A migration is additive and keeps source price untouched", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /add column if not exists price_denomination/i);
  assert.match(sql, /add column if not exists price_new_syp_normalized/i);
  assert.match(sql, /generated always as/i);
  assert.match(sql, /price_denomination = 'old' then price \/ 100/i);
  assert.match(sql, /price_denomination = 'new' then price/i);
  assert.doesNotMatch(sql, /update\s+public\.listings\s+set\s+price\s*=/i);
});

test("Submission is blocked until a priced SYP listing is classified", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /syp_price_denomination_required/);
  assert.match(sql, /price_denomination not in \('old', 'new'\)/i);
  assert.match(sql, /rawaj_submit_listing_for_review/);
});

test("Owner and reviewer classification is stale-safe and limited to metadata", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /rawaj_classify_syp_listing_price/);
  assert.match(sql, /p_expected_updated_at/i);
  assert.match(sql, /syp_denomination_stale_write/i);
  assert.match(sql, /rawaj\.syp_denomination_write/);
  assert.match(sql, /price_denomination = p_denomination/);
});

test("Price comparisons use normalized new-SYP values", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const source = await readFile("src/lib/api/listings.ts", "utf8");
  assert.match(sql, /price_new_syp_normalized/);
  assert.match(source, /\.gte\("price_new_syp_normalized"/);
  assert.match(source, /\.order\("price_new_syp_normalized"/);
});

test("Application contracts carry denomination metadata", async () => {
  const types = await readFile("src/lib/classifieds-types.ts", "utf8");
  const createRpc = await readFile("src/lib/api/listing-draft-create-rpc.ts", "utf8");
  const updateRpc = await readFile("src/lib/api/listing-write-rpc.ts", "utf8");
  const publicFields = await readFile("src/lib/api/public-fields.ts", "utf8");
  assert.match(types, /priceDenomination: SypPriceDenomination/);
  assert.match(types, /priceNewSypNormalized: number \| null/);
  assert.match(createRpc, /price_denomination: payload\.priceDenomination/);
  assert.match(updateRpc, /price_denomination\s*=\s*payload\.priceDenomination/);
  assert.match(publicFields, /price_denomination/);
  assert.match(publicFields, /price_new_syp_normalized/);
});

test("Rollback script explicitly removes Phase A schema after restoring boundaries", async () => {
  const sql = await readFile(rollbackPath, "utf8");
  assert.match(sql, /begin;/i);
  assert.match(sql, /drop function if exists public\.rawaj_classify_syp_listing_price/i);
  assert.match(sql, /drop column if exists price_new_syp_normalized/i);
  assert.match(sql, /drop column if exists price_denomination/i);
  assert.match(sql, /rollback backup/i);
  assert.match(sql, /commit;/i);
});

const readPhaseAText = (path) => readFile(path, "utf8");

test("Phase A edit, detail, queue, and SEO surfaces use explicit denomination", async () => {
  const edit = await readPhaseAText("src/routes/profile/listings.$id.tsx");
  const detail = await readPhaseAText("src/routes/listings.$id.tsx");
  const owner = await readPhaseAText("src/routes/profile/listings.tsx");
  const queue = await readPhaseAText("src/features/listings/SypClassificationQueue.tsx");
  const structured = await readPhaseAText("src/lib/listing-structured-data.ts");

  assert.match(edit, /priceDenomination: SypPriceDenomination/);
  assert.match(edit, /requiresSypDenomination\(values\.price, values\.priceType\)/);
  assert.match(edit, /patch\.priceDenomination = current\.priceDenomination/);
  assert.match(detail, /listing\.priceNewSypNormalized === null/);
  assert.match(detail, /priceMax: listing\.priceNewSypNormalized/);
  assert.match(detail, /<SypPriceDisplay listing=\{listing\}/);
  assert.match(owner, /<SypClassificationQueue \/>/);
  assert.match(queue, /classifySypListingPrice/);
  assert.match(structured, /listing\.priceNewSypNormalized/);
});

test("Phase A normalized search and price history never compare mixed raw SYP", async () => {
  const sql = await readPhaseAText("supabase/migrations/202607210001_syp_denomination_phase_a.sql");
  assert.match(sql, /listing_row\.price_new_syp_normalized as price/i);
  assert.match(sql, /listing_row\.price_new_syp_normalized >= p_price_min/i);
  assert.match(sql, /listing_row\.price_new_syp_normalized <= p_price_max/i);
  assert.match(sql, /v_listing\.price_denomination not in \('old', 'new'\)/i);
  assert.match(sql, /old_price_denomination/i);
  assert.match(sql, /new_price_denomination/i);
  assert.match(sql, /l\.price_new_syp_normalized = d\.new_price_new_syp_normalized/i);
  assert.match(sql, /rawaj_sync_favorite_snapshot_syp_denomination/i);
});

test("Phase A rollback restores replaced functions before dropping columns", async () => {
  const rollback = await readPhaseAText("scripts/sql/syp-denomination-phase-a-rollback.sql");
  assert.match(rollback, /create or replace function public\.rawaj_owner_update_listing\(/i);
  assert.match(rollback, /create or replace function public\.rawaj_create_owner_draft_v2\(/i);
  assert.match(rollback, /create or replace function public\.rawaj_submit_listing_for_review\(/i);
  assert.match(rollback, /create or replace function public\.rawaj_owner_reduce_listing_price\(/i);
  assert.match(
    rollback,
    /create or replace function public\.rawaj_public_listing_search_page_v1_impl\(/i,
  );
  assert.doesNotMatch(rollback, /Required follow-up: redeploy/i);
});
