import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100010_listing_reservation_contract.sql",
  import.meta.url,
);
const apiPath = new URL("../src/lib/api/listing-reservation.ts", import.meta.url);
const listingsApiPath = new URL("../src/lib/api/listings.ts", import.meta.url);
const typesPath = new URL("../src/lib/classifieds-types.ts", import.meta.url);
const barrelPath = new URL("../src/lib/classifieds-api.ts", import.meta.url);

const [migration, api, listingsApi, types, barrel] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(apiPath, "utf8"),
  readFile(listingsApiPath, "utf8"),
  readFile(typesPath, "utf8"),
  readFile(barrelPath, "utf8"),
]);

test("reservation is an orthogonal timestamp and does not introduce a listing status", () => {
  assert.match(migration, /add column if not exists reserved_at timestamptz null/);
  assert.doesNotMatch(migration, /set status = 'reserved'/i);
  assert.doesNotMatch(migration, /new\.status\s*:?=\s*'reserved'/i);
  assert.match(migration, /Reserved listings remain approved\/public/);
});

test("owner reservation derives authority, locks the listing, and requires current public availability", () => {
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /l\.owner_id = v_actor[\s\S]*for update/);
  assert.match(migration, /v_listing\.status <> 'approved'/);
  assert.match(migration, /v_listing\.archived_at is not null/);
  assert.match(migration, /v_listing\.expires_at <= now\(\)/);
  assert.match(migration, /account_status in \('frozen', 'disabled'\)/);
});

test("reservation writes use a transaction-local owner trigger whitelist", () => {
  assert.match(migration, /current_setting\('rawaj\.owner_reservation_write', true\) = 'on'/);
  assert.match(migration, /old\.owner_id <> auth\.uid\(\)/);
  assert.match(migration, /old\.status <> 'approved'/);
  assert.match(migration, /to_jsonb\(new\) - array\['reserved_at', 'updated_at'\]/);
  assert.match(migration, /set_config\('rawaj\.owner_reservation_write', 'on', true\)/);
  assert.match(migration, /set_config\('rawaj\.owner_reservation_write', 'off', true\)/);
});

test("reservation RPC preserves public status and records auditable owner intent", () => {
  assert.match(migration, /rawaj_owner_set_listing_reserved/);
  assert.match(migration, /when p_reserved then coalesce\(l\.reserved_at, now\(\)\)/);
  assert.match(migration, /else null/);
  assert.match(migration, /'listing\.reserved'/);
  assert.match(migration, /'listing\.reservation_cleared'/);
  assert.doesNotMatch(migration, /set status = 'reserved'/);
});

test("active real price-drop offers exclude reserved inventory", () => {
  const start = migration.indexOf(
    "create or replace function public.rawaj_get_active_price_drop_offers",
  );
  const end = migration.indexOf(
    "revoke all on function public.rawaj_get_active_price_drop_offers",
    start,
  );
  assert.ok(start >= 0 && end > start);
  const offerFunction = migration.slice(start, end);
  assert.match(offerFunction, /l\.reserved_at is null/);
});

test("client reservation writes use only the governed RPC", () => {
  assert.match(api, /rpc\("rawaj_owner_set_listing_reserved"/);
  assert.doesNotMatch(api, /\.from\("listings"\)[\s\S]*\.update\(/);
  assert.match(api, /fetchOwnerListingDetail/);
});

test("listing contracts map the public reservation timestamp", () => {
  assert.match(types, /reservedAt\?: string \| null/);
  assert.match(listingsApi, /reservedAt: rowNullableString\(row, "reserved_at"\)/);
});

test("reservation API is exported from the classifieds barrel", () => {
  assert.match(barrel, /export \* from "@\/lib\/api\/listing-reservation"/);
});
