import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const wrangler = JSON.parse(read("wrangler.jsonc"));
const r2Server = read("src/lib/server/r2-listing-images.ts");
const r2Route = read("src/routes/api.listing-images.ts");
const r2Client = read("src/lib/r2-listing-images-client.ts");
const migrationTool = read("scripts/migrate-supabase-listing-images-to-r2.mjs");

const secretNames = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
];

test("Cloudflare Worker deployment stays private and explicit", () => {
  assert.equal(wrangler.name, "rawaj-classifieds-hub");
  assert.equal(wrangler.main, ".output/server/index.mjs");
  assert.equal(wrangler.assets?.directory, ".output/public");
  assert.ok(wrangler.compatibility_flags?.includes("nodejs_compat"));
  assert.equal(wrangler.observability?.enabled, true);
  assert.equal(wrangler.route, undefined);
  assert.equal(wrangler.routes, undefined);
  assert.equal(wrangler.workers_dev, false);
  assert.equal(wrangler.preview_urls, false);
});

test("R2 credentials remain server-only", () => {
  for (const name of secretNames) {
    assert.match(r2Server, new RegExp(`process\\.env\\.${name}`));
    assert.doesNotMatch(r2Server, new RegExp(`VITE_${name}`));
    assert.doesNotMatch(r2Client, new RegExp(name));
  }
});

test("R2 listing image API preserves authorization and upload limits", () => {
  assert.match(r2Route, /MAX_IMAGE_BYTES\s*=\s*5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(r2Route, /image\/jpeg/);
  assert.match(r2Route, /image\/png/);
  assert.match(r2Route, /image\/webp/);
  assert.match(r2Route, /\.eq\("owner_id", auth\.userId\)/);
  assert.match(r2Route, /\.in\("status", \["draft", "rejected"\]\)/);
  assert.match(r2Route, /key\.startsWith\(`\$\{auth\.userId\}\/\$\{listingId\}\/`\)/);
});

test("R2 rollout remains backward compatible with Supabase images", () => {
  assert.match(r2Client, /R2_LISTING_IMAGE_PREFIX\s*=\s*"r2:"/);
  assert.match(r2Client, /response\.status === 503/);
  assert.match(r2Client, /return \{ handled: false \}/);
});

test("existing image migration is dry-run first, verifiable, and non-destructive", () => {
  assert.match(migrationTool, /apply:\s*false/);
  assert.match(migrationTool, /if \(!options\.apply\)/);
  assert.match(migrationTool, /const targetKey = row\.storage_path/);
  assert.match(migrationTool, /futureStoragePath:\s*`r2:\$\{targetKey\}`/);
  assert.match(migrationTool, /x-amz-meta-sha256/);
  assert.match(migrationTool, /R2 checksum verification failed after upload/);
  assert.match(migrationTool, /databaseMutation:\s*false/);
  assert.match(migrationTool, /sourceDeletion:\s*false/);
  assert.doesNotMatch(migrationTool, /\.from\("listing_images"\)\s*\.update\(/s);
  assert.doesNotMatch(migrationTool, /method:\s*"DELETE"/);
});
