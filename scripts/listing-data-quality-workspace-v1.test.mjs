import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607190037_listing_data_quality_workspace_v1.sql",
    import.meta.url,
  ),
  "utf8",
);

test("data quality workspace is category-wide rather than vehicle-only", () => {
  assert.match(migration, /create table if not exists public\.listing_data_quality_issues/);
  for (const issueType of [
    "taxonomy",
    "required_field",
    "unexpected_field",
    "invalid_value",
    "legacy_payload",
    "specialized_reference",
  ]) {
    assert.match(migration, new RegExp(`'${issueType}'`));
  }
  assert.match(migration, /from public\.listings listing_row/);
  assert.match(migration, /from public\.taxonomy_field_rules rule_row/);
  assert.doesNotMatch(
    migration,
    /where\s+v_target_node\.filter_schema_key\s*=\s*'vehicles'[\s\S]*for v_field in/i,
  );
});

test("scanner validates governed taxonomy and fields for every leaf", () => {
  for (const marker of [
    "taxonomy_unresolved",
    "taxonomy_target_not_active_leaf",
    "taxonomy_category_mismatch",
    "taxonomy_mapping_needs_review",
    "required_field_missing",
    "field_not_allowed_for_leaf",
    "controlled_option_invalid",
    "numeric_value_out_of_range",
    "text_value_too_long",
    "legacy_details_require_mapping",
  ]) {
    assert.match(migration, new RegExp(`'${marker}'`));
  }
  assert.match(migration, /public\.option_values/);
  assert.match(migration, /public\.listing_attribute_values/);
  assert.match(migration, /jsonb_object_keys\(v_listing\.details\)/);
});

test("vehicle references remain a specialized subqueue within the general workspace", () => {
  assert.match(migration, /public\.vehicle_reference_review_queue/);
  assert.match(migration, /vehicle_reference_resolution_pending/);
  assert.match(migration, /'specialized_reference'/);
});

test("refresh is owner-only and review operations are admin-like and stale-safe", () => {
  assert.match(migration, /rawaj_owner_refresh_listing_data_quality_v1/);
  assert.match(migration, /not public\.current_user_has_role\('owner'\)/);
  assert.match(migration, /rawaj_admin_fetch_listing_data_quality_v1/);
  assert.match(migration, /rawaj_admin_review_listing_data_quality_v1/);
  assert.match(migration, /not public\.current_user_is_admin_like\(\)/);
  assert.match(migration, /stale_data_quality_review/);
  assert.match(migration, /data_quality\.issue_reviewed/);
  assert.match(migration, /data_quality\.listings_scanned/);
});

test("quality review never silently rewrites listing or canonical attribute values", () => {
  assert.doesNotMatch(migration, /update public\.listings\b/i);
  assert.doesNotMatch(migration, /delete from public\.listing_attribute_values\b/i);
  assert.doesNotMatch(migration, /insert into public\.listing_attribute_values\b/i);
  assert.match(migration, /Review-only; no automatic listing mutation/);
});

test("private issue storage is exposed only through governed RPCs", () => {
  assert.match(
    migration,
    /revoke all on table public\.listing_data_quality_issues from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.rawaj_upsert_listing_data_quality_issue_v1[\s\S]*from public, anon, authenticated/,
  );
  for (const signature of [
    "rawaj_owner_refresh_listing_data_quality_v1",
    "rawaj_admin_fetch_listing_data_quality_v1",
    "rawaj_admin_review_listing_data_quality_v1",
  ]) {
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature}`));
  }
});
