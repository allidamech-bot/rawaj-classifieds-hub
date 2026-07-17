import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [notificationsRoute, preferencesPanel, packageSource] = await Promise.all([
  readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/notifications/NotificationPreferencesPanel.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("notification reads compare async results with the live account", () => {
  assert.match(notificationsRoute, /const profileIdRef = useRef<string \| null>/);
  assert.match(notificationsRoute, /profileIdRef\.current = profileId/);
  assert.match(notificationsRoute, /currentProfileId !== profileIdRef\.current/);
  assert.match(notificationsRoute, /parentRequestId !== notificationsRequestIdRef\.current/);
  assert.match(notificationsRoute, /paginationRequestId !== paginationRequestIdRef\.current/);
});

test("notification writes use synchronous account-scoped locks", () => {
  assert.match(notificationsRoute, /markingReadScopesRef = useRef<Set<string>>/);
  assert.match(notificationsRoute, /openingTargetScopesRef = useRef<Set<string>>/);
  assert.match(notificationsRoute, /markingAllProfilesRef = useRef<Set<string>>/);
  assert.match(notificationsRoute, /notificationActionScope\(currentProfileId, notificationId\)/);
  assert.match(notificationsRoute, /markingReadScopesRef\.current\.has\(scopeKey\)/);
  assert.match(notificationsRoute, /openingTargetScopesRef\.current\.has\(scopeKey\)/);
  assert.match(notificationsRoute, /markingAllProfilesRef\.current\.has\(currentProfileId\)/);
});

test("notification action results and finalizers cannot mutate a replacement account", () => {
  assert.match(
    notificationsRoute,
    /if \(currentProfileId !== profileIdRef\.current\) return false/,
  );
  assert.match(notificationsRoute, /if \(currentProfileId !== profileIdRef\.current\) return;/);
  assert.match(
    notificationsRoute,
    /if \(currentProfileId === profileIdRef\.current\) \{[\s\S]*setMarkingReadIds/,
  );
  assert.match(
    notificationsRoute,
    /if \(currentProfileId === profileIdRef\.current\) \{[\s\S]*setOpeningTargetIds/,
  );
  assert.match(
    notificationsRoute,
    /if \(currentProfileId === profileIdRef\.current\) setMarkingAll\(false\)/,
  );
});

test("notification targets are rechecked before messages or navigation", () => {
  const resolveIndex = notificationsRoute.indexOf("resolveNotificationTarget(notification");
  const guardIndex = notificationsRoute.indexOf(
    "if (currentProfileId !== profileIdRef.current) return;",
    resolveIndex,
  );
  const navigationIndex = notificationsRoute.indexOf(
    'navigate({ to: "/listings/$id"',
    resolveIndex,
  );
  assert.ok(resolveIndex >= 0);
  assert.ok(guardIndex > resolveIndex);
  assert.ok(navigationIndex > guardIndex);
  assert.match(notificationsRoute, /if \(!notification\.readAt\) \{[\s\S]*await markOne/);
  assert.match(notificationsRoute, /if \(currentProfileId !== profileIdRef\.current\) return;/);
});

test("notification preferences reject stale loads and writes", () => {
  assert.match(preferencesPanel, /const profileIdRef = useRef<string \| null>/);
  assert.match(preferencesPanel, /profileIdRef\.current = profileId/);
  assert.match(preferencesPanel, /savingPreferenceProfilesRef = useRef<Set<string>>/);
  assert.match(preferencesPanel, /pushBusyProfilesRef = useRef<Set<string>>/);
  assert.match(preferencesPanel, /profileId !== profileIdRef\.current/);
  assert.match(preferencesPanel, /currentProfileId !== profileIdRef\.current/);
});

test("preference snapshots reset immediately when the account changes", () => {
  assert.match(preferencesPanel, /const loadedProfileIdRef = useRef<string \| null>\(null\)/);
  assert.match(preferencesPanel, /loadedProfileIdRef\.current = null/);
  assert.match(preferencesPanel, /if \(loadedProfileIdRef\.current !== profileId\)/);
  assert.match(preferencesPanel, /loadedProfileIdRef\.current = profileId/);
  const transitionStart = preferencesPanel.indexOf("if (loadedProfileIdRef.current !== profileId)");
  const requestStart = preferencesPanel.indexOf(
    "const requestId = ++requestIdRef.current",
    transitionStart,
  );
  const resetIndex = preferencesPanel.indexOf("setPreferences(null)", transitionStart);
  assert.ok(transitionStart >= 0);
  assert.ok(resetIndex > transitionStart);
  assert.ok(requestStart > resetIndex);
});

test("preference and push finalizers affect only the initiating account", () => {
  assert.match(
    preferencesPanel,
    /savingPreferenceProfilesRef\.current\.delete\(currentProfileId\)/,
  );
  assert.match(preferencesPanel, /pushBusyProfilesRef\.current\.delete\(currentProfileId\)/);
  assert.match(
    preferencesPanel,
    /if \(currentProfileId === profileIdRef\.current\) setSavingKey\(null\)/,
  );
  assert.match(
    preferencesPanel,
    /if \(currentProfileId === profileIdRef\.current\) setPushBusy\(false\)/,
  );
});

test("notification account isolation remains in the permanent activity contract", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts["test:activity-center"],
    /notification-account-action-isolation\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:activity-center/);
});
