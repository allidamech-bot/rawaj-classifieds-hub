import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607190036_dynamic_listing_submit_guard_v1.sql",
    import.meta.url,
  ),
  "utf8",
);

test("submit keeps the existing authentication, restriction, ownership, and core-field gates", () => {
  assert.match(migration, /create or replace function public\.rawaj_submit_listing_for_review/);
  assert.match(migration, /if v_actor is null/);
  assert.match(migration, /account_status in \('frozen', 'disabled'\)/);
  assert.match(migration, /restriction_type = 'posting'/);
  assert.match(migration, /l\.owner_id = v_actor/);
  assert.match(migration, /l\.status in \('draft', 'rejected'\)/);
  assert.match(migration, /Listing category, governorate, and title are required/);
});

test("dynamic enforcement activates only for a published version with governed field rules", () => {
  assert.match(migration, /version_row\.status = 'published'/);
  assert.match(migration, /exists \(\s*\n\s*select 1\s*\n\s*from public\.taxonomy_field_rules rule_row/);
  assert.match(migration, /if v_dynamic_version_id is not null then/);
  assert.match(migration, /node_row\.is_active/);
  assert.match(migration, /node_row\.is_leaf/);
  assert.match(migration, /listing_published_taxonomy_leaf_required/);
});

test("required attribute completeness is checked before status mutation", () => {
  const completenessPosition = migration.indexOf("rawaj_listing_attribute_completeness_v1");
  const statusPosition = migration.indexOf("status = 'pending_review'");

  assert.ok(completenessPosition > 0);
  assert.ok(statusPosition > completenessPosition);
  assert.match(migration, /listing_attributes_incomplete/);
  assert.match(migration, /missingRequiredFields/);
  assert.match(migration, /taxonomyNodeId/);
});

test("successful submission preserves the established moderation reset contract", () => {
  assert.match(migration, /status = 'pending_review'/);
  assert.match(migration, /reviewed_by = null/);
  assert.match(migration, /reviewed_at = null/);
  assert.match(migration, /rejection_reason = null/);
  assert.match(migration, /published_at = null/);
  assert.match(migration, /archived_at = null/);
  assert.match(migration, /return query select l\.\* from public\.listings l where l\.id = p_listing_id/);
});

test("submit RPC remains authenticated-only and pins search path", () => {
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(
    migration,
    /revoke all on function public\.rawaj_submit_listing_for_review\(uuid\) from public, anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.rawaj_submit_listing_for_review\(uuid\) to authenticated/,
  );
});
