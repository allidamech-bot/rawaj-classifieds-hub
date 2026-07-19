import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607190034_taxonomy_and_vehicle_review_queue_rpc_v1.sql",
    import.meta.url,
  ),
  "utf8",
);

test("taxonomy queue supports explicit review and terminal application states", () => {
  assert.match(migration, /'rejected',\s*\n\s*'applied'/);
  assert.match(migration, /add column if not exists applied_by/);
  assert.match(migration, /add column if not exists applied_at/);
  assert.match(migration, /Applied taxonomy mappings cannot be reviewed again/);
});

test("taxonomy queue reads and reviews require admin-like authority", () => {
  for (const functionName of [
    "rawaj_admin_fetch_taxonomy_mapping_queue_v1",
    "rawaj_admin_review_taxonomy_mapping_v1",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}`));
  }
  assert.match(migration, /not public\.current_user_is_admin_like\(\)/);
  assert.match(migration, /for update/);
  assert.match(migration, /v_action not in \('confirm', 'reject', 'unresolve'\)/);
});

test("confirmation validates a real active leaf without applying it", () => {
  assert.match(migration, /from public\.taxonomy_version_nodes/);
  assert.match(migration, /and is_active\s*\n\s*and is_leaf/);
  assert.match(migration, /status = 'confirmed'/);
  assert.doesNotMatch(
    migration,
    /rawaj_admin_review_taxonomy_mapping_v1[\s\S]*insert into public\.listing_taxonomy_assignments/,
  );
});

test("only owners can apply confirmed mappings from a published version", () => {
  assert.match(migration, /rawaj_owner_apply_confirmed_taxonomy_mappings_v1/);
  assert.match(migration, /not public\.current_user_has_role\('owner'\)/);
  assert.match(migration, /status = 'published'/);
  assert.match(migration, /where queue_row\.status = 'confirmed'/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /assignment_source = 'explicit'/);
  assert.match(migration, /status = 'applied'/);
});

test("queue mutations are audit logged", () => {
  assert.match(migration, /'taxonomy\.mapping_reviewed'/);
  assert.match(migration, /'taxonomy\.confirmed_mappings_applied'/);
  assert.match(migration, /'vehicle\.reference_reviewed'/);
  assert.match(migration, /public\.rawaj_insert_audit_log/);
});

test("vehicle review validates entity parent scope", () => {
  assert.match(migration, /v_queue\.entity_type = 'make'/);
  assert.match(migration, /make_id = v_queue\.parent_make_id/);
  assert.match(migration, /model_id = v_queue\.parent_model_id/);
  assert.match(migration, /Controlled vehicle reference does not match the queue scope/);
  assert.match(migration, /v_action not in \('match', 'created', 'reject'\)/);
});

test("review RPCs are authenticated-only entry points", () => {
  for (const signature of [
    "rawaj_admin_fetch_taxonomy_mapping_queue_v1\\(text, integer, integer\\)",
    "rawaj_admin_review_taxonomy_mapping_v1\\(uuid, text, uuid, text, text\\)",
    "rawaj_owner_apply_confirmed_taxonomy_mappings_v1\\(uuid, integer\\)",
    "rawaj_admin_fetch_vehicle_reference_review_queue_v1\\(text, text, integer, integer\\)",
    "rawaj_admin_review_vehicle_reference_v1\\(uuid, text, text, text\\)",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated`));
  }
});
