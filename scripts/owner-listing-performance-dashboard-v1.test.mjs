import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [types, listingsApi, worker, route, fixture, journey, packageJson] = await Promise.all([
  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/worker/src/marketplace-private.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../e2e/rawaj-e2e-owner-listing-lifecycle-fixture.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../e2e/authenticated-owner-listing-lifecycle-journey.spec.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("owner listing contracts expose real performance metrics", () => {
  for (const field of [
    "recordedViewCount",
    "favoriteCount",
    "conversationCount",
    "unreadMessageCount",
    "lastInquiryAt",
  ]) {
    assert.match(types, new RegExp(field));
    assert.match(listingsApi, new RegExp(field));
    assert.match(worker, new RegExp(field));
  }
});

test("owner query aggregates existing social and messaging data without schema changes", () => {
  assert.match(worker, /SUM\(view_count\) AS recorded_view_count/);
  assert.match(worker, /recent_listing_views WHERE user_id <> \?/);
  assert.match(worker, /COUNT\(\*\) AS favorite_count/);
  assert.match(worker, /conversations WHERE seller_id = \?/);
  assert.match(worker, /cm\.read_at IS NULL AND cm\.deleted_at IS NULL/);
  assert.match(worker, /MAX\(COALESCE\(last_message_at, updated_at\)\)/);
  assert.doesNotMatch(worker, /CREATE TABLE owner_listing_performance/);
});

test("performance metrics remain behind the authenticated owner boundary", () => {
  const ownerStart = worker.indexOf("async function ownerListings");
  const ownerEnd = worker.indexOf("async function createListing", ownerStart);
  const publicStart = worker.indexOf("async function publicListings");
  assert.ok(publicStart >= 0 && ownerStart > publicStart && ownerEnd > ownerStart);

  const publicListingsSection = worker.slice(publicStart, ownerStart);
  const ownerListingsSection = worker.slice(ownerStart, ownerEnd);

  assert.match(ownerListingsSection, /const auth = await authenticate/);
  assert.match(ownerListingsSection, /if \(!auth\) return unauthorized\(cors\)/);
  assert.match(ownerListingsSection, /WHERE l\.owner_id = \?/);
  assert.match(ownerListingsSection, /recent_listing_views WHERE user_id <> \?/);
  assert.match(ownerListingsSection, /favorites WHERE user_id <> \?/);
  assert.match(ownerListingsSection, /cm\.sender_id <> \?/);
  assert.doesNotMatch(publicListingsSection, /owner_recorded_view_count/);
  assert.doesNotMatch(publicListingsSection, /owner_unread_message_count/);
});

test("owner UI renders summary, per-listing metrics, unread action, and expiry guidance", () => {
  assert.match(route, /data-owner-performance-overview="true"/);
  assert.match(route, /data-owner-listing-performance="true"/);
  assert.match(route, /data-owner-metric=\{metric\.key\}/);
  for (const metric of ["views", "favorites", "conversations", "unread"]) {
    assert.match(route, new RegExp(`key: "${metric}"`));
  }
  assert.match(route, /to="\/chats"/);
  assert.match(route, /ownerListingExpiryInsight/);
  assert.match(route, /daysRemaining <= 3/);
  assert.match(route, /daysRemaining <= 7/);
  assert.match(route, /المشاهدات المسجلة لا تشمل الزوار غير المسجلين/);
});

test("browser fixture verifies exact owner performance values", () => {
  assert.match(fixture, /recordedViewCount: 24/);
  assert.match(fixture, /favoriteCount: 5/);
  assert.match(fixture, /conversationCount: 3/);
  assert.match(fixture, /unreadMessageCount: 2/);
  assert.match(journey, /data-owner-summary-metric/);
  assert.match(journey, /data-owner-listing-performance/);
});

test("owner performance contract runs in precheck", () => {
  const parsed = JSON.parse(packageJson);
  assert.equal(
    parsed.scripts["test:owner-listing-performance"],
    "node --test scripts/owner-listing-performance-dashboard-v1.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:owner-listing-performance/);
});
