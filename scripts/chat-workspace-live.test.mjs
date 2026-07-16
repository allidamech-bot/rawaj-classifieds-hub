import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [hookSource, routeSource, packageSource, realtimeMigration] = await Promise.all([
  readFile(
    new URL("../src/features/communication/useLiveChatWorkspace.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/migrations/202607160003_enable_chat_realtime.sql", import.meta.url),
    "utf8",
  ),
]);

test("the visible chat subscribes to message and conversation changes", () => {
  assert.match(
    hookSource,
    /channel\(`rawaj-live-chat:\$\{profileId\}:\$\{selectedConversationId\}`\)/,
  );
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
  assert.match(
    hookSource,
    /window\.setInterval\(refreshWhenAvailable, LIVE_CHAT_FALLBACK_POLL_MS\)/,
  );
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
  assert.match(hookSource, /refreshedConversation\.unreadCount <= 0/);
  assert.match(hookSource, /markConversationRead\(profileId, conversationId\)/);
  assert.match(hookSource, /conversation\.unreadCount !== 0/);
});

test("the chat route activates live sync only while the conversation panel is visible", () => {
  assert.match(routeSource, /useLiveChatWorkspace/);
  assert.match(
    routeSource,
    /isConversationPanelVisible = isDesktop \|\| viewingConversationOnMobile/,
  );
  assert.match(routeSource, /selectedConversationId: liveConversationId/);
  assert.match(routeSource, /setConversations/);
  assert.match(routeSource, /setMessages/);
});

test("mobile chat list view cannot load or mark a selected conversation read", () => {
  assert.match(
    routeSource,
    /auth\.status !== "signedIn" \|\| !selectedConversation \|\| !isConversationPanelVisible/,
  );
  assert.match(
    routeSource,
    /\[auth\.status, isConversationPanelVisible, selectedConversation\?\.id\]/,
  );
  assert.ok(
    routeSource.indexOf("!isConversationPanelVisible") <
      routeSource.indexOf("void loadMessages(selectedConversation.id)"),
  );
});

test("the Realtime publication includes both participant-scoped chat tables", () => {
  assert.match(realtimeMigration, /pg_catalog\.pg_publication/);
  assert.match(realtimeMigration, /pubname = 'supabase_realtime'/);
  assert.match(realtimeMigration, /ARRAY\['conversations', 'conversation_messages'\]/);
  assert.match(realtimeMigration, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.%I/);
  assert.match(realtimeMigration, /GRANT SELECT ON TABLE public\.conversations TO authenticated/);
  assert.match(
    realtimeMigration,
    /GRANT SELECT ON TABLE public\.conversation_messages TO authenticated/,
  );
  assert.match(realtimeMigration, /REVOKE SELECT ON TABLE public\.conversations FROM anon/);
  assert.match(realtimeMigration, /REVOKE SELECT ON TABLE public\.conversation_messages FROM anon/);
});

test("the live chat contract is permanently included in the chat Quality Gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts["test:chat-workspace"], /chat-workspace-live\.test\.mjs/);
  assert.match(packageJson.scripts.check, /npm run test:chat-workspace/);
});
