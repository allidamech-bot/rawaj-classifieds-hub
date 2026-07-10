import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activityPath = new URL("../src/routes/activity.tsx", import.meta.url);
const morePath = new URL("../src/routes/more.tsx", import.meta.url);
const [activityRoute, moreRoute] = await Promise.all([
  readFile(activityPath, "utf8"),
  readFile(morePath, "utf8"),
]);

test("activity center combines real notification and conversation reads", () => {
  assert.match(activityRoute, /fetchMyNotificationsPage/);
  assert.match(activityRoute, /fetchMyConversations/);
  assert.match(activityRoute, /Promise\.all/);
  assert.match(activityRoute, /useUnreadActivityCounts/);
});

test("activity center keeps tab state in the URL and conversation deep links", () => {
  assert.match(activityRoute, /z\.enum\(\["notifications", "messages"\]\)/);
  assert.match(activityRoute, /search: \{ tab \}/);
  assert.match(activityRoute, /search=\{\{ conversation: conversation\.id \}\}/);
});

test("account hub exposes one activity shortcut with combined unread count", () => {
  assert.match(moreRoute, /to: "\/activity"/);
  assert.match(moreRoute, /counts\.messages \+ counts\.notifications/);
  assert.match(moreRoute, /titleEn: "Activity"/);
});

test("legacy full message and notification routes remain reachable", () => {
  assert.match(activityRoute, /to: "\/notifications" \| "\/chats"/);
  assert.match(activityRoute, /to="\/chats"/);
  assert.match(activityRoute, /to="\/notifications"/);
});
