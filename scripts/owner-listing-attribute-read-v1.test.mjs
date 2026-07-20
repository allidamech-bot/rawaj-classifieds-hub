import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607190039_owner_listing_attribute_read_v1.sql",
    import.meta.url,
  ),
  "utf8",
);
const client = await readFile(
  new URL("../src/lib/api/listing-attributes.ts", import.meta.url),
  "utf8",
);

test("attribute hydration is owner/admin-only and authenticated", () => {
  assert.match(migration, /rawaj_owner_fetch_listing_attributes_v1/);
  assert.match(migration, /if v_actor is null/);
  assert.match(migration, /v_listing\.owner_id <> v_actor and not public\.current_user_is_admin_like\(\)/);
  assert.match(migration, /listing_attribute_read_forbidden/);
  assert.match(migration, /revoke all on function public\.rawaj_owner_fetch_listing_attributes_v1\(uuid\)[\s\S]*from public, anon/);
  assert.match(migration, /grant execute on function public\.rawaj_owner_fetch_listing_attributes_v1\(uuid\)[\s\S]*to authenticated/);
});

test("hydration returns every governed scalar type without category-specific branching", () => {
  for (const fieldType of [
    "text",
    "textarea",
    "integer",
    "year",
    "numeric",
    "boolean",
    "date",
    "multi_select",
  ]) {
    assert.match(migration, new RegExp(`when '${fieldType}'`));
  }
  assert.match(migration, /else to_jsonb\(attribute_row\.value_key\)/);
  assert.match(migration, /jsonb_object_agg/);
  assert.match(migration, /taxonomy_field_rules/);
  assert.doesNotMatch(migration, /filter_schema_key\s*=\s*'vehicles'/);
  assert.doesNotMatch(migration, /category_id\s*=\s*'vehicles'/);
});

test("read RPC reports the listing concurrency token and published leaf", () => {
  for (const key of [
    "listingUpdatedAt",
    "listingStatus",
    "taxonomyVersionId",
    "taxonomyVersionNumber",
    "taxonomyNodeId",
    "valueCount",
    "values",
  ]) {
    assert.match(migration, new RegExp(`'${key}'`));
  }
  assert.match(migration, /where version_row\.status = 'published'/);
  assert.match(migration, /node_row\.is_active/);
  assert.match(migration, /node_row\.is_leaf/);
});

test("client exposes typed hydration and parses untrusted JSON", () => {
  assert.match(client, /export interface OwnerListingAttributeValues/);
  assert.match(client, /export async function fetchOwnerListingAttributes/);
  assert.match(client, /rawaj_owner_fetch_listing_attributes_v1/);
  assert.match(client, /listingUpdatedAt: string/);
  assert.match(client, /values: Record<string, unknown>/);
  assert.match(client, /values: record\(payload\.values\)/);
  assert.match(client, /taxonomyVersionNumber: nullableNumber/);
});

test("client never reads the private table directly", () => {
  assert.doesNotMatch(client, /\.from\("listing_attribute_values"/);
  assert.match(client, /listing_attribute_read_forbidden/);
  assert.match(client, /لا تملك صلاحية قراءة تفاصيل هذا الإعلان المنظمة/);
});
