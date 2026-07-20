import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [unreadActivity, liveChatWorkspace, publicAdSlot] = await Promise.all([
  readFile(new URL("../src/lib/unread-activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/communication/useLiveChatWorkspace.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
]);

test("unread activity no longer polls on a permanent interval", () => {
  assert.doesNotMatch(unreadActivity, /UNREAD_ACTIVITY_POLL_MS/);
  assert.doesNotMatch(unreadActivity, /window\.setInterval\(/);
  assert.match(unreadActivity, /table: "conversation_messages"/);
  assert.match(unreadActivity, /table: "conversations"/);
  assert.match(unreadActivity, /table: "notifications"/);
  assert.match(unreadActivity, /window\.addEventListener\("focus", handleRefresh\)/);
  assert.match(unreadActivity, /window\.addEventListener\("online", handleRefresh\)/);
});

test("live chat refreshes through realtime and lifecycle events without fallback polling", () => {
  assert.doesNotMatch(liveChatWorkspace, /LIVE_CHAT_FALLBACK_POLL_MS/);
  assert.doesNotMatch(liveChatWorkspace, /window\.setInterval\(/);
  assert.match(liveChatWorkspace, /table: "conversation_messages"/);
  assert.match(liveChatWorkspace, /table: "conversations"/);
  assert.match(liveChatWorkspace, /window\.addEventListener\("online", refreshWhenAvailable\)/);
  assert.match(liveChatWorkspace, /window\.addEventListener\("focus", refreshWhenAvailable\)/);
  assert.match(
    liveChatWorkspace,
    /document\.addEventListener\("visibilitychange", refreshWhenAvailable\)/,
  );
});

test("public ad placements avoid permanent polling and cap retries", () => {
  assert.doesNotMatch(publicAdSlot, /window\.setInterval\(/);
  assert.match(publicAdSlot, /AD_PLACEMENT_RETRY_LIMIT = 3/);
  assert.match(publicAdSlot, /retryAttempt >= AD_PLACEMENT_RETRY_LIMIT/);
  assert.match(publicAdSlot, /navigator\.onLine === false/);
});
