import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const entry = read("cloudflare/worker/src/entry.ts");
const publicCore = read("cloudflare/worker/src/index.ts");
const publicListings = read("cloudflare/worker/src/public-listings.ts");
const baseConfig = parseJsonc(read("cloudflare/worker/wrangler.base.jsonc"));
const renderConfig = read("cloudflare/worker/scripts/render-config.mjs");
const approvalGuard = read("cloudflare/worker/scripts/require-production-approval.mjs");
const workerPackage = JSON.parse(read("cloudflare/worker/package.json"));

test("D1 schema is a normalized Cloudflare application model", () => {
  for (const table of [
    "media_assets",
    "public_profiles",
    "location_nodes",
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
  assert.doesNotMatch(schema, /\bauth\.users\b|\bCREATE POLICY\b|\bplpgsql\b/i);
});

test("Worker routing is explicit and unknown routes cannot fall through", () => {
  assert.match(entry, /handlePublicCore/);
  assert.match(entry, /handleMarketplacePrivate/);
  assert.match(entry, /handleAccountSocial/);
  assert.match(entry, /handleVerification/);
  assert.match(entry, /handleTrustSupport/);
  assert.match(entry, /handleDiscovery/);
  assert.match(entry, /code: "not_found"/);
  assert.doesNotMatch(entry, /baseWorker\.fetch|env as never/);
  assert.match(publicCore, /export async function handlePublicCore/);
  assert.match(publicCore, /if \(!isPublicCorePath\(url\.pathname\)\) return null/);
  assert.match(publicListings, /l\.status = 'approved'/);
});

test("Wrangler configuration has one source of truth and local bindings are generated safely", () => {
  assert.equal(baseConfig.workers_dev, true);
  assert.equal(baseConfig.preview_urls, false);
  assert.equal(baseConfig.main, "src/entry.ts");
  assert.equal(baseConfig.d1_databases, undefined);
  assert.equal(baseConfig.r2_buckets, undefined);
  assert.doesNotMatch(baseConfig.vars.API_ALLOWED_ORIGINS, /localhost|127\.0\.0\.1/);
  assert.match(renderConfig, /process\.argv\.includes\("--local"\)/);
  assert.match(renderConfig, /00000000-0000-0000-0000-000000000000/);
  assert.match(renderConfig, /http:\/\/localhost:8080/);
  assert.match(renderConfig, /CLOUDFLARE_D1_DATABASE_ID/);
  assert.match(renderConfig, /CLOUDFLARE_R2_BUCKET_NAME/);
});

test("production migration and deploy commands are separated and approval-gated", () => {
  assert.equal(workerPackage.scripts.deploy, undefined);
  assert.equal(workerPackage.scripts["migrate:remote"], undefined);
  assert.match(workerPackage.scripts["migrate:production"], /require-production-approval/);
  assert.match(workerPackage.scripts["deploy:production"], /require-production-approval/);
  assert.doesNotMatch(
    workerPackage.scripts["deploy:production"],
    /migrations apply|migrate:production/,
  );
  assert.match(approvalGuard, /DEPLOY_RAWAJ_SYRIA_WORKER_PRODUCTION/);
  assert.match(approvalGuard, /workflow_dispatch/);
  assert.match(approvalGuard, /expectedCommitSha !== githubSha/);
});

test("retired external-backend migration tooling is absent from the operational tree", () => {
  assert.equal(existsSync("cloudflare/migration"), false);
  assert.equal(existsSync("e2e/staging-write-acceptance.spec.ts"), false);
  assert.equal(existsSync("scripts/replay-supabase-local.mjs"), false);
});
