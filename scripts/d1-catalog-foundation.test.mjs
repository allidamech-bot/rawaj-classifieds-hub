import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../cloudflare/d1/migrations/0001_catalog_foundation.sql", import.meta.url),
  "utf8",
);

const requiredTables = [
  "rawaj_catalog_sync_state",
  "categories",
  "subcategories",
  "governorates",
  "taxonomy_nodes",
  "option_sets",
  "field_definitions",
  "option_values",
  "vehicle_makes",
  "vehicle_models",
  "vehicle_generations",
  "vehicle_trims",
];

test("D1 catalog migration creates only public catalog tables", () => {
  for (const table of requiredTables) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}\\s*\\(`));
  }

  for (const forbiddenTable of [
    "profiles",
    "listings",
    "listing_images",
    "favorites",
    "conversations",
    "notifications",
    "user_roles",
  ]) {
    assert.doesNotMatch(sql, new RegExp(`CREATE TABLE ${forbiddenTable}\\b`));
  }
});

test("D1 catalog migration contains no PostgreSQL-only schema constructs", () => {
  for (const forbidden of [
    /\bjsonb\b/i,
    /\buuid\b/i,
    /\btimestamptz\b/i,
    /\blanguage\s+plpgsql\b/i,
    /\bcreate\s+policy\b/i,
    /\bauth\.uid\s*\(/i,
    /::[a-z_]+/i,
    /\bgen_random_uuid\s*\(/i,
  ]) {
    assert.doesNotMatch(sql, forbidden);
  }
});

test("D1 catalog migration preserves integrity using SQLite-compatible checks", () => {
  assert.match(sql, /PRAGMA foreign_keys = ON/);
  assert.match(sql, /CHECK \(is_active IN \(0, 1\)\)/);
  assert.match(sql, /CHECK \(json_valid\(districts_ar\)\)/);
  assert.match(sql, /CHECK \(json_valid\(validation_schema\)\)/);
  assert.match(sql, /PRIMARY KEY \(option_set_key, value_key\)/);
  assert.match(sql, /FOREIGN KEY \(generation_id, model_id\)/);
  assert.match(sql, /source_checksum_sha256 TEXT/);
});
