import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607190035_vehicle_reference_review_apply_v1.sql",
    import.meta.url,
  ),
  "utf8",
);

test("vehicle queue records reviewed and applied lifecycle", () => {
  assert.match(migration, /add column if not exists reviewed_listing_updated_at timestamptz/);
  assert.match(migration, /add column if not exists applied_by uuid references public\.profiles/);
  assert.match(migration, /status in \('pending', 'matched', 'created', 'rejected', 'applied'\)/);
  assert.match(migration, /status <> 'applied'\s*\n\s*or \(applied_by is not null and applied_at is not null\)/);
});

test("admin queue feed is private, filtered, bounded, and contextual", () => {
  assert.match(migration, /rawaj_admin_fetch_vehicle_reference_queue_v1/);
  assert.match(migration, /not public\.current_user_is_admin_like\(\)/);
  assert.match(migration, /invalid_vehicle_reference_queue_status/);
  assert.match(migration, /invalid_vehicle_reference_entity_type/);
  assert.match(migration, /least\(greatest\(coalesce\(p_limit, 50\), 1\), 200\)/);
  assert.match(migration, /'parentMakeNameAr'/);
  assert.match(migration, /'suggestedMatchNameAr'/);
  assert.match(migration, /'listingUpdatedAt'/);
});

test("admin matching is stale-safe and validates parent relationships", () => {
  assert.match(migration, /rawaj_admin_review_vehicle_reference_v1/);
  assert.match(migration, /stale_vehicle_reference_review/);
  assert.match(migration, /vehicle_reference_model_make_mismatch/);
  assert.match(migration, /vehicle_reference_generation_model_mismatch/);
  assert.match(migration, /vehicle_reference_trim_model_mismatch/);
  assert.match(migration, /status = 'matched'/);
  assert.match(migration, /status = 'rejected'/);
  assert.match(migration, /'vehicle\.reference_matched'/);
  assert.match(migration, /'vehicle\.reference_rejected'/);
});

test("owner-only creation validates canonical IDs, parents, years, aliases, and collisions", () => {
  assert.match(migration, /rawaj_owner_create_vehicle_reference_from_queue_v1/);
  assert.match(migration, /not public\.current_user_has_role\('owner'\)/);
  assert.match(migration, /stale_vehicle_reference_creation/);
  assert.match(migration, /vehicle_reference_id_or_slug_invalid/);
  assert.match(migration, /vehicle_reference_year_range_invalid/);
  assert.match(migration, /vehicle_reference_alias_limit_exceeded/);
  assert.match(migration, /vehicle_reference_parent_make_missing/);
  assert.match(migration, /vehicle_reference_parent_model_missing/);
  assert.match(migration, /vehicle_reference_trim_generation_mismatch/);
  assert.match(migration, /vehicle_reference_catalog_id_or_slug_exists/);
  assert.match(migration, /'vehicle\.reference_created'/);
});

test("owner application requires a published vehicle Leaf and unchanged listing", () => {
  assert.match(migration, /rawaj_owner_apply_vehicle_reference_resolution_v1/);
  assert.match(migration, /vehicle_reference_requires_reviewed_resolution/);
  assert.match(migration, /stale_vehicle_reference_application/);
  assert.match(migration, /listing_changed_after_vehicle_reference_review/);
  assert.match(migration, /node_row\.filter_schema_key = 'vehicles'/);
  assert.match(migration, /vehicle_reference_requires_published_vehicle_leaf/);
  assert.match(migration, /'vehicle\.reference_applied'/);
});

test("application writes dependency chain in make-model-generation-trim order", () => {
  const makePosition = migration.indexOf("'vehicle_make'");
  const modelPosition = migration.indexOf("'vehicle_model'", makePosition + 1);
  const generationPosition = migration.indexOf("'vehicle_generation'", modelPosition + 1);
  const trimPosition = migration.indexOf("'vehicle_trim'", generationPosition + 1);

  assert.ok(makePosition > 0);
  assert.ok(modelPosition > makePosition);
  assert.ok(generationPosition > modelPosition);
  assert.ok(trimPosition > generationPosition);
  assert.match(migration, /rawaj_set_vehicle_attribute_if_absent_v1/);
  assert.match(migration, /vehicle_reference_existing_attribute_conflict/);
  assert.match(migration, /'legacy_backfill'/);
  assert.doesNotMatch(migration, /delete from public\.listing_attribute_values/);
});

test("review and creation never mutate listings or listing attributes", () => {
  const reviewStart = migration.indexOf(
    "create or replace function public.rawaj_admin_review_vehicle_reference_v1",
  );
  const createStart = migration.indexOf(
    "create or replace function public.rawaj_owner_create_vehicle_reference_from_queue_v1",
  );
  const helperStart = migration.indexOf(
    "create or replace function public.rawaj_set_vehicle_attribute_if_absent_v1",
  );
  const reviewAndCreate = migration.slice(reviewStart, helperStart);

  assert.ok(createStart > reviewStart);
  assert.doesNotMatch(reviewAndCreate, /insert into public\.listing_attribute_values/);
  assert.doesNotMatch(reviewAndCreate, /update public\.listings\s+set/i);
});

test("only reviewed entry RPCs are executable by authenticated clients", () => {
  for (const signature of [
    "rawaj_admin_fetch_vehicle_reference_queue_v1\\(\\s*text, text, integer, integer\\s*\\)",
    "rawaj_admin_review_vehicle_reference_v1\\(\\s*uuid, text, text, text, timestamptz\\s*\\)",
    "rawaj_owner_create_vehicle_reference_from_queue_v1\\(\\s*uuid, jsonb, text, timestamptz\\s*\\)",
    "rawaj_owner_apply_vehicle_reference_resolution_v1\\(\\s*uuid, timestamptz\\s*\\)",
  ]) {
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature}\\s+to authenticated`));
  }

  assert.match(
    migration,
    /revoke all on function public\.rawaj_set_vehicle_attribute_if_absent_v1\([\s\S]*?from public, anon, authenticated/,
  );
});
