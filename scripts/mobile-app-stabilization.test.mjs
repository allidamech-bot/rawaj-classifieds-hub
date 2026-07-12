import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  home,
  pullToRefresh,
  chats,
  communication,
  presence,
  unreadActivity,
  addListing,
  styles,
  chatStyles,
  androidStyles,
  mainActivity,
  launcherAdaptive,
  launcherLegacy,
] = await Promise.all([
  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/native/NativePullToRefresh.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/lib/use-online-presence.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/unread-activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/mobile-app-stabilization.css", import.meta.url), "utf8"),
  readFile(new URL("../src/chat-native-v3.css", import.meta.url), "utf8"),
  readFile(new URL("../android/app/src/main/res/values/styles.xml", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../android/app/src/main/java/com/rawaj/marketplace/MainActivity.java",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL("../android/app/src/main/res/mipmap-anydpi-v26/rawaj_launcher.xml", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../android/app/src/main/res/mipmap-anydpi/rawaj_launcher.xml", import.meta.url),
    "utf8",
  ),
]);

test("native home supports pull-to-refresh without recreating the Activity", () => {
  assert.match(home, /NativePullToRefresh/);
  assert.match(home, /router\.invalidate\(\)/);
  assert.match(pullToRefresh, /Capacitor\.isNativePlatform\(\)/);
  assert.match(pullToRefresh, /touchmove/);
  assert.match(pullToRefresh, /REFRESH_THRESHOLD = 64/);
});

test("mobile chats are inbox-first and never render an empty message canvas", () => {
  assert.doesNotMatch(chats, /search: \{ conversation: result\.data\[0\]\.id \}/);
  assert.match(chats, /mobileThreadOpen/);
  assert.match(chats, /!mobileThreadOpen \?/);
  assert.match(chats, /rawaj-chat-inbox/);
  assert.match(chats, /rawaj-chat-thread/);
  assert.match(chats, /returnToConversationList/);
  assert.match(chats, /onlineUserIds\.has/);
  assert.match(chats, /messagesEndRef/);
  assert.match(communication, /Open conversation with/);
  assert.match(chatStyles, /html\[data-chat-thread-open="true"\] \.rawaj-mobile-dock/);
});

test("chat presence incoming messages and unread badges update through Supabase realtime", () => {
  assert.match(presence, /presenceState\(\)/);
  assert.match(presence, /channel\.track/);
  assert.match(presence, /useConversationActivityRealtime/);
  assert.match(presence, /table: "conversation_messages"/);
  assert.match(presence, /event: "INSERT"/);
  assert.match(unreadActivity, /table: "notifications"/);
  assert.match(unreadActivity, /recipient_id=eq\.\$\{profileId\}/);
  assert.match(communication, /rawaj-conversation-summary__unread/);
});

test("listing submission requires explicit, auditable legal acceptance", () => {
  assert.match(addListing, /LISTING_TERMS_VERSION = "2026-07-12"/);
  assert.match(addListing, /data-listing-terms="true"/);
  assert.match(addListing, /listing_terms_accepted: true/);
  assert.match(addListing, /listing_terms_accepted_at: new Date\(\)\.toISOString\(\)/);
  assert.match(addListing, /!acceptedTerms/);
});

test("Android fields keep Arabic text vertically centered", () => {
  assert.match(styles, /input\.input,\s*select\.input/);
  assert.match(styles, /height: 3rem/);
  assert.match(styles, /padding-block: 0/);
});

test("Android uses one fast launch experience and a safe-zone launcher mark", () => {
  assert.match(androidStyles, /@drawable\/rawaj_splash_transparent/);
  assert.doesNotMatch(androidStyles, /@drawable\/splash/);
  assert.match(mainActivity, /INTRO_MIN_VISIBLE_MS = 650L/);
  assert.match(mainActivity, /INTRO_MAX_VISIBLE_MS = 2400L/);
  assert.match(launcherAdaptive, /@drawable\/rawaj_launcher_foreground/);
  assert.match(launcherLegacy, /android:width="38dp"/);
});
