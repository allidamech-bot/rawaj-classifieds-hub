import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entry = await readFile("cloudflare/worker/src/entry.ts", "utf8");
const sessionHandler = await readFile("cloudflare/worker/src/push-device-session.ts", "utf8");
const nativePush = await readFile("src/lib/native-push.ts", "utf8");
const pushApi = await readFile("src/lib/api/push-notifications.ts", "utf8");
const auth = await readFile("src/lib/auth.tsx", "utf8");
const preferences = await readFile(
  "src/features/notifications/NotificationPreferencesPanel.tsx",
  "utf8",
);

test("worker entry gives authenticated device detachment its own route", () => {
  assert.match(entry, /handlePushDeviceSession/);
  assert.match(entry, /request\.method === "DELETE"/);
  assert.ok(entry.indexOf("handlePushDeviceSession") < entry.lastIndexOf("handleNotifications"));
});

test("device detachment is identity scoped and preserves permission unless explicit", () => {
  assert.match(sessionHandler, /requireMutationAuth/);
  assert.match(sessionHandler, /WHERE user_id = \? AND device_key_hash = \?/);
  assert.match(sessionHandler, /permission_status = COALESCE\(\?, permission_status\)/);
  assert.match(sessionHandler, /if \(disableChannel\)/);
  assert.doesNotMatch(sessionHandler, /deviceToken|encrypted_token|token_hash/);
  assert.match(pushApi, /permissionStatus\?: PushPermissionStatus/);
  assert.match(pushApi, /if \(permissionStatus\) query\.set/);
});

test("native lifecycle refreshes tokens without persisting plaintext FCM values", () => {
  assert.match(nativePush, /addListener\("registration"/);
  assert.match(nativePush, /syncRegistrationToken/);
  assert.match(nativePush, /sha256Hex\(token\)/);
  assert.match(nativePush, /lastTokenHashByUser/);
  assert.match(nativePush, /firebaseAuth\.currentUser\?\.uid !== context\.userId/);
  assert.doesNotMatch(nativePush, /localStorage\.setItem\([^\n]*token/i);
  assert.doesNotMatch(nativePush, /console\.(?:log|info|debug)\([^\n]*token/i);
});

test("logout detaches the authenticated device before Firebase sign-out", () => {
  assert.match(auth, /detachNativePushBeforeSignOut/);
  assert.ok(auth.indexOf("await detachNativePushBeforeSignOut") < auth.indexOf("await firebaseSignOut"));
  assert.match(nativePush, /disablePushDevice\(deviceKey, false\)/);
  assert.ok(
    nativePush.indexOf("disablePushDevice(deviceKey, false)") <
      nativePush.indexOf("await unregisterNativePushLocally()", nativePush.indexOf("detachNativePushBeforeSignOut")),
  );
});

test("Android and account controls are explicit and isolated", () => {
  assert.match(nativePush, /PushNotifications\.checkPermissions\(\)/);
  assert.match(nativePush, /PushNotifications\.createChannel/);
  assert.match(preferences, /قناة الإشعارات للحساب/);
  assert.match(preferences, /هذا الجهاز/);
  assert.match(preferences, /disableNativePush\(false\)/);
  assert.match(preferences, /disableNativePush\(true\)/);
  assert.match(preferences, /فصل هذا الجهاز فقط/);
});
