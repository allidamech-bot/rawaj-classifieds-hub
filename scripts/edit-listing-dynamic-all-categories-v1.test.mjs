import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile("src/routes/profile/listings.$id.tsx", "utf8");
const attributesClient = await readFile("src/lib/api/listing-attributes.ts", "utf8");
const migration = await readFile(
  "supabase/migrations/202607190039_owner_listing_attribute_read_v1.sql",
  "utf8",
);

test("edit listing loads governed schema and stored values for any published leaf", () => {
  assert.match(route, /fetchPublishedLeafSchema\(taxonomyNodeId\)/);
  assert.match(route, /fetchOwnerListingAttributes\(auth\.profile\.id, listing\.id\)/);
  assert.match(route, /sanitizeDynamicListingValues/);
  assert.match(route, /<DynamicListingFields/);
  assert.doesNotMatch(route, /dynamicSchemaActive\s*&&\s*categoryFieldKind\s*===\s*["']vehicles["']/);
});

test("edit listing validates and writes governed fields without replacing legacy details", () => {
  assert.match(route, /validateDynamicListingFields/);
  assert.match(route, /normalizeDynamicAttributesForWrite/);
  assert.match(route, /replaceOwnerListingAttributes/);
  assert.match(route, /initialDynamicValuesRef/);
  assert.match(route, /details:\s*\{\s*\.\.\.savedListing\.details\s*\}/);
});

test("owner attribute read contract is authenticated and taxonomy-aware", () => {
  assert.match(attributesClient, /rawaj_owner_fetch_listing_attributes_v1/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /listing_attribute_read_forbidden/);
  assert.match(migration, /taxonomyNodeId/);
  assert.match(migration, /jsonb_object_agg/);
  assert.match(migration, /revoke all on function public\.rawaj_owner_fetch_listing_attributes_v1/);
});
