import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const paths = {
  migration: "supabase/migrations/202607150002_saved_search_alerts_push_v1.sql",
  multiDeviceMigration:
    "supabase/migrations/202607160005_preserve_multi_device_push_preference.sql",
  edgeFunction: "supabase/functions/send-push-notifications/index.ts",
  nativePush: "src/lib/native-push.ts",
  pushApi: "src/lib/api/push-notifications.ts",
  auth: "src/lib/auth.tsx",
  scanner: "src/features/saved-searches/SavedSearchAlertBackgroundScanner.tsx",
  preferences: "src/features/notifications/NotificationPreferencesPanel.tsx",
  targetPath: "src/lib/notification-target-path.ts",
  targetResolution: "src/lib/api/notification-target-resolution.ts",
  notificationsRoute: "src/routes/notifications.tsx",
  moreRoute: "src/routes/more.tsx",
  savedSearchRoute: "src/routes/saved-searches.tsx",
  capacitorConfig: "capacitor.config.ts",
  androidManifest: "android/app/src/main/AndroidManifest.xml",
  packageJson: "package.json",
};

const read = (path) => readFile(path, "utf8");

test("saved-search matching is server-side, public-only, deduplicated, and cadence aware", async () => {
  const migration = await read(paths.migration);

  assert.match(
    migration,
    /create or replace function public\.rawaj_listing_matches_saved_search_v2/i,
  );
  assert.match(migration, /p_listing\.status <> 'approved'/i);
  assert.match(migration, /p_listing\.archived_at is not null/i);
  assert.match(migration, /p_listing\.expires_at <= now\(\)/i);
  assert.match(migration, /rawaj_normalize_arabic_search/i);
  assert.match(migration, /rawaj_location_descendant_ids/i);
  assert.match(migration, /on conflict \(saved_search_id, listing_id\) do nothing/i);
  assert.match(migration, /create trigger rawaj_capture_saved_search_matches_v2/i);
  assert.match(migration, /rawaj_flush_my_saved_search_alerts_v2/i);
  assert.match(migration, /rawaj_flush_due_saved_search_alerts_v2/i);
  assert.match(migration, /alert_frequency = 'daily'/i);
  assert.match(migration, /interval '1 day'/i);
  assert.match(migration, /interval '7 days'/i);
  assert.match(migration, /'saved_search_match'/i);
  assert.match(migration, /'match_count'/i);
  assert.match(migration, /match\.notified_at is null/i);
});

test("push tokens and delivery queue remain private and service-role controlled", async () => {
  const migration = await read(paths.migration);

  assert.match(migration, /create table if not exists public\.push_devices/i);
  assert.match(migration, /create table if not exists public\.notification_push_deliveries/i);
  assert.match(migration, /alter table public\.push_devices enable row level security/i);
  assert.match(
    migration,
    /alter table public\.notification_push_deliveries enable row level security/i,
  );
  assert.match(migration, /revoke all on table public\.push_devices from anon, authenticated/i);
  assert.match(
    migration,
    /revoke all on table public\.notification_push_deliveries from anon, authenticated/i,
  );
  assert.doesNotMatch(migration, /grant\s+select[\s\S]*push_devices[\s\S]*authenticated/i);
  assert.match(migration, /push_enabled boolean not null default false/i);
  assert.match(migration, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/i);
  assert.match(migration, /for update of delivery skip locked/i);
  assert.match(migration, /attempt_count >= 5 then 'failed'/i);
  assert.match(
    migration,
    /grant execute on function public\.rawaj_claim_push_deliveries_v1\(integer\) to service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.rawaj_mark_push_delivery_v1\(uuid, boolean, text, boolean\) to service_role/i,
  );
});

test("native registration is explicit, permission-aware, logout-safe, offline-safe, and multi-device scoped", async () => {
  const [
    nativePush,
    pushApi,
    auth,
    preferences,
    scanner,
    moreRoute,
    multiDeviceMigration,
    packageText,
    capacitorConfig,
  ] = await Promise.all([
    read(paths.nativePush),
    read(paths.pushApi),
    read(paths.auth),
    read(paths.preferences),
    read(paths.scanner),
    read(paths.moreRoute),
    read(paths.multiDeviceMigration),
    read(paths.packageJson),
    read(paths.capacitorConfig),
  ]);

  assert.match(nativePush, /import\("@capacitor\/push-notifications"\)/);
  assert.match(nativePush, /checkPermissions\(\)/);
  assert.match(nativePush, /requestPermissions\(\)/);
  assert.match(nativePush, /PushNotifications\.register\(\)/);
  assert.match(nativePush, /PushNotifications\.createChannel/);
  assert.match(nativePush, /PushNotifications\.unregister\(\)/);
  assert.match(nativePush, /REGISTRATION_TIMEOUT_MS/);
  assert.doesNotMatch(nativePush, /localStorage\.setItem\([^\n]*deviceToken/i);
  assert.match(pushApi, /rawaj_upsert_push_device_v1/);
  assert.match(pushApi, /rawaj_disable_push_device_v1/);
  assert.match(preferences, /pushCapability\.available/);
  assert.match(preferences, /enableNativePush/);
  assert.match(preferences, /disableNativePush/);
  assert.match(scanner, /<PushNotificationBridge \/>/);
  assert.doesNotMatch(moreRoute, /disableNativePush/);

  assert.match(auth, /import \{ clearLocalNativePushState \} from "\.\/native-push"/);
  assert.match(auth, /const localNotificationCleanup = clearLocalNativePushState\(\)/);
  assert.match(auth, /const result = await authLogout\(\)/);
  assert.match(auth, /await localNotificationCleanup/);
  assert.doesNotMatch(auth, /disableNativePush|client\.auth\.signOut|createClient\(/);
  assert.match(auth, /import type \{ Session, User \} from "@supabase\/supabase-js"/);
  assert.match(nativePush, /export async function clearLocalNativePushState/);
  assert.match(nativePush, /window\.localStorage\.removeItem\(PUSH_DEVICE_KEY_STORAGE\)/);

  assert.match(nativePush, /await disableNativePush\(false\)/);
  assert.doesNotMatch(nativePush, /disablePushDevice\(userId,/);
  assert.match(nativePush, /const localCleanup = unregisterNativePushLocally\(\)/);
  const localCleanupIndex = nativePush.indexOf(
    "const localCleanup = unregisterNativePushLocally()",
  );
  const remoteDetachIndex = nativePush.indexOf(
    "await disablePushDevice(deviceKey, disableChannel)",
  );
  assert.ok(localCleanupIndex >= 0, "Native token cleanup must start for every disable attempt");
  assert.ok(
    remoteDetachIndex > localCleanupIndex,
    "Local native cleanup must start before waiting for the server detach",
  );
  assert.match(nativePush, /async function unregisterNativePushLocally\(\): Promise<boolean>/);
  assert.match(nativePush, /if \(result\.ok \|\| locallyUnregistered\)/);
  assert.match(nativePush, /await clearNativePushListeners\(\)/);
  assert.doesNotMatch(nativePush, /if \(result\.ok\) \{[\s\S]*PushNotifications\.unregister\(\)/);

  assert.match(preferences, /if \(pushStatus\.registered\)/);
  assert.match(preferences, /disableNativePush\(false\)/);
  assert.doesNotMatch(preferences, /currentPreferences\.pushEnabled \|\| pushStatus\.registered/);
  assert.match(
    preferences,
    /const accountPushEnabled = currentPreferences\.pushEnabled \|\| enabled/,
  );
  assert.match(multiDeviceMigration, /if v_permission = 'granted' then/i);
  assert.match(multiDeviceMigration, /values \(v_user_id, true\)/i);
  assert.doesNotMatch(multiDeviceMigration, /values \(v_user_id, v_permission = 'granted'\)/i);

  const packageJson = JSON.parse(packageText);
  assert.match(packageJson.dependencies["@capacitor/push-notifications"], /^\^?8\./);
  assert.match(capacitorConfig, /PushNotifications/);
  assert.match(capacitorConfig, /presentationOptions/);
});

test("push delivery uses authenticated FCM HTTP v1 and avoids leaking message bodies", async () => {
  const [edgeFunction, androidManifest] = await Promise.all([
    read(paths.edgeFunction),
    read(paths.androidManifest),
  ]);

  assert.match(edgeFunction, /x-cron-secret/i);
  assert.match(edgeFunction, /timingSafeEqual/);
  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edgeFunction, /FIREBASE_PRIVATE_KEY/);
  assert.match(edgeFunction, /firebase\.messaging/);
  assert.match(edgeFunction, /oauth2\.googleapis\.com\/token/);
  assert.match(edgeFunction, /fcm\.googleapis\.com\/v1\/projects/);
  assert.match(edgeFunction, /rawaj_claim_push_deliveries_v1/);
  assert.match(edgeFunction, /rawaj_mark_push_delivery_v1/);
  assert.match(edgeFunction, /safePushBody/);
  assert.match(edgeFunction, /UNREGISTERED/);
  assert.doesNotMatch(edgeFunction, /console\.log\([^\n]*device_token/i);
  assert.match(androidManifest, /com\.google\.firebase\.messaging\.default_notification_icon/);
  assert.match(
    androidManifest,
    /com\.google\.firebase\.messaging\.default_notification_channel_id/,
  );
});

test("native and in-app notifications share canonical target normalization and paths", async () => {
  const [targetPath, targetResolution, notificationsRoute, nativePush, savedSearchRoute] =
    await Promise.all([
      read(paths.targetPath),
      read(paths.targetResolution),
      read(paths.notificationsRoute),
      read(paths.nativePush),
      read(paths.savedSearchRoute),
    ]);

  assert.match(targetPath, /normalizeNotificationTargetType/);
  assert.match(targetPath, /kind: "seller"/);
  assert.match(targetPath, /return `\/seller\/\$\{encodedId\}`/);
  assert.match(targetPath, /return `\/listings\/\$\{encodedId\}`/);
  assert.match(targetPath, /return `\/chats\?conversation=\$\{encodedId\}`/);
  assert.match(targetPath, /return "\/saved-searches"/);
  assert.match(targetPath, /fallback = "\/notifications"/);

  assert.match(targetResolution, /parseNotificationTargetReference/);
  assert.doesNotMatch(targetResolution, /targetType === "conversation"/);
  assert.match(notificationsRoute, /target\.kind === "listing"/);
  assert.match(notificationsRoute, /target\.kind === "conversation"/);
  assert.match(notificationsRoute, /target\.kind === "seller"/);
  assert.match(notificationsRoute, /target\.kind === "saved_search"/);

  assert.match(nativePush, /import \{ notificationOpenPath \}/);
  assert.match(nativePush, /notificationOpenPath\(data\?\.notification_id\)/);
  assert.doesNotMatch(nativePush, /data\?\.target_type|data\?\.target_id/);
  assert.doesNotMatch(nativePush, /function resolvePushTarget/);
  assert.match(savedSearchRoute, /الخادم|server/i);
  assert.doesNotMatch(savedSearchRoute, /bounded checks while you use the app/i);
});
