import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  root,
  shared,
  presence,
  unreadActivity,
  notificationCard,
  chats,
  notifications,
  activity,
  css,
  chatCss,
  qualityGate,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/lib/use-online-presence.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/unread-activity.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/notifications/NotificationTimelineCard.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/chat-native-v3.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("communication styles load in foundation order with chat V3 last", () => {
  assert.match(
    root,
    /import communicationCenterV2Css from "\.\.\/communication-center-v2\.css\?url"/,
  );
  assert.match(root, /import chatNativeV3Css from "\.\.\/chat-native-v3\.css\?url"/);
  const messaging = root.indexOf("href: messagingSignatureCss");
  const communication = root.indexOf("href: communicationCenterV2Css");
  const chatV3 = root.indexOf("href: chatNativeV3Css");
  assert.notEqual(messaging, -1);
  assert.notEqual(communication, -1);
  assert.notEqual(chatV3, -1);
  assert.ok(communication > messaging);
  assert.ok(chatV3 > communication);
});

test("shared communication components expose only realtime-backed presence claims", () => {
  for (const component of [
    "CommunicationCenterHero",
    "CommunicationSafetyNote",
    "ConversationSummaryItem",
    "NotificationTimelineItem",
    "CommunicationSearch",
    "CommunicationSectionHeader",
    "CommunicationSignedOut",
  ])
    assert.match(shared, new RegExp(`export function ${component}`));

  assert.match(shared, /data-online=\{online\}/);
  assert.match(presence, /presenceState\(\)/);
  assert.match(presence, /channel\.track/);
  assert.match(presence, /useConversationActivityRealtime/);
  assert.match(presence, /table: "conversation_messages"/);
  assert.match(unreadActivity, /table: "notifications"/);
  assert.doesNotMatch(shared, /last seen|typing now|message read by/i);
});

test("messages use an inbox-first native thread while preserving safety and read contracts", () => {
  for (const contract of [
    /rawaj-chat-screen/,
    /rawaj-chat-inbox/,
    /rawaj-chat-thread/,
    /mobileThreadOpen/,
    /returnToConversationList/,
    /<ConversationSummaryItem/,
    /fetchMyConversations/,
    /fetchConversationMessages/,
    /markConversationRead/,
    /sendConversationMessage/,
    /createMessageReport/,
    /blockConversationParticipant/,
    /resolveConversationTarget/,
  ])
    assert.match(chats, contract);

  assert.doesNotMatch(chats, /<CommunicationCenterHero/);
  assert.doesNotMatch(chats, /<CommunicationSafetyNote/);
  assert.match(chatCss, /html\[data-chat-thread-open="true"\] \.rawaj-mobile-dock/);
  assert.match(chatCss, /\.rawaj-chat-layout/);
  assert.match(chatCss, /@media \(min-width: 1024px\)/);
});

test("notifications separate loading failures from action failures", () => {
  assert.match(notifications, /const \[loadError, setLoadError\]/);
  assert.match(notifications, /const \[actionMessage, setActionMessage\]/);
  assert.match(notifications, /loadError \?/);
  assert.match(notifications, /actionMessage \?/);
  assert.doesNotMatch(notifications, /const \[error, setError\]/);
});

test("notifications expose accurate activity and visible async states", () => {
  assert.match(notifications, /useUnreadActivityCounts/);
  assert.match(notifications, /unreadMessages=\{counts\.messages\}/);
  assert.match(notifications, /const \[markingAll, setMarkingAll\]/);
  assert.match(notifications, /const \[markingReadIds, setMarkingReadIds\]/);
  assert.match(notifications, /aria-busy=\{markingAll\}/);
  assert.match(notificationCard, /aria-busy=\{markingRead\}/);
  assert.match(notificationCard, /disabled=\{markingRead\}/);
});

test("notifications preserve pagination read and target recovery", () => {
  for (const contract of [
    /fetchMyNotificationsPage/,
    /fetchUnreadNotificationsCount/,
    /markNotificationRead/,
    /markAllNotificationsRead/,
    /resolveNotificationTarget/,
    /<NotificationPreferencesPanel/,
    /<NotificationTimelineCard/,
    /openingTargetIds\.has\(notification\.id\)/,
    /لم يعد الهدف المرتبط بهذا التنبيه متاحًا/,
    /await markOne\(notification\.id\)/,
  ])
    assert.match(notifications, contract);
});

test("notifications localize from metadata with safe Arabic fallback", () => {
  assert.match(notifications, /metadataString\(notification\.metadata, "title_en"\)/);
  assert.match(notifications, /metadataString\(notification\.metadata, "body_en"\)/);
  assert.match(notifications, /\|\|\s+notification\.titleAr/);
  assert.match(notifications, /\|\|\s+notification\.bodyAr/);
});

test("activity center previews real notifications and conversations", () => {
  assert.match(activity, /rawaj-communication-v2--activity/);
  assert.match(activity, /fetchMyNotificationsPage/);
  assert.match(activity, /fetchMyConversations/);
  assert.match(activity, /useUnreadActivityCounts/);
  assert.match(activity, /to="\/notifications"/);
  assert.match(activity, /to="\/chats"/);
});

test("communication center and chat remain responsive and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-notification-timeline/);
  assert.match(css, /inset-inline/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 389px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(chatCss, /@media \(max-width: 1023px\)/);
  assert.match(chatCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("quality gate permanently runs communication center V2 read-only", () => {
  assert.match(qualityGate, /contents: read/);
  assert.match(qualityGate, /Communication Center V2 contract/);
  assert.match(qualityGate, /node --test scripts\/communication-center-v2\.test\.mjs/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
