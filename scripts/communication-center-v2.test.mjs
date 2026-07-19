import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  root,
  routeStyles,
  shared,
  notificationCard,
  chats,
  notifications,
  activity,
  cssV2,
  cssV3,
  qualityGate,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/notifications/NotificationTimelineCard.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v3.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("communication center V3 refinement loads after messaging and retains the V2 base", () => {
  assert.match(
    routeStyles,
    /import communicationCenterV3Css from "\.\.\/communication-center-v3\.css\?url"/,
  );
  assert.match(routeStyles, /communicationCenterV2: communicationCenterV3Css/);
  assert.match(cssV3, /@import "\.\/communication-center-v2\.css"/);

  const messaging = root.indexOf("routeStyleHrefs.messagingSignature");
  const communication = root.indexOf("routeStyleHrefs.communicationCenterV2");
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
  ])
    assert.match(shared, new RegExp(`export function ${component}`));
  assert.doesNotMatch(shared, /online now|last seen|typing now|message read by/i);
});

test("participant avatars reserve space and recover from broken identity media", () => {
  assert.match(shared, /AvatarImage/);
  assert.match(shared, /AvatarFallback/);
  assert.match(shared, /loading="lazy"/);
  assert.match(shared, /decoding="async"/);
  assert.match(shared, /width=\{44\}/);
  assert.match(shared, /height=\{44\}/);
  assert.match(shared, /name\.slice\(0, 1\)/);
  assert.doesNotMatch(shared, /url \? <img/);
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

test("notifications preserve successful snapshots across refresh failures", () => {
  assert.match(notifications, /const \[hasLoaded, setHasLoaded\]/);
  assert.match(notifications, /const loadedProfileIdRef = useRef<string \| null>\(null\)/);
  assert.match(notifications, /setHasLoaded\(true\)/);
  assert.match(notifications, /loading && !hasLoaded/);
  assert.match(notifications, /loadError && !hasLoaded/);
  assert.match(notifications, /onAction=\{\(\) => void loadNotifications\(\)\}/);
  assert.match(notifications, /actionLabel=\{text\("إعادة المحاولة", "Try again"\)\}/);
  assert.doesNotMatch(
    notifications,
    /setLoadError\(pageResult\.error\);[\s\S]{0,160}setNotifications\(\[\]\)/,
  );
  assert.doesNotMatch(
    notifications,
    /setLoadError\(pageResult\.error\);[\s\S]{0,160}setUnreadTotal\(0\)/,
  );
});

test("notification account changes reset snapshots while ordinary refreshes preserve them", () => {
  assert.match(notifications, /loadedProfileIdRef\.current !== profileId/);
  assert.match(notifications, /loadedProfileIdRef\.current = profileId/);
  assert.match(
    notifications,
    /return \(\) => \{[\s\S]*notificationsRequestIdRef\.current \+= 1;[\s\S]*paginationRequestIdRef\.current \+= 1;/,
  );
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

test("notifications localize from explicit safe DTO fields with Arabic fallback", () => {
  assert.match(notifications, /notification\.titleEn/);
  assert.match(notifications, /notification\.bodyEn/);
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
  assert.match(cssV2, /\.rawaj-message-workspace/);
  assert.match(cssV2, /\.rawaj-notification-timeline/);
  assert.match(cssV2, /inset-inline/);
  assert.match(cssV2, /@media \(min-width: 1024px\)/);
  assert.match(cssV2, /@media \(max-width: 389px\)/);
  assert.match(cssV2, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssV3, /@media \(max-width: 1023px\)/);
  assert.match(cssV3, /data-view="list"/);
});

test("quality gate permanently runs communication center V2 plus V3 refinement read-only", () => {
  assert.match(qualityGate, /contents: read/);
  assert.match(qualityGate, /Communication Center V2 contract/);
  assert.match(qualityGate, /node --test scripts\/communication-center-v2\.test\.mjs/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
