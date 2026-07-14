import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activityPath = new URL("../src/routes/activity.tsx", import.meta.url);
const morePath = new URL("../src/routes/more.tsx", import.meta.url);
const [
  activityRoute,
  moreRoute,
  api,
  helper,
  favorites,
  savedSearches,
  promotions,
  reports,
  support,
  moderation,
] = await Promise.all([
  readFile(activityPath, "utf8"),
  readFile(morePath, "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/request-dedup.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/favorites-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/saved-searches-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/promotions-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/reports-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/support-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/admin-listing-moderation-guarded.ts", import.meta.url), "utf8"),
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

test("activity feeds recover independently without erasing successful snapshots", () => {
  assert.match(activityRoute, /const \[hasLoadedNotifications, setHasLoadedNotifications\]/);
  assert.match(activityRoute, /const \[hasLoadedConversations, setHasLoadedConversations\]/);
  assert.match(activityRoute, /const loadNotifications = useCallback/);
  assert.match(activityRoute, /const loadConversations = useCallback/);
  assert.match(activityRoute, /notificationError && !hasLoadedNotifications/);
  assert.match(activityRoute, /conversationError && !hasLoadedConversations/);
  assert.match(activityRoute, /onRetry=\{\(\) => void loadNotifications\(\)\}/);
  assert.match(activityRoute, /onRetry=\{\(\) => void loadConversations\(\)\}/);
  assert.doesNotMatch(activityRoute, /setNotifications\(\[\]\);[\s\S]{0,120}setNotificationError/);
  assert.doesNotMatch(activityRoute, /setConversations\(\[\]\);[\s\S]{0,120}setConversationError/);
});

test("activity requests reject stale account and route responses", () => {
  assert.match(activityRoute, /const notificationRequestIdRef = useRef\(0\)/);
  assert.match(activityRoute, /const conversationRequestIdRef = useRef\(0\)/);
  assert.match(activityRoute, /requestId !== notificationRequestIdRef\.current/);
  assert.match(activityRoute, /requestId !== conversationRequestIdRef\.current/);
  assert.match(
    activityRoute,
    /return \(\) => \{[\s\S]*notificationRequestIdRef\.current \+= 1;[\s\S]*conversationRequestIdRef\.current \+= 1;/,
  );
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

test("phase 36 to 40 writes use one shared in-flight deduplication contract", () => {
  assert.match(helper, /runDeduplicatedRequest/);
  assert.match(helper, /const pending = requests\.get\(key\)/);
  assert.match(helper, /if \(pending\) return pending/);
  assert.match(helper, /requests\.delete\(key\)/);
});

test("favorites and saved searches route through guarded APIs", () => {
  assert.match(api, /favorites-guarded/);
  assert.match(api, /saved-searches-guarded/);
  assert.match(favorites, /pendingFavoriteWrites/);
  assert.match(savedSearches, /pendingSavedSearchCreates/);
  assert.match(savedSearches, /pendingSavedSearchFrequencyUpdates/);
  assert.match(savedSearches, /pendingSavedSearchDeletes/);
});

test("promotion, report, support, and moderation writes route through guarded APIs", () => {
  assert.match(api, /promotions-guarded/);
  assert.match(api, /reports-guarded/);
  assert.match(api, /support-guarded/);
  assert.match(api, /admin-listing-moderation-guarded/);
  assert.match(promotions, /pendingPromotionModeration/);
  assert.match(reports, /pendingReportModeration/);
  assert.match(support, /pendingSupportRequests/);
  assert.match(moderation, /pendingAdminListingModeration/);
});
