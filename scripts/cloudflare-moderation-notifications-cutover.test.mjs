import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, notificationsWorker, notificationsRoute, targetResolution] = await Promise.all([
  read("cloudflare/d1/migrations/0018_listing_moderation_notification_delivery.sql"),
  read("cloudflare/worker/src/notifications.ts"),
  read("src/routes/notifications.tsx"),
  read("src/lib/api/notification-target-resolution.ts"),
]);

test("listing moderation actions emit durable owner notifications", () => {
  assert.match(migration, /AFTER INSERT ON listing_moderation_actions/);
  assert.match(migration, /NEW\.action IN \('approve', 'reject', 'request_changes'\)/);
  assert.match(
    migration,
    /INSERT INTO notifications \(id, user_id, type, title, body, data, created_at\)/,
  );
  assert.match(migration, /listing\.approved/);
  assert.match(migration, /listing\.rejected/);
  assert.match(migration, /listing\.changes_requested/);
  assert.match(migration, /listing\.owner_id/);
  assert.match(migration, /NEW\.reason/);
  assert.match(migration, /NEW\.created_at/);
});

test("moderation notifications always contain an actionable owner-listing target", () => {
  assert.match(migration, /'targetType', 'owner_listing'/);
  assert.match(migration, /'targetId', listing\.id/);
  assert.match(migration, /'listingId', listing\.id/);
  assert.match(migration, /'titleEn'/);
  assert.match(migration, /'bodyEn'/);
  assert.match(migration, /NOT EXISTS \(/);
});

test("existing and future legacy listing payloads are normalized", () => {
  assert.match(migration, /UPDATE notifications/);
  assert.match(migration, /notifications_normalize_listing_target_after_insert/);
  assert.match(migration, /json_extract\(data, '\$\.listingId'\)/);
  assert.match(migration, /json_extract\(data, '\$\.listing_id'\)/);
  assert.match(migration, /json_set\(/);
  assert.match(migration, /'\$\.targetType'/);
  assert.match(migration, /'\$\.targetId'/);
});

test("notification API exposes canonical target metadata to the client", () => {
  assert.match(notificationsWorker, /data\.targetType \?\? data\.target_type/);
  assert.match(notificationsWorker, /data\.targetId \?\? data\.target_id/);
  assert.match(notificationsWorker, /targetType: targetId \? targetType : null/);
});

test("owner listing notifications resolve and navigate to the editable listing", () => {
  assert.match(targetResolution, /isOwnerListingNotification\(notification\.type\)/);
  assert.match(targetResolution, /kind: "owner_listing"/);
  assert.match(notificationsRoute, /target\.kind === "owner_listing"/);
  assert.match(notificationsRoute, /to: "\/profile\/listings\/\$id"/);
  assert.match(notificationsRoute, /await markOne\(notification\.id\)/);
});
