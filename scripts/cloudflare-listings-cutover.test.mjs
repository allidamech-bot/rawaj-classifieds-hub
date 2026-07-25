import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("listing frontend transport is Cloudflare-only", async () => {
  const source = await read("src/lib/api/listings.ts");
  assert.doesNotMatch(source, /@supabase\/supabase-js|\bgetClient\b|\.storage\.|\.rpc\(/);
  assert.match(source, /fetchCloudflareListings/);
  assert.match(source, /fetchCloudflareListingDetail/);
  assert.match(source, /cloudflareApiRequest/);
  assert.match(source, /\/v1\/listing-images\//);
});

test("draft creation sends the stable request id to Cloudflare", async () => {
  const source = await read("src/lib/api/listing-draft-create-rpc.ts");
  assert.doesNotMatch(source, /@supabase\/supabase-js|\bgetClient\b|\.rpc\(|\.from\(/);
  assert.match(source, /creationRequestId:\s*cleanRequestId/);
  assert.match(source, /\/v1\/listings/);
});

test("Worker routes legacy api listing reads through the isolated marketplace handler", async () => {
  const source = await read("cloudflare/worker/src/entry.ts");
  assert.match(source, /path\.replace\(\/\^\\\/api\\b\//);
  assert.match(source, /path\.startsWith\("\/api\/"\)/);
});

test("Worker persists listing contact options and parses D1 JSON", async () => {
  const source = await read("cloudflare/worker/src/marketplace-private.ts");
  assert.match(source, /JSON\.stringify\(input\.contactOptions\)/);
  assert.match(source, /contact_options = \?/);
  assert.match(source, /contactOptions:\s*booleanRecord\(row\.contact_options\)/);
  assert.match(source, /details:\s*jsonObject\(row\.details\)/);
});

test("draft creation is idempotent in D1", async () => {
  const migration = await read("cloudflare/d1/migrations/0007_listing_creation_idempotency.sql");
  const worker = await read("cloudflare/worker/src/marketplace-private.ts");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS listing_creation_requests/);
  assert.match(migration, /PRIMARY KEY \(user_id, request_id\)/);
  assert.match(worker, /FROM listing_creation_requests r/);
  assert.match(worker, /INSERT INTO listing_creation_requests/);
});

test("draft image metadata is not exposed without owner authorization", async () => {
  const source = await read("cloudflare/worker/src/marketplace-private.ts");
  assert.match(source, /listing\.status !== "approved" && listing\.owner_id !== auth\?\.userId/);
  assert.match(source, /listing\.status === "approved" \? "\/v1\/media\/assets"/);
});

test("listing attributes use authenticated Cloudflare endpoints only", async () => {
  const source = await read("src/lib/api/listing-attributes.ts");
  assert.doesNotMatch(source, /@supabase|\bgetClient\b|\.rpc\(|\.from\(/);
  assert.match(source, /\/attributes\/completeness/);
  assert.match(source, /method:\s*"PATCH"/);
  assert.match(source, /expectedUpdatedAt/);
});


test("Vite resolves listing attributes to the current Cloudflare implementation", async () => {
  const [viteConfig, source] = await Promise.all([
    read("vite.config.ts"),
    read("src/lib/api/listing-attributes.ts"),
  ]);
  assert.doesNotMatch(viteConfig, /listing-attributes-cloudflare/);
  assert.match(source, /cloudflareApiRequest/);
});
