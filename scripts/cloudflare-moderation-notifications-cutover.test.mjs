import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migration = await readFile(
  "cloudflare/d1/migrations/0018_listing_moderation_notifications.sql",
  "utf8",
);

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE listings (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL
    );

    CREATE TABLE listing_moderation_actions (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      read_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return database;
}

function notificationData(database, type) {
  const row = database
    .prepare("SELECT id, user_id, type, title, body, data FROM notifications WHERE type = ?")
    .get(type);
  assert.ok(row, `Expected ${type} notification`);
  return { ...row, data: JSON.parse(String(row.data)) };
}

test("listing approval creates an actionable owner notification", () => {
  const database = createDatabase();
  database.exec(migration);
  database
    .prepare("INSERT INTO listings (id, owner_id, title) VALUES (?, ?, ?)")
    .run("11111111-1111-4111-8111-111111111111", "owner-1", "هاتف للبيع");
  database
    .prepare(
      `INSERT INTO listing_moderation_actions
        (id, listing_id, actor_id, action, reason, metadata, created_at)
       VALUES (?, ?, ?, 'approve', NULL, '{}', ?)`,
    )
    .run(
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
      "moderator-1",
      "2026-07-30T00:00:00.000Z",
    );

  const notification = notificationData(database, "listing.approved");
  assert.equal(notification.user_id, "owner-1");
  assert.equal(notification.data.targetType, "owner_listing");
  assert.equal(notification.data.targetId, "11111111-1111-4111-8111-111111111111");
  assert.match(String(notification.title), /الموافقة/);
  assert.match(String(notification.body), /هاتف للبيع/);
  assert.match(
    String(notification.id),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("listing rejection includes the moderation reason and edit destination", () => {
  const database = createDatabase();
  database.exec(migration);
  database
    .prepare("INSERT INTO listings (id, owner_id, title) VALUES (?, ?, ?)")
    .run("33333333-3333-4333-8333-333333333333", "owner-2", "سيارة مستعملة");
  database
    .prepare(
      `INSERT INTO listing_moderation_actions
        (id, listing_id, actor_id, action, reason, metadata, created_at)
       VALUES (?, ?, ?, 'reject', ?, '{}', ?)`,
    )
    .run(
      "44444444-4444-4444-8444-444444444444",
      "33333333-3333-4333-8333-333333333333",
      "moderator-1",
      "الصورة الرئيسية غير واضحة",
      "2026-07-30T00:01:00.000Z",
    );

  const notification = notificationData(database, "listing.rejected");
  assert.equal(notification.data.targetType, "owner_listing");
  assert.equal(notification.data.targetId, "33333333-3333-4333-8333-333333333333");
  assert.equal(notification.data.reason, "الصورة الرئيسية غير واضحة");
  assert.match(String(notification.body), /الصورة الرئيسية غير واضحة/);
});

test("legacy listing and conversation notifications receive canonical targets", () => {
  const database = createDatabase();
  database
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
       VALUES (?, 'owner-1', 'listing.expiring_soon', 'تنبيه', 'سينتهي الإعلان', ?, ?)`,
    )
    .run(
      "55555555-5555-4555-8555-555555555555",
      JSON.stringify({ listingId: "11111111-1111-4111-8111-111111111111" }),
      "2026-07-30T00:02:00.000Z",
    );
  database.exec(migration);

  const legacyListing = database
    .prepare("SELECT data FROM notifications WHERE id = ?")
    .get("55555555-5555-4555-8555-555555555555");
  const legacyListingData = JSON.parse(String(legacyListing.data));
  assert.equal(legacyListingData.targetType, "owner_listing");
  assert.equal(legacyListingData.targetId, "11111111-1111-4111-8111-111111111111");

  database
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
       VALUES (?, 'owner-1', 'message.received', 'رسالة', 'لديك رسالة جديدة', ?, ?)`,
    )
    .run(
      "66666666-6666-4666-8666-666666666666",
      JSON.stringify({ conversationId: "77777777-7777-4777-8777-777777777777" }),
      "2026-07-30T00:03:00.000Z",
    );

  const conversation = database
    .prepare("SELECT data FROM notifications WHERE id = ?")
    .get("66666666-6666-4666-8666-666666666666");
  const conversationData = JSON.parse(String(conversation.data));
  assert.equal(conversationData.targetType, "conversation");
  assert.equal(conversationData.targetId, "77777777-7777-4777-8777-777777777777");
});
