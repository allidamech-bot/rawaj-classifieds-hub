import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [chats, css, resolution] = await Promise.all([
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/journey-target-resolution.ts", import.meta.url), "utf8"),
]);

test("opening /chats without a conversation query stays list-first (no auto-open)", () => {
  assert.doesNotMatch(
    chats,
    /if \(!search\.conversation && result\.data\[0\]\)\s*\{[\s\S]{0,120}navigate\(/,
  );
  assert.doesNotMatch(chats, /search: \{ conversation: result\.data\[0\]\.id \}/);
});

test("direct links (?conversation=<id>) still select a conversation", () => {
  assert.match(chats, /resolveConversationTarget\(accountConversations, search\.conversation\)/);
  assert.match(chats, /kind === "selected"/);
  assert.match(chats, /setViewingConversationOnMobile\(true\)/);
});

test("invalid conversation id is not replaced by the first conversation", () => {
  assert.match(chats, /missingConversationTarget/);
  assert.match(resolution, /kind: "missing"/);
  assert.doesNotMatch(
    chats,
    /search\.conversation && result\.data\[0\]/,
  );
});

test("mobile list view uses data-view isolation without forced full height", () => {
  assert.match(chats, /data-view=\{selectedConversation \? "conversation" : "list"\}/);
  assert.match(css, /\.rawaj-message-workspace\[data-view="list"\]/);
  assert.match(css, /\.rawaj-message-workspace\[data-view="list"\] \{\s*min-height: auto;/);
  assert.match(css, /\.rawaj-message-workspace\[data-view="list"\] \.rawaj-conversation-sidebar/);
});

test("conversation view uses a computed height for header and bottom navigation", () => {
  assert.match(css, /\.rawaj-message-workspace\[data-view="conversation"\]/);
  assert.match(css, /calc\(100dvh - 11rem\)/);
});

test("mobile back button returns to the conversation list", () => {
  assert.match(chats, /onClick=\{\(\) => setViewingConversationOnMobile\(false\)\}/);
});
