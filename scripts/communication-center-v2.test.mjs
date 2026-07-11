import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, shared, chats, notifications, activity, css, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("communication center stylesheet loads after messaging and activity foundations", () => {
  assert.match(root, /import communicationCenterV2Css from "\.\.\/communication-center-v2\.css\?url"/);
  const messaging = root.indexOf("href: messagingSignatureCss");
  const communication = root.indexOf("href: communicationCenterV2Css");
  assert.notEqual(messaging, -1);
  assert.notEqual(communication, -1);
  assert.ok(communication > messaging);
});

test("shared communication components avoid unsupported presence and read claims", () => {
  for (const component of [
    "CommunicationCenterHero",
    "CommunicationSafetyNote",
    "ConversationSummaryItem",
    "NotificationTimelineItem",
    "CommunicationSearch",
    "CommunicationSectionHeader",
    "CommunicationSignedOut",
  ]) {
    assert.match(shared, new RegExp(`export function ${component}`));
  }
  assert.doesNotMatch(shared, /online now|last seen|typing now|message read by/i);
});

test("messages use the shared workspace and preserve report block and read contracts", () => {
  assert.match(chats, /rawaj-communication-v2--messages/);
  assert.match(chats, /<CommunicationCenterHero/);
  assert.match(chats, /<CommunicationSafetyNote/);
  assert.match(chats, /<ConversationSummaryItem/);
  assert.match(chats, /rawaj-message-workspace/);
  assert.match(chats, /rawaj-message-stream/);
  assert.match(chats, /rawaj-message-composer/);
  assert.match(chats, /fetchMyConversations/);
  assert.match(chats, /fetchConversationMessages/);
  assert.match(chats, /markConversationRead/);
  assert.match(chats, /sendConversationMessage/);
  assert.match(chats, /createMessageReport/);
  assert.match(chats, /blockConversationParticipant/);
  assert.match(chats, /resolveConversationTarget/);
});

test("notifications use a factual timeline and preserve pagination read and target resolution", () => {
  assert.match(notifications, /rawaj-communication-v2--notifications/);
  assert.match(notifications, /<CommunicationCenterHero/);
  assert.match(notifications, /<NotificationTimelineItem/);
  assert.match(notifications, /rawaj-notification-list/);
  assert.match(notifications, /fetchMyNotificationsPage/);
  assert.match(notifications, /fetchUnreadNotificationsCount/);
  assert.match(notifications, /markNotificationRead/);
  assert.match(notifications, /markAllNotificationsRead/);
  assert.match(notifications, /resolveNotificationTarget/);
  assert.match(notifications, /<NotificationPreferencesPanel/);
});

test("activity center previews real notifications and conversations using shared navigation", () => {
  assert.match(activity, /rawaj-communication-v2--activity/);
  assert.match(activity, /<CommunicationCenterHero/);
  assert.match(activity, /rawaj-activity-tabs/);
  assert.match(activity, /rawaj-activity-panel/);
  assert.match(activity, /fetchMyNotificationsPage/);
  assert.match(activity, /fetchMyConversations/);
  assert.match(activity, /useUnreadActivityCounts/);
  assert.match(activity, /to="\/notifications"/);
  assert.match(activity, /to="\/chats"/);
});

test("communication center is responsive logical-property based and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-message-workspace/);
  assert.match(css, /\.rawaj-notification-timeline/);
  assert.match(css, /\.rawaj-activity-tabs/);
  assert.match(css, /inset-inline/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 389px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("quality gate permanently runs communication center V2 read-only", () => {
  assert.match(qualityGate, /contents: read/);
  assert.match(qualityGate, /Communication Center V2 contract/);
  assert.match(qualityGate, /node --test scripts\/communication-center-v2\.test\.mjs/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
