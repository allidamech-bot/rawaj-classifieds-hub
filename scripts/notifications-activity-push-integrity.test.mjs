import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("notification merge is deterministic, bounded-safe and duplicate-free", async () => {
  const source = stripTypeScriptTypes(await read("src/lib/notification-integrity.ts"), {
    mode: "strip",
  });
  const integrity = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  const older = { id: "00000000-0000-4000-8000-000000000001", createdAt: "2026-01-01T00:00:00Z" };
  const newer = { id: "00000000-0000-4000-8000-000000000002", createdAt: "2026-01-02T00:00:00Z" };
  assert.deepEqual(integrity.mergeNotifications([older], [older, newer]), [newer, older]);
  assert.equal(integrity.notificationIsWithinReadCutoff(older, older.createdAt), true);
  assert.equal(integrity.notificationIsWithinReadCutoff(newer, older.createdAt), false);
  assert.equal(integrity.normalizeNotificationTargetType("chat"), "conversation");
  assert.equal(integrity.normalizeNotificationText("\u0000 safe ", 20), "safe");
});

test("notification APIs derive actor identity and expose a minimum DTO", async () => {
  const [api, shared, types] = await Promise.all([
    read("src/lib/api/notifications.ts"),
    read("src/lib/api/shared.ts"),
    read("src/lib/classifieds-types.ts"),
  ]);
  assert.match(api, /getAuthenticatedUserId/);
  assert.doesNotMatch(api, /fetchMyNotificationsPage\s*\(\s*(?:user|profile)Id/);
  assert.match(
    api,
    /NOTIFICATION_SELECT\s*=\s*[\s\S]*id,type,title_ar,body_ar,target_type,target_id,metadata,read_at,created_at/,
  );
  assert.match(api, /\.eq\("recipient_id", actorResult\.data\)/);
  assert.match(
    api,
    /\.order\("created_at", \{ ascending: false \}\)[\s\S]*\.order\("id", \{ ascending: false \}\)/,
  );
  assert.match(api, /MAX_NOTIFICATIONS_PAGE_SIZE = 50/);
  assert.match(shared, /client\.auth\.getUser\(\)/);
  const dto = types.slice(
    types.indexOf("export interface NotificationItem"),
    types.indexOf("export interface NotificationCursor"),
  );
  assert.doesNotMatch(dto, /recipientId|actorId|metadata|deviceToken/);
});

test("account switching, realtime, unread and cutoff semantics converge", async () => {
  const [route, activity, unread, trigger] = await Promise.all([
    read("src/routes/notifications.tsx"),
    read("src/routes/activity.tsx"),
    read("src/lib/unread-activity.tsx"),
    read("src/components/NotificationTrigger.tsx"),
  ]);
  assert.match(route, /filter: `recipient_id=eq\.\$\{currentProfileId\}`/);
  assert.match(route, /removeChannel\(channel\)/);
  assert.match(route, /generation !== realtimeGenerationRef\.current/);
  assert.match(route, /mergeNotifications\(current, \[notification\]\)/);
  assert.match(route, /setNotifications\(\[\]\)/);
  assert.match(route, /rawaj_mark_all_notifications_read_v1|markAllNotificationsRead/);
  assert.match(route, /notificationIsWithinReadCutoff/);
  assert.match(activity, /mergeNotifications/);
  assert.match(activity, /loadedProfileId !== profileId/);
  assert.match(unread, /fetchUnreadNotificationsCount\(\)/);
  assert.match(unread, /countsProfileId === profileId/);
  assert.match(trigger, /useUnreadActivityCounts/);
  assert.match(trigger, /99\+/);
});

test("deep links re-fetch the notification and reauthorize every supported target", async () => {
  const [resolver, paths, nativePush] = await Promise.all([
    read("src/lib/api/notification-target-resolution.ts"),
    read("src/lib/notification-target-path.ts"),
    read("src/lib/native-push.ts"),
  ]);
  assert.match(resolver, /fetchMyNotificationById\(notificationId\)/);
  assert.match(resolver, /fetchListingDetail/);
  assert.match(resolver, /fetchMyConversations/);
  assert.match(resolver, /currentAccountOwns\("listings"/);
  assert.match(resolver, /fetchMySupportRequest\(reference\.id\)/);
  assert.match(resolver, /return \{ ok: true, data: null \}/);
  assert.match(paths, /normalizeNotificationId\(targetId\)/);
  assert.match(nativePush, /notificationOpenPath\(data\?\.notification_id\)/);
  assert.doesNotMatch(nativePush, /resolveNotificationTargetPath\(/);
});

test("database contract enforces notification idempotency and read ownership", async () => {
  const [migration, base] = await Promise.all([
    read("supabase/migrations/202607170001_notifications_activity_push_integrity.sql"),
    read("supabase/migrations/202607010001_notifications_profile_roles_contract.sql"),
  ]);
  assert.match(migration, /add column if not exists dedupe_key/);
  assert.match(migration, /unique index[\s\S]*recipient_id, dedupe_key/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /rawaj_mark_all_notifications_read_v1/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /created_at <= v_cutoff/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
  assert.match(base, /alter table public\.notifications enable row level security/);
  assert.match(base, /Notification recipients can only update read_at/);
});

test("push registration and delivery are account-bound, atomic and privacy-safe", async () => {
  const [api, nativePush, queue, lifecycle, worker] = await Promise.all([
    read("src/lib/api/push-notifications.ts"),
    read("src/lib/native-push.ts"),
    read("supabase/migrations/202607150002_saved_search_alerts_push_v1.sql"),
    read("supabase/migrations/202607160004_harden_push_delivery_device_lifecycle.sql"),
    read("supabase/functions/send-push-notifications/index.ts"),
  ]);
  assert.match(api, /getAuthenticatedUserId/);
  assert.doesNotMatch(api, /registerPushDevice\s*\(\s*(?:user|profile)Id/);
  assert.match(nativePush, /accountSnapshot/);
  assert.match(nativePush, /resetNativePushSession/);
  assert.match(queue, /unique \(notification_id, device_id\)/);
  assert.match(queue, /auth\.role\(\)[\s\S]*service_role/);
  assert.match(lifecycle, /attempt_count >= 5/);
  assert.match(lifecycle, /update public\.push_devices[\s\S]*active = false/);
  assert.match(worker, /notification_id: delivery\.notification_id/);
  assert.match(worker, /notification_type: delivery\.notification_type/);
  assert.doesNotMatch(
    worker,
    /metadata: JSON\.stringify|target_type: delivery|target_id: delivery/,
  );
  assert.match(worker, /sanitizeProviderError/);
  assert.doesNotMatch(worker, /console\.(?:log|error)\([^\n]*device_token/);
});

test("permanent workflow is read-only and integrated into the quality gate", async () => {
  const [workflow, quality, pkg] = await Promise.all([
    read(".github/workflows/notifications-activity-push-integrity.yml"),
    read(".github/workflows/quality-gate.yml"),
    read("package.json"),
  ]);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /contents: write|supabase db push|supabase migration up/);
  assert.match(workflow, /npm run test:notifications-activity-push/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(quality, /Notifications, Activity & Push Integrity contract/);
  assert.match(pkg, /"test:notifications-activity-push"/);
  assert.match(pkg, /"precheck": "[^"]*test:notifications-activity-push/);
});

test("Phase 12 introduces no production execution, geolocation or radius feature", async () => {
  const changedSources = await Promise.all([
    read("src/lib/notification-integrity.ts"),
    read("src/routes/notifications.tsx"),
    read("src/routes/activity.tsx"),
    read(".github/workflows/notifications-activity-push-integrity.yml"),
  ]);
  const combined = changedSources.join("\n").toLowerCase();
  assert.doesNotMatch(
    combined,
    /navigator\.geolocation|watchposition|getcurrentposition|radius[_-]/,
  );
  assert.doesNotMatch(combined, /supabase\s+(?:db push|migration up)|production write/);
});
