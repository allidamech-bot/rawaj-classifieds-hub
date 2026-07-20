import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const notifications = await readFile(
  new URL("../src/routes/notifications.tsx", import.meta.url),
  "utf8",
);

test("notification loading and pagination recover from thrown failures", () => {
  assert.match(notifications, /operation: "notifications_load"/);
  assert.match(notifications, /operation: "notifications_load_more"/);
  assert.match(
    notifications,
    /const loadNotifications = useCallback[\s\S]*?catch \(caught\)[\s\S]*?finally/,
  );
  assert.match(
    notifications,
    /async function loadMoreNotifications[\s\S]*?catch \(caught\)[\s\S]*?finally/,
  );
  assert.match(notifications, /loadMoreInFlightRef\.current = false/);
});

test("read mutations and target opening are scoped and failure-safe", () => {
  assert.match(notifications, /async function markOne[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(notifications, /async function markAll[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(
    notifications,
    /async function openNotificationTarget[\s\S]*?openingTargetScopesRef\.current\.has\(scopeKey\)[\s\S]*?catch \(caught\)[\s\S]*?finally/,
  );
  assert.match(notifications, /markingReadScopesRef\.current\.delete\(scopeKey\)/);
  assert.match(notifications, /markingAllProfilesRef\.current\.delete\(currentProfileId\)/);
  assert.match(notifications, /openingTargetScopesRef\.current\.delete\(scopeKey\)/);
});

test("notification navigation waits for mutations and target resolution", () => {
  assert.match(notifications, /await openNotificationTargetRef\.current/);
  assert.match(notifications, /await markOne\(notification\.id\)/);
  assert.ok((notifications.match(/await navigate\(/g) ?? []).length >= 8);
});
