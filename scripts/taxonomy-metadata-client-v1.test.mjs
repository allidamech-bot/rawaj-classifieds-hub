import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(
  new URL("../src/lib/api/taxonomy-metadata.ts", import.meta.url),
  "utf8",
);

test("client uses only Cloudflare taxonomy and vehicle contracts", () => {
  for (const endpoint of [
    "/v1/references",
    "/v1/taxonomy/leaf/",
    "/v1/vehicles/makes",
    "/v1/vehicles/models",
    "/children",
  ]) {
    assert.ok(client.includes(endpoint), `missing Cloudflare endpoint ${endpoint}`);
  }

  assert.match(client, /cloudflareApiRequest/);
  assert.doesNotMatch(client, /@supabase\/supabase-js|publicSupabase|getClient|\.rpc\(|\.from\(/);
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

test("client parses untrusted payloads without unchecked field access", () => {
  assert.match(client, /function record\(value: unknown\)/);
  assert.match(client, /function records\(value: unknown\)/);
  assert.match(client, /function text\(value: unknown\)/);
  assert.match(client, /function numeric\(value: unknown\)/);
  assert.match(client, /\.map\(parseTaxonomyNode\)\.filter\(present\)/);
  assert.match(client, /\.map\(parseLeafField\)\.filter\(present\)/);
});

test("client fails through the Cloudflare API envelope with no provider fallback", () => {
  assert.match(client, /function apiFailure/);
  assert.match(client, /code: result\.code as ClassifiedsErrorCode/);
  assert.doesNotMatch(client, /SupabaseClient|mapError|publicSupabase|getClient/);
});
