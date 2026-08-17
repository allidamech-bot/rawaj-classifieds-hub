import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  chats,
  baseCss,
  mobileCss,
  finalChatsCss,
  routeStyles,
  resolution,
  bottomDock,
  liveWorkspace,
] = await Promise.all([
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/communication-center-v3.css", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-chromatic-premium-system-v18-chats.css", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/journey-target-resolution.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/BottomDock.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/useLiveChatWorkspace.ts", import.meta.url),
    "utf8",
  ),
]);

test("opening /chats without a conversation query stays list-first (no auto-open)", () => {
  assert.doesNotMatch(
    chats,
    /if \(!search\.conversation && result\.data\[0\]\)\s*\{[\s\S]{0,120}navigate\(/,
  );
  assert.doesNotMatch(chats, /search: \{ conversation: result\.data\[0\]\.id \}/);
  assert.match(resolution, /Generic navigation to \/chats must remain list-first/);
  assert.doesNotMatch(resolution, /firstConversation/);
});

test("the bottom dock clears a stale conversation target when Chats is tapped", () => {
  assert.match(bottomDock, /search=\{item\.to === "\/chats" \? \{\} : undefined\}/);
});

test("direct links (?conversation=<id>) still select a conversation", () => {
  assert.match(chats, /resolveConversationTarget\(accountConversations, search\.conversation\)/);
  assert.match(chats, /kind === "selected"/);
  assert.match(chats, /setViewingConversationOnMobile\(true\)/);
});

test("invalid conversation id is not replaced by the first conversation", () => {
  assert.match(chats, /missingConversationTarget/);
  assert.match(resolution, /kind: "missing"/);
  assert.doesNotMatch(chats, /search\.conversation && result\.data\[0\]/);
});

test("mobile list mode removes the blank message panel through route state and explicit hidden state", () => {
  assert.match(chats, /data-view=\{selectedConversation \? "conversation" : "list"\}/);
  assert.match(baseCss, /\.rawaj-message-panel \{\s*display: flex;/);
  assert.match(mobileCss, /@import "\.\/communication-center-v2\.css";/);
  assert.match(
    mobileCss,
    /\.rawaj-message-workspace\[data-view="list"\] \.rawaj-message-panel \{[\s\S]*display: none !important;/,
  );
  assert.match(
    mobileCss,
    /\.rawaj-message-workspace \.rawaj-message-panel\.hidden \{[\s\S]*display: none !important;/,
  );
  assert.match(liveWorkspace, /import "\.\.\/\.\.\/communication-center-v3\.css";/);
  assert.match(routeStyles, /communicationCenterV2: communicationCenterV3Css/);
});

test("final mobile chats layer cannot inherit the desktop two-column workspace", () => {
  assert.match(
    finalChatsCss,
    /@media \(max-width: 1023px\)[\s\S]*\.rawaj-message-workspace\[data-view="list"\][\s\S]*display: block !important;/,
  );
  assert.match(
    finalChatsCss,
    /\.rawaj-message-workspace\[data-view="list"\][\s\S]*grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    finalChatsCss,
    /\.rawaj-message-workspace\[data-view="list"\] \.rawaj-conversation-sidebar \{[\s\S]*width: 100% !important;[\s\S]*max-width: 100% !important;/,
  );
  assert.match(
    finalChatsCss,
    /\.rawaj-message-workspace\[data-view="list"\] \.rawaj-message-panel \{[\s\S]*display: none !important;[\s\S]*width: 0 !important;/,
  );
});

test("final chats search uses the full available mobile sidebar width", () => {
  assert.match(
    finalChatsCss,
    /\.rawaj-communication-search \{[\s\S]*width: 100% !important;[\s\S]*max-width: none !important;[\s\S]*min-width: 0 !important;/,
  );
  assert.match(
    finalChatsCss,
    /\.rawaj-communication-search input \{[\s\S]*width: 100% !important;[\s\S]*min-width: 0 !important;[\s\S]*flex: 1 1 auto !important;/,
  );
});

test("conversation mode hides the sidebar and keeps a computed mobile message height", () => {
  assert.match(
    mobileCss,
    /\.rawaj-message-workspace\[data-view="conversation"\] \.rawaj-conversation-sidebar \{[\s\S]*display: none !important;/,
  );
  assert.match(
    mobileCss,
    /\.rawaj-message-workspace\[data-view="conversation"\] \.rawaj-message-panel \{[\s\S]*display: flex !important;[\s\S]*calc\(100dvh - 11rem\)/,
  );
});

test("mobile back button returns to the conversation list", () => {
  assert.match(chats, /onClick=\{\(\) => setViewingConversationOnMobile\(false\)\}/);
});
