import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607190034_taxonomy_mapping_review_apply_v1.sql",
    import.meta.url,
  ),
  "utf8",
);

test("mapping queue records review and application lifecycle without auto-apply", () => {
  assert.match(migration, /add column if not exists reviewed_listing_updated_at timestamptz/);
  assert.match(migration, /add column if not exists applied_by uuid references public\.profiles/);
  assert.match(migration, /'rejected', 'applied'/);
  assert.match(migration, /status <> 'applied'\s*\n\s*or \(applied_by is not null and applied_at is not null\)/);
  assert.doesNotMatch(migration, /update public\.listings\s+set\s+(?:category_id|subcategory_id|details)/i);
});

test("admin queue feed remains private, paginated, and status validated", () => {
  assert.match(migration, /rawaj_admin_fetch_taxonomy_mapping_queue_v1/);
  assert.match(migration, /not public\.current_user_is_admin_like\(\)/);
  assert.match(migration, /invalid_taxonomy_mapping_queue_status/);
  assert.match(migration, /least\(greatest\(coalesce\(p_limit, 50\), 1\), 200\)/);
  assert.match(migration, /'items', coalesce/);
});

test("review is stale-safe and validates an active leaf in the listing category", () => {
  assert.match(migration, /rawaj_admin_review_taxonomy_mapping_v1/);
  assert.match(migration, /stale_taxonomy_mapping_review/);
  assert.match(migration, /taxonomy_mapping_target_requires_active_leaf/);
  assert.match(migration, /with recursive lineage as/);
  assert.match(migration, /taxonomy_mapping_target_category_mismatch/);
  assert.match(migration, /status = 'confirmed'/);
  assert.match(migration, /status = 'rejected'/);
  assert.match(migration, /reviewed_listing_updated_at = v_listing\.updated_at/);
});

test("review decisions are audited but never change listing assignments", () => {
  assert.match(migration, /'taxonomy\.mapping_confirmed'/);
  assert.match(migration, /'taxonomy\.mapping_rejected'/);

  const reviewStart = migration.indexOf(
    "create or replace function public.rawaj_admin_review_taxonomy_mapping_v1",
  );
  const helperStart = migration.indexOf(
    "create or replace function public.rawaj_apply_legacy_attribute_patch_v1",
  );
  const reviewBody = migration.slice(reviewStart, helperStart);
  assert.doesNotMatch(reviewBody, /insert into public\.listing_taxonomy_assignments/);
  assert.doesNotMatch(reviewBody, /update public\.listing_taxonomy_assignments/);
});

test("owner application is publication-gated and protects reviewed listing state", () => {
  assert.match(migration, /rawaj_owner_apply_confirmed_taxonomy_mapping_v1/);
  assert.match(migration, /not public\.current_user_has_role\('owner'\)/);
  assert.match(migration, /taxonomy_mapping_requires_confirmed_review/);
  assert.match(migration, /stale_taxonomy_mapping_application/);
  assert.match(migration, /listing_changed_after_taxonomy_review/);
  assert.match(migration, /taxonomy_mapping_version_not_published/);
  assert.match(migration, /taxonomy_mapping_published_runtime_leaf_missing/);
  assert.match(migration, /insert into public\.listing_taxonomy_assignments/);
  assert.match(migration, /assignment_source = 'explicit'/);
  assert.match(migration, /'taxonomy\.mapping_applied'/);
});

test("legacy attribute patches fill only missing allowed fields", () => {
  assert.match(migration, /rawaj_apply_legacy_attribute_patch_v1/);
  assert.match(migration, /and not field_row\.is_sensitive/);
  assert.match(migration, /and not exists \(\s*\n\s*select 1\s*\n\s*from public\.listing_attribute_values existing_row/);
  assert.match(migration, /'legacy_backfill'/);
  assert.match(migration, /legacy_attribute_patch_keys_not_allowed/);
  assert.doesNotMatch(migration, /delete from public\.listing_attribute_values/);
});

test("RPC execution grants expose only reviewed entry points", () => {
  for (const signature of [
    "rawaj_admin_fetch_taxonomy_mapping_queue_v1\\(text, integer, integer\\)",
    "rawaj_admin_review_taxonomy_mapping_v1\\(\\s*uuid, text, uuid, text, text, timestamptz\\s*\\)",
    "rawaj_owner_apply_confirmed_taxonomy_mapping_v1\\(\\s*uuid, timestamptz\\s*\\)",
  ]) {
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature}\\s+to authenticated`));
  }

  assert.match(
    migration,
    /revoke all on function public\.rawaj_apply_legacy_attribute_patch_v1\([\s\S]*?from public, anon, authenticated/,
  );
});
