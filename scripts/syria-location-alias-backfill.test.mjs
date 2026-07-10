import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/202607100004_backfill_syria_source_location_aliases.sql";
const migration = await readFile(migrationPath, "utf8");
const normalized = migration.toLowerCase();

test("backfill indexes only OCHA source-provided aliases", () => {
  assert.match(normalized, /insert into public\.location_search_aliases/);
  assert.match(normalized, /unnest\(node\.search_aliases\)/);
  assert.match(normalized, /node\.external_source = 'ocha-hdx-cod-ab-syr'/);
  assert.match(normalized, /'reviewed'/);
  assert.match(normalized, /on conflict \(location_node_id, normalized_alias\) do nothing/);
});

test("backfill never reclassifies, moves, deletes, or rewrites location nodes", () => {
  assert.doesNotMatch(normalized, /update\s+public\.location_nodes/);
  assert.doesNotMatch(normalized, /delete\s+from\s+public\.location_nodes/);
  assert.doesNotMatch(normalized, /node_type\s*=/);
  assert.doesNotMatch(normalized, /parent_id\s*=/);
  assert.doesNotMatch(normalized, /location_node_id\s*=/);
});
