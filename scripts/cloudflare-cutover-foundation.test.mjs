import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const parseJsonc = (source) =>
  JSON.parse(
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/,\s*([}\]])/g, "$1"),
  );

const schema = read("cloudflare/d1/migrations/0002_public_marketplace_foundation.sql");
const worker = read("cloudflare/worker/src/index.ts");
const workerEntry = read("cloudflare/worker/src/entry.ts");
const publicListings = read("cloudflare/worker/src/public-listings.ts");
const baseConfig = parseJsonc(read("cloudflare/worker/wrangler.base.jsonc"));
const renderConfig = read("cloudflare/worker/scripts/render-config.mjs");
const exporter = read("cloudflare/migration/export-public-snapshot.mjs");
const mediaMigration = read("cloudflare/migration/migrate-media-to-r2.mjs");

test("D1 schema is a normalized Cloudflare read model", () => {
  for (const table of [
    "rawaj_import_batches",
    "media_assets",
    "public_profiles",
    "location_regions",
    "location_nodes",
    "location_region_members",
    "location_search_aliases",
    "listings",
    "listing_taxonomy_assignments",
    "listing_images",
    "ad_placements",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE ${table}\\b`));
  }

  assert.match(schema, /CREATE VIRTUAL TABLE listings_fts USING fts5/);
  assert.match(schema, /FOREIGN KEY \(media_asset_id\) REFERENCES media_assets/);
  assert.match(schema, /checksum_sha256 TEXT NOT NULL/);
  assert.doesNotMatch(schema, /\bauth\.users\b|\bCREATE POLICY\b|\bplpgsql\b/i);
});

test("Worker exposes a versioned API and never exposes arbitrary R2 keys", () => {
  for (const route of [
    "/health",
    "/references",
    "/ad-placements",
    "/listings",
    "/media/assets/",
  ]) {
    assert.match(worker, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(worker, /interface Env[\s\S]*DB: D1Database[\s\S]*MEDIA: R2Bucket/);
  assert.match(worker, /m\.status = 'ready'/);
  assert.match(worker, /l\.status = 'approved'/);
  assert.match(worker, /object_key/);
  assert.doesNotMatch(worker, /@supabase|supabase\.co|SUPABASE_/i);
  assert.doesNotMatch(worker, /pathname\.slice\(1\).*MEDIA\.get/s);
});

test("Wrangler uses a modular entry without bypassing the base API", () => {
  assert.equal(baseConfig.workers_dev, false);
  assert.equal(baseConfig.preview_urls, false);
  assert.equal(baseConfig.main, "src/entry.ts");
  assert.equal(baseConfig.d1_databases, undefined);
  assert.equal(baseConfig.r2_buckets, undefined);
  assert.match(workerEntry, /handlePublicListingsRequest/);
  assert.match(workerEntry, /baseWorker\.fetch/);
  assert.match(publicListings, /\.bind\(\.\.\.values\)/);
  assert.match(renderConfig, /CLOUDFLARE_D1_DATABASE_ID/);
  assert.match(renderConfig, /CLOUDFLARE_R2_BUCKET_NAME/);
  assert.match(renderConfig, /migrations_dir: "\.\.\/d1\/migrations"/);
});

test("Snapshot export is repeatable, read-only, and non-destructive", () => {
  assert.match(
    exporter,
    /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/,
  );
  assert.match(exporter, /snapshot-manifest\.json/);
  assert.match(exporter, /media-manifest\.json/);
  assert.match(exporter, /source_checksum_sha256/);
  assert.doesNotMatch(exporter, /\bDELETE FROM public\.|\bUPDATE public\.|\bDROP TABLE\b/i);
});

test("Media migration verifies checksums and only emits D1 finalization SQL", () => {
  assert.match(mediaMigration, /x-amz-meta-sha256/);
  assert.match(mediaMigration, /R2 checksum verification failed/);
  assert.match(mediaMigration, /UPDATE media_assets/);
  assert.match(mediaMigration, /status = 'ready'/);
  assert.doesNotMatch(mediaMigration, /\.remove\(|sourceDeletion|DELETE FROM/i);
});
