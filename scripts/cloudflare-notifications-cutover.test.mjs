import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const preferences = await readFile("src/lib/api/notification-preferences.ts", "utf8");
const push = await readFile("src/lib/api/push-notifications.ts", "utf8");
const target = await readFile("src/lib/api/notification-target-resolution.ts", "utf8");
const worker = await readFile("cloudflare/worker/src/notifications.ts", "utf8");
const entry = await readFile("cloudflare/worker/src/entry.ts", "utf8");
const migration = await readFile(
  "cloudflare/d1/migrations/0011_notification_preferences_and_push_devices.sql",
  "utf8",
);

test("notification preference and push clients are Cloudflare-only", () => {
  for (const source of [preferences, push, target]) {
    assert.doesNotMatch(source, /@supabase\/supabase-js|\bgetClient\b|\.rpc\(|\.from\(|\.storage\b/);
  }
  assert.match(preferences, /\/v1\/account\/notification-preferences/);
  assert.match(push, /\/v1\/account\/push-devices/);
});

test("notification preferences are server-whitelisted", () => {
  assert.match(worker, /const PREFERENCE_COLUMNS =/);
  assert.match(worker, /typeof body\.data\.enabled !== "boolean"/);
  assert.match(worker, /ON CONFLICT\(user_id\) DO UPDATE SET \$\{column\}/);
  assert.match(migration, /price_changes_enabled/);
  assert.match(migration, /saved_search_matches_enabled/);
  assert.match(migration, /promotions_enabled/);
});

test("push device tokens are encrypted and never stored as plaintext", () => {
  assert.match(worker, /PUSH_TOKEN_ENCRYPTION_KEY/);
  assert.match(worker, /AES-GCM/);
  assert.match(worker, /sha256Hex\(deviceToken\)/);
  assert.match(worker, /encrypted_token/);
  assert.doesNotMatch(worker, /encrypted_token\s*=\s*deviceToken/);
  assert.match(migration, /device_key_hash/);
  assert.match(migration, /permission_status/);
});

test("push registration and disable operations are identity-scoped", () => {
  assert.match(worker, /requireMutationAuth/);
  assert.match(worker, /WHERE user_id = \? AND device_key_hash = \?/);
  assert.match(worker, /SET active = 0, permission_status = 'denied'/);
  assert.match(worker, /push_enabled = 0/);
});

test("entry owns notification preferences and push routes before the final 404", () => {
  assert.match(entry, /notification-preferences\|push-devices/);
  assert.ok(entry.indexOf("handleNotifications") < entry.lastIndexOf('code: "not_found"'));
  assert.doesNotMatch(entry, /baseWorker\.fetch/);
});
