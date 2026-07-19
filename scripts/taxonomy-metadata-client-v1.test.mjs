import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(
  new URL("../src/lib/api/taxonomy-metadata.ts", import.meta.url),
  "utf8",
);

test("client uses only stable metadata RPC contracts", () => {
  for (const rpc of [
    "rawaj_fetch_published_taxonomy_v1",
    "rawaj_fetch_published_leaf_schema_v1",
    "rawaj_fetch_vehicle_makes_v1",
    "rawaj_fetch_vehicle_models_v1",
    "rawaj_fetch_vehicle_model_children_v1",
  ]) {
    assert.match(client, new RegExp(`callPublicRpc\\("${rpc}"`));
  }

  assert.doesNotMatch(client, /\.from\("taxonomy_/);
  assert.doesNotMatch(client, /\.from\("vehicle_/);
});

test("client exposes typed taxonomy, leaf schema, and vehicle metadata", () => {
  for (const typeName of [
    "TaxonomyVersionMetadata",
    "PublishedTaxonomyNode",
    "PublishedTaxonomy",
    "PublishedLeafField",
    "PublishedLeafSchema",
    "VehicleMakeMetadata",
    "VehicleModelMetadata",
    "VehicleModelChildrenMetadata",
  ]) {
    assert.match(client, new RegExp(`export interface ${typeName}`));
  }
});

test("client validates required identifiers before network calls", () => {
  assert.match(client, /if \(!cleanNodeId\) return Promise\.resolve\(validationFailure/);
  assert.match(client, /if \(!cleanMakeId\) return Promise\.resolve\(validationFailure/);
  assert.match(client, /if \(!cleanModelId\) return Promise\.resolve\(validationFailure/);
});

test("client clamps public lookup limits and normalizes optional years", () => {
  assert.match(client, /clampInteger\(limit, 1, 200, 100\)/);
  assert.match(client, /clampInteger\(options\.limit, 1, 300, 200\)/);
  assert.match(client, /const cleanYear = nullableInteger\(options\.year\)/);
  assert.match(client, /const cleanYear = nullableInteger\(year\)/);
});

test("client caches metadata and deduplicates concurrent requests", () => {
  assert.match(client, /METADATA_CACHE_TTL_MS = 5 \* 60_000/);
  assert.match(client, /REFERENCE_CACHE_TTL_MS = 10 \* 60_000/);
  assert.match(client, /metadataCache/);
  assert.match(client, /metadataRequests/);
  assert.match(client, /const pending = metadataRequests\.get\(cacheKey\)/);
  assert.match(client, /if \(pending\) return pending/);
  assert.match(client, /invalidateTaxonomyMetadataCache/);
});

test("client parses untrusted JSONB payloads without unchecked field access", () => {
  assert.match(client, /function asRecord\(value: unknown\)/);
  assert.match(client, /function asRecordArray\(value: unknown\)/);
  assert.match(client, /function stringValue\(value: unknown\)/);
  assert.match(client, /function numberValue\(value: unknown\)/);
  assert.match(client, /\.map\(parseTaxonomyNode\)\.filter\(isPresent\)/);
  assert.match(client, /\.map\(parseLeafField\)\.filter\(isPresent\)/);
});

test("client supports public SSR reads and configured authenticated fallback", () => {
  assert.match(client, /if \(publicSupabase\) return \{ ok: true, data: publicSupabase \}/);
  assert.match(client, /return getClient\(\)/);
  assert.match(client, /mapError\(error, functionName\)/);
});
