import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(
  new URL("../../d1/migrations/0025_promotion_request_flow_integrity.sql", import.meta.url),
);
const expiryPath = fileURLToPath(new URL("../src/promotion-expiry.ts", import.meta.url));

test("custom promotion decisions stay distinct from Search Boost and notify the owner", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /DROP TRIGGER IF EXISTS listing_promotion_apply_after_approval;/);
  assert.doesNotMatch(migration, /CREATE TRIGGER listing_promotion_apply_after_approval/);
  assert.match(migration, /CREATE TRIGGER trg_promotion_decision_owner_notification/);
  assert.match(migration, /'promotion\.approved'/);
  assert.match(migration, /'promotion\.rejected'/);
  assert.match(migration, /'targetType', 'promotion'/);
  assert.match(migration, /NEW\.admin_note/);
});

test("timed featured reconciliation is sourced only from active Search Boost orders", async () => {
  const source = await readFile(expiryPath, "utf8");

  assert.match(source, /FROM listing_search_boost_orders active/);
  assert.match(source, /active\.status = 'active'/);
  assert.doesNotMatch(source, /FROM listing_promotion_requests active/);
});

test("Syria listing currency is repaired and guarded as SYP", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /UPDATE listings\s+SET currency = 'SYP'\s+WHERE currency = 'SAR'/s);
  assert.match(migration, /CREATE TRIGGER trg_syria_listing_currency_after_insert/);
  assert.match(migration, /CREATE TRIGGER trg_syria_listing_currency_after_update/);
});
