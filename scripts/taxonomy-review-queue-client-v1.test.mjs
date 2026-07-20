import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(
  new URL("../src/lib/api/taxonomy-review-queues.ts", import.meta.url),
  "utf8",
);

test("client uses only governed queue RPCs", () => {
  for (const rpc of [
    "rawaj_admin_fetch_taxonomy_mapping_queue_v1",
    "rawaj_admin_review_taxonomy_mapping_v1",
    "rawaj_owner_apply_confirmed_taxonomy_mapping_v1",
    "rawaj_admin_fetch_vehicle_reference_queue_v1",
    "rawaj_admin_review_vehicle_reference_v1",
    "rawaj_owner_create_vehicle_reference_from_queue_v1",
    "rawaj_owner_apply_vehicle_reference_resolution_v1",
  ]) {
    assert.match(client, new RegExp(`"${rpc}"`));
  }

  assert.match(client, /clientResult\.data\.rpc/);
  assert.doesNotMatch(client, /\.from\("taxonomy_mapping_queue"/);
  assert.doesNotMatch(client, /\.from\("vehicle_reference_review_queue"/);
});

test("client exposes typed queue status and entity contracts", () => {
  for (const typeName of [
    "TaxonomyMappingQueueStatus",
    "VehicleReferenceQueueStatus",
    "VehicleReferenceEntityType",
    "ReviewQueuePage",
    "TaxonomyMappingQueueItem",
    "VehicleReferenceQueueItem",
    "VehicleReferenceDraft",
  ]) {
    assert.match(client, new RegExp(`export (?:type|interface) ${typeName}`));
  }
});

test("client carries optimistic concurrency tokens for all mutations", () => {
  assert.match(client, /p_expected_queue_updated_at: input\.expectedQueueUpdatedAt\.trim\(\)/);
  assert.match(client, /p_expected_reviewed_at: expectedReviewedAt\.trim\(\)/);
  assert.match(client, /stale_/);
  assert.match(client, /تغيّرت بيانات المراجعة/);
});

test("client clamps pagination and validates required identifiers", () => {
  assert.match(client, /clampInteger\(options\.limit, 1, 200, 50\)/);
  assert.match(client, /clampInteger\(options\.offset, 0, 1_000_000, 0\)/);
  assert.match(client, /if \(!input\.listingId\.trim\(\) \|\| !input\.expectedQueueUpdatedAt\.trim\(\)\)/);
  assert.match(client, /if \(!queueId\.trim\(\) \|\| !expectedReviewedAt\.trim\(\)\)/);
});

test("client parses untrusted queue payloads and discards invalid rows", () => {
  assert.match(client, /function parseTaxonomyMappingQueueItem/);
  assert.match(client, /function parseVehicleReferenceQueueItem/);
  assert.match(client, /items: array\(payload\.items\)\.map\(parser\)\.filter\(isPresent\)/);
  assert.match(client, /function taxonomyStatus/);
  assert.match(client, /function vehicleStatus/);
  assert.match(client, /function vehicleEntityType/);
});

test("owner-only catalog creation keeps the complete controlled reference payload", () => {
  for (const field of [
    "id",
    "slug",
    "nameAr",
    "nameEn",
    "aliases",
    "countryCode",
    "vehicleType",
    "generationId",
    "startYear",
    "endYear",
  ]) {
    assert.match(client, new RegExp(`${field}`));
  }
  assert.match(client, /p_reference: input\.reference/);
});
