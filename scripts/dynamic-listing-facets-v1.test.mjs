import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  "supabase/migrations/202607190041_dynamic_listing_facets_repair_v1.sql",
  "utf8",
);
const client = await readFile("src/lib/api/listing-facets.ts", "utf8");

test("dynamic facets derive from governed field rules for every published leaf", () => {
  assert.match(migration, /taxonomy_field_rules/);
  assert.match(migration, /field_row\.is_filterable/);
  assert.match(migration, /not field_row\.is_sensitive/);
  assert.match(migration, /p_taxonomy_node_ids/);
  assert.doesNotMatch(migration, /category_id\s*=\s*['"]vehicles['"]/i);
});

test("facet totals only include currently visible listings", () => {
  assert.match(migration, /listing_row\.status = 'approved'/);
  assert.match(migration, /listing_row\.archived_at is null/);
  assert.match(migration, /listing_row\.expires_at is null or listing_row\.expires_at > now\(\)/);
  assert.match(migration, /count\(distinct value_row\.listing_id\)/);
});

test("facet contract supports options, booleans, multi-selects and numeric ranges", () => {
  assert.match(migration, /single_select/);
  assert.match(migration, /multi_select/);
  assert.match(migration, /value_boolean::text/);
  assert.match(migration, /min\(attribute_row\.value_numeric\)/);
  assert.match(migration, /max\(attribute_row\.value_numeric\)/);
});

test("public client validates bounds and parses exact counts", () => {
  assert.match(client, /rawaj_public_listing_facets_v1/);
  assert.match(client, /attributeFilters/);
  assert.match(client, /totalCount/);
  assert.match(client, /options/);
  assert.match(client, /minimum/);
  assert.match(client, /maximum/);
});

test("facet RPC is public read-only with a pinned search path", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public, pg_temp/i);
  assert.match(migration, /grant execute[\s\S]*to anon, authenticated/i);
  assert.doesNotMatch(migration, /\binsert\s+into\b/i);
  assert.doesNotMatch(migration, /\bupdate\s+public\./i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
});
