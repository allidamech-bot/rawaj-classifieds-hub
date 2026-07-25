import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile("src/lib/api/retention-discovery.ts", "utf8");
const worker = await readFile("cloudflare/worker/src/account-social.ts", "utf8");
const entry = await readFile("cloudflare/worker/src/entry.ts", "utf8");
const schema = await readFile("cloudflare/d1/migrations/0003_full_backend_core.sql", "utf8");

test("retention frontend is Cloudflare-only", () => {
  assert.doesNotMatch(client, /@supabase\/supabase-js|\bgetClient\b|\.rpc\(|\.from\(|\.storage\b/);
  assert.match(client, /cloudflareApiRequest/);
  assert.match(client, /fetchCloudflareListingDetail/);
});

test("recent views use authenticated Worker routes with anonymous local fallback", () => {
  assert.match(client, /\/v1\/listings\/\$\{encodeURIComponent\(cleanListingId\)\}\/recent-view/);
  assert.match(client, /\/v1\/account\/recent-views/);
  assert.match(client, /recordLocalRecentView/);
  assert.match(worker, /INSERT INTO recent_listing_views/);
  assert.match(worker, /ON CONFLICT\(user_id, listing_id\) DO UPDATE/);
  assert.match(worker, /DELETE FROM recent_listing_views WHERE user_id = \?/);
});

test("seller follows are server-authorized and self-follow is rejected", () => {
  assert.match(client, /\/v1\/sellers\/\$\{encodeURIComponent\(cleanSellerId\)\}\/follow/);
  assert.match(worker, /sellerId === auth\.userId/);
  assert.match(worker, /INSERT OR IGNORE INTO seller_follows/);
  assert.match(worker, /DELETE FROM seller_follows WHERE follower_id = \? AND seller_id = \?/);
  assert.match(worker, /p\.account_status = 'active'/);
});

test("entry routes retention before the final 404", () => {
  const socialIndex = entry.indexOf("if (isAccountSocialPath(path))");
  const finalNotFound = entry.lastIndexOf('code: "not_found"');
  assert.ok(socialIndex >= 0 && finalNotFound > socialIndex);
  assert.doesNotMatch(entry, /baseWorker\.fetch/);
  assert.match(entry, /recent-views/);
  assert.match(entry, /followed-sellers/);
  assert.match(entry, /recent-view/);
  assert.match(entry, /sellers\\\/\[\^\/\]\+\\\/follow/);
});

test("D1 contains the ownership and uniqueness constraints for retention", () => {
  assert.match(schema, /CREATE TABLE recent_listing_views/);
  assert.match(schema, /PRIMARY KEY \(user_id, listing_id\)/);
  assert.match(schema, /CREATE TABLE seller_follows/);
  assert.match(schema, /PRIMARY KEY \(follower_id, seller_id\)/);
  assert.match(schema, /CHECK \(follower_id <> seller_id\)/);
});
