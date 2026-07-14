import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [hookSource, routeSource, packageSource] = await Promise.all([
  readFile(
    new URL("../src/features/communication/useLiveChatWorkspace.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("the visible chat subscribes to message and conversation changes", () => {
  assert.match(hookSource, /channel\(`rawaj-live-chat:\$\{profileId\}:\$\{selectedConversationId\}`\)/);
  assert.match(hookSource, /table: "conversation_messages"/);
  assert.match(hookSource, /filter: `conversation_id=eq\.\$\{selectedConversationId\}`/);
  assert.match(hookSource, /table: "conversations"/);
  assert.match(hookSource, /filter: `id=eq\.\$\{selectedConversationId\}`/);
  assert.match(hookSource, /removeChannel\(channel\)/);
});

test("live chat refreshes are debounced, bounded, and visibility aware", () => {
  assert.match(hookSource, /LIVE_CHAT_EVENT_DEBOUNCE_MS = 150/);
  assert.match(hookSource, /LIVE_CHAT_FALLBACK_POLL_MS = 60 \* 1000/);
  assert.match(hookSource, /setTimeout\([\s\S]*LIVE_CHAT_EVENT_DEBOUNCE_MS/);
  assert.match(hookSource, /window\.setInterval\(refreshWhenAvailable, LIVE_CHAT_FALLBACK_POLL_MS\)/);
  assert.match(hookSource, /document\.visibilityState === "hidden"/);
  assert.match(hookSource, /navigator\.onLine === false/);
  assert.match(hookSource, /addEventListener\("online", refreshWhenAvailable\)/);
  assert.match(hookSource, /addEventListener\("visibilitychange", refreshWhenAvailable\)/);
});

test("live chat deduplicates reads and ignores stale account or conversation results", () => {
  assert.match(hookSource, /interface InFlightChatRefresh/);
  assert.match(hookSource, /activeRefresh\?\.scopeKey === scopeKey/);
  assert.match(hookSource, /return activeRefresh\.promise/);
  assert.match(hookSource, /activeScopeRef\.current !== scopeKey/);
  assert.match(hookSource, /inFlightRefreshRef\.current = \{ scopeKey, promise: request \}/);
  assert.match(hookSource, /markConversationRead\(profileId, conversationId\)/);
  assert.match(hookSource, /conversation\.unreadCount !== 0/);
});

test("the chat route activates live sync only while the conversation panel is visible", () => {
  assert.match(routeSource, /useLiveChatWorkspace/);
  assert.match(routeSource, /isDesktop \|\| viewingConversationOnMobile/);
  assert.match(routeSource, /selectedConversationId: liveConversationId/);
  assert.match(routeSource, /setConversations/);
  assert.match(routeSource, /setMessages/);
});

test("the live chat contract is permanently included in the chat Quality Gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts["test:chat-workspace"], /chat-workspace-live\.test\.mjs/);
  assert.match(packageJson.scripts.check, /npm run test:chat-workspace/);
});
