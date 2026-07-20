import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, attributesApi, ownerVersion, addListing] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/202607190032_listing_attribute_write_contract_v1.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/lib/api/listing-attributes.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-owner-version.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
]);

test("public listing attributes require a visible live listing and a non-sensitive field", () => {
  assert.match(migration, /create policy listing_attribute_values_public_read/);
  assert.match(migration, /listing_row\.status = 'approved'/);
  assert.match(migration, /listing_row\.archived_at is null/);
  assert.match(migration, /listing_row\.expires_at is null or listing_row\.expires_at > now\(\)/);
  assert.match(migration, /field_row\.is_active/);
  assert.match(migration, /not field_row\.is_sensitive/);
});

test("owners and admin-like staff retain authorized attribute reads", () => {
  assert.match(migration, /create policy listing_attribute_values_owner_read/);
  assert.match(migration, /listing_row\.owner_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /create policy listing_attribute_values_admin_read/);
  assert.match(migration, /using \(public\.current_user_is_admin_like\(\)\)/);
});

test("attribute completeness is leaf-scoped and returns stable missing-field metadata", () => {
  assert.match(
    migration,
    /create or replace function public\.rawaj_listing_attribute_completeness_v1/,
  );
  assert.match(migration, /version_row\.status = 'published'/);
  assert.match(migration, /node_row\.is_active/);
  assert.match(migration, /node_row\.is_leaf/);
  assert.match(migration, /'published_taxonomy_leaf_required'/);
  assert.match(migration, /'required_listing_attributes_missing'/);
  assert.match(migration, /'missingRequiredFields'/);
  assert.match(migration, /'fieldKey', rule_row\.field_key/);
  assert.match(migration, /'labelAr', field_row\.label_ar/);
  assert.match(migration, /'labelEn', field_row\.label_en/);
});

test("owner attribute replacement is authenticated, owned, editable, and stale-safe", () => {
  assert.match(
    migration,
    /create or replace function public\.rawaj_owner_replace_listing_attributes_v1/,
  );
  assert.match(migration, /v_listing\.owner_id <> v_actor/);
  assert.match(migration, /v_listing\.status not in \('draft', 'rejected'\)/);
  assert.match(migration, /v_listing\.updated_at is distinct from p_expected_updated_at/);
  assert.match(migration, /raise exception 'stale_owner_update'/);
  assert.match(migration, /for update/);
});

test("successful attribute reads and writes refresh the client owner-version guard", () => {
  assert.match(ownerVersion, /export function rememberOwnerListingUpdatedAt/);
  assert.match(ownerVersion, /ownerListingVersions\.set\(versionKey\(userId, cleanListingId\)/);
  assert.match(attributesApi, /import \{ rememberOwnerListingUpdatedAt \}/);
  assert.match(
    attributesApi,
    /rememberOwnerListingUpdatedAt\(userId, returnedListingId, listingUpdatedAt\)/,
  );
  assert.match(attributesApi, /rememberOwnerListingUpdatedAt\(userId, returnedListingId, updatedAt\)/);
  assert.match(addListing, /updatedAt: attributeResult\.data\.updatedAt/);
});

test("replacement accepts only fields in the published active leaf schema", () => {
  assert.match(migration, /published_taxonomy_leaf_required/);
  assert.match(migration, /jsonb_object_keys\(v_attributes\)/);
  assert.match(migration, /listing_attribute_keys_not_allowed/);
  assert.match(migration, /rule_row\.version_id = v_version_id/);
  assert.match(migration, /rule_row\.taxonomy_node_id = v_taxonomy_node_id/);
  assert.match(migration, /field_row\.is_active/);
  assert.match(migration, /delete from public\.listing_attribute_values/);
  assert.match(migration, /where listing_id = p_listing_id/);
});

test("typed JSON values map to exactly one canonical storage column", () => {
  assert.match(migration, /listing_attribute_text_json_required/);
  assert.match(migration, /listing_attribute_numeric_json_required/);
  assert.match(migration, /listing_attribute_boolean_json_required/);
  assert.match(migration, /listing_attribute_date_json_required/);
  assert.match(migration, /listing_attribute_key_json_required/);
  assert.match(migration, /listing_attribute_array_json_required/);
  assert.match(migration, /value_text, source/);
  assert.match(migration, /value_numeric, source/);
  assert.match(migration, /value_boolean, source/);
  assert.match(migration, /value_date, source/);
  assert.match(migration, /value_key, source/);
  assert.match(migration, /value_json, source/);
});

test("vehicle references are inserted in dependency order", () => {
  assert.match(migration, /when 'vehicle_makes' then 10/);
  assert.match(migration, /when 'vehicle_models_by_make' then 20/);
  assert.match(migration, /when 'vehicle_generations_by_model' then 30/);
  assert.match(migration, /when 'vehicle_trims_by_model' then 40/);
});

test("client entry points expose only authenticated governed RPC execution", () => {
  for (const signature of [
    "rawaj_listing_attribute_completeness_v1\\(uuid\\)",
    "rawaj_owner_replace_listing_attributes_v1\\(uuid, timestamptz, jsonb\\)",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature}\\s+from public, anon`),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${signature}\\s+to authenticated`),
    );
  }

  assert.doesNotMatch(
    migration,
    /grant execute on function public\.rawaj_owner_replace_listing_attributes_v1[^;]+to anon/,
  );
});

test("migration is additive cutover preparation and does not change submit behavior", () => {
  assert.match(migration, /Additive cutover preparation only/);
  assert.match(migration, /Existing listing write and submit behavior is unchanged/);
  assert.doesNotMatch(migration, /create or replace function public\.rawaj_submit_listing_for_review/);
  assert.doesNotMatch(migration, /update public\.listings\s+set\s+status/i);
});
