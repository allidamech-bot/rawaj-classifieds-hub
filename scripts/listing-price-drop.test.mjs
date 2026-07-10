import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100009_listing_price_drop_contract.sql",
  import.meta.url,
);
const apiPath = new URL("../src/lib/api/price-drops.ts", import.meta.url);
const barrelPath = new URL("../src/lib/classifieds-api.ts", import.meta.url);

const [migration, api, barrel] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(apiPath, "utf8"),
  readFile(barrelPath, "utf8"),
]);

test("price-drop history is immutable to clients and owner-readable only", () => {
  assert.match(migration, /create table if not exists public\.listing_price_changes/);
  assert.match(migration, /old_price > 0/);
  assert.match(migration, /new_price > 0/);
  assert.match(migration, /new_price < old_price/);
  assert.match(migration, /listing_price_changes_owner_select/);
  assert.match(migration, /owner_id = auth\.uid\(\)/);
  assert.doesNotMatch(migration, /create policy[\s\S]*listing_price_changes[\s\S]*for insert/i);
  assert.doesNotMatch(migration, /create policy[\s\S]*listing_price_changes[\s\S]*for update/i);
});

test("owner price reduction derives authority, locks the row, and requires a public numeric listing", () => {
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /l\.owner_id = v_actor[\s\S]*for update/);
  assert.match(migration, /v_listing\.status <> 'approved'/);
  assert.match(migration, /v_listing\.archived_at is not null/);
  assert.match(migration, /v_listing\.expires_at <= now\(\)/);
  assert.match(migration, /v_listing\.price_type::text not in \('fixed', 'negotiable'\)/);
  assert.match(migration, /p_new_price >= v_listing\.price/);
  assert.match(migration, /p_new_price > round\(v_listing\.price \* 0\.99, 2\)/);
});

test("approved owner price writes use a transaction-local trigger whitelist", () => {
  assert.match(migration, /current_setting\('rawaj\.owner_price_drop_write', true\) = 'on'/);
  assert.match(migration, /old\.owner_id <> auth\.uid\(\)/);
  assert.match(migration, /old\.status <> 'approved'/);
  assert.match(migration, /to_jsonb\(new\) - array\['price', 'updated_at'\]/);
  assert.match(migration, /set_config\('rawaj\.owner_price_drop_write', 'on', true\)/);
  assert.match(migration, /set_config\('rawaj\.owner_price_drop_write', 'off', true\)/);
});

test("price reduction updates the listing and records immutable history with audit metadata", () => {
  assert.match(migration, /update public\.listings l[\s\S]*set price = p_new_price/);
  assert.match(migration, /insert into public\.listing_price_changes/);
  assert.match(migration, /old_price,[\s\S]*new_price/);
  assert.match(migration, /'listing\.price_reduced'/);
  assert.match(migration, /discount_percent/);
});

test("public offers are recent latest real drops and never depend on featured state", () => {
  assert.match(migration, /rawaj_get_active_price_drop_offers/);
  assert.match(migration, /select distinct on \(c\.listing_id\)/);
  assert.match(migration, /l\.status = 'approved'/);
  assert.match(migration, /l\.archived_at is null/);
  assert.match(migration, /l\.price = d\.new_price/);
  assert.match(migration, /d\.created_at >= now\(\) - interval '30 days'/);
  assert.match(migration, /discount_percent/);
  assert.doesNotMatch(migration, /is_featured/);
  assert.doesNotMatch(migration, /featured_until/);
});

test("client price-drop writes use only the governed RPC and public offers re-read current public listings", () => {
  assert.match(api, /rpc\("rawaj_owner_reduce_listing_price"/);
  assert.match(api, /rpc\([\s\S]*"rawaj_get_active_price_drop_offers"/);
  assert.doesNotMatch(api, /\.from\("listings"\)[\s\S]*\.update\(/);
  assert.doesNotMatch(api, /\.from\("listing_price_changes"\)[\s\S]*\.insert\(/);
  assert.match(api, /\.eq\("status", "approved"\)/);
  assert.match(api, /listing\.price !== item\.newPrice/);
  assert.match(api, /hydrateListingsWithPrimaryImages/);
});

test("price-drop API is exported from the classifieds barrel", () => {
  assert.match(barrel, /export \* from "@\/lib\/api\/price-drops"/);
});
