import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [worker, entry, migration, lifecycle, reservation, expiry, context, drops, promotions, social] =
  await Promise.all([
    read("cloudflare/worker/src/listing-operations.ts"),
    read("cloudflare/worker/src/entry.ts"),
    read("cloudflare/d1/migrations/0013_listing_lifecycle_price_and_retention.sql"),
    read("src/lib/api/listing-lifecycle.ts"),
    read("src/lib/api/listing-reservation.ts"),
    read("src/lib/api/listing-expiry-retention.ts"),
    read("src/lib/api/listing-price-context.ts"),
    read("src/lib/api/price-drops.ts"),
    read("src/lib/api/promotions.ts"),
    read("cloudflare/worker/src/account-social.ts"),
  ]);

const clients = [lifecycle, reservation, expiry, context, drops, promotions];

test("listing operation clients are Cloudflare-only", () => {
  for (const source of clients) {
    assert.doesNotMatch(source, /@supabase\/supabase-js|\bgetClient\b|\.rpc\(|\.from\(["']|\.storage\b/);
    assert.match(source, /cloudflare/);
  }
});

test("lifecycle transitions are authenticated and ownership constrained", () => {
  assert.match(worker, /requireMutationAuth/);
  assert.match(worker, /WHERE id = \? AND owner_id = \?/);
  assert.match(worker, /Only approved listings may be closed/);
  assert.match(worker, /status = 'pending_review'/);
  assert.match(worker, /restriction_type = 'posting'/);
});

test("price reductions are real, immutable, and at least one percent", () => {
  assert.match(worker, /discount < 1/);
  assert.match(worker, /INSERT OR IGNORE INTO listing_price_changes/);
  assert.match(migration, /new_price REAL NOT NULL CHECK \(new_price > 0 AND new_price < old_price\)/);
  assert.match(migration, /idx_listing_price_changes_transition_unique/);
  assert.match(worker, /l\.reserved_at IS NULL/);
});

test("favorite snapshots are maintained with favorite ownership", () => {
  assert.match(migration, /CREATE TABLE favorite_listing_snapshots/);
  assert.match(social, /INSERT INTO favorite_listing_snapshots/);
  assert.match(social, /DELETE FROM favorite_listing_snapshots/);
  assert.match(worker, /favorite_listing_snapshots s JOIN listings l/);
});

test("expiry reminders are preference-aware and idempotent", () => {
  assert.match(migration, /PRIMARY KEY \(listing_id, reminder_kind\)/);
  assert.match(worker, /listing_status_enabled/);
  assert.match(worker, /INSERT OR IGNORE INTO listing_expiry_reminder_deliveries/);
  assert.match(worker, /listing\.expiring_soon/);
});

test("promotion receipts are private R2 objects with content signatures", () => {
  assert.match(worker, /promotion-receipts\//);
  assert.match(worker, /private, no-store/);
  assert.match(worker, /matchesReceiptSignature/);
  assert.match(worker, /sha256Hex/);
  assert.match(promotions, /cloudflareAuthorizedFetch/);
  assert.match(promotions, /URL\.createObjectURL/);
});

test("promotion approval is stale safe and cannot feature a non-public listing", () => {
  assert.match(worker, /expectedUpdatedAt/);
  assert.match(worker, /status = 'pending_review' AND updated_at = \?/);
  assert.match(migration, /listing_promotion_validate_before_approval/);
  assert.match(migration, /RAISE\(ABORT, 'promotion_listing_not_public'\)/);
  assert.match(migration, /listing_promotion_apply_after_approval/);
});

test("entry owns listing operations before generic admin and the final 404", () => {
  const operations = entry.indexOf("handleListingOperations(request, env)");
  const admin = entry.indexOf("handleAdmin(request, env)");
  const finalNotFound = entry.lastIndexOf('code: "not_found"');
  assert.ok(operations >= 0 && admin > operations && finalNotFound > admin);
  assert.doesNotMatch(entry, /baseWorker\.fetch/);
  assert.match(entry, /promotion-receipts/);
});
