import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, shared, presence, notificationCard, chats, notifications, activity, css, qualityGate] =
  await Promise.all([
    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/lib/use-online-presence.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/notifications/NotificationTimelineCard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/activity.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  ]);

test("communication center stylesheet loads after messaging and activity foundations", () => {
  assert.match(
    root,
    /import communicationCenterV2Css from "\.\.\/communication-center-v2\.css\?url"/,
  );
  const messaging = root.indexOf("href: messagingSignatureCss");
  const communication = root.indexOf("href: communicationCenterV2Css");
  assert.notEqual(messaging, -1);
  assert.notEqual(communication, -1);
  assert.ok(communication > messaging);
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
  assert.match(presence, /table: "conversation_messages"/);
  assert.doesNotMatch(shared, /last seen|typing now|message read by/i);
});

test("messages preserve workspace report block and read contracts", () => {
  for (const contract of [
    /rawaj-communication-v2--messages/,
    /<CommunicationCenterHero/,
    /<CommunicationSafetyNote/,
    /<ConversationSummaryItem/,
    /rawaj-message-workspace/,
    /fetchMyConversations/,
    /fetchConversationMessages/,
    /markConversationRead/,
    /sendConversationMessage/,
    /createMessageReport/,
    /blockConversationParticipant/,
    /resolveConversationTarget/,
  ])
    assert.match(chats, contract);
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

test("communication center stays responsive and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-message-workspace/);
  assert.match(css, /\.rawaj-notification-timeline/);
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
