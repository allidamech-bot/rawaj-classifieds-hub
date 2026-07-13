import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [chatRoute, communicationComponents, chatCss, bottomDock, targetResolution] =
  await Promise.all([
    readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/chat-native-v3.css", import.meta.url), "utf8"),
    readFile(new URL("../src/components/shell/BottomDock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/journey-target-resolution.ts", import.meta.url), "utf8"),
  ]);

test("conversation search filters only the already-loaded user conversation list", () => {
  assert.match(chatRoute, /conversationQuery/);
  assert.match(chatRoute, /filteredConversations/);
  assert.match(chatRoute, /conversation\.otherParticipant\.displayName/);
  assert.match(chatRoute, /conversation\.listingTitle/);
  assert.match(chatRoute, /conversation\.lastMessagePreview/);
  assert.match(chatRoute, /filteredConversations\.map/);
  assert.match(chatRoute, /Search people or listings/);
  assert.match(chatRoute, /<CommunicationSearch/);
  assert.doesNotMatch(chatRoute, /conversationQuery[\s\S]*\.from\("conversations"\)/);
});

test("mobile navigation always enters the inbox and never preserves an open thread", () => {
  assert.match(bottomDock, /CHAT_INBOX_TARGET/);
  assert.match(
    bottomDock,
    /search=\{[\s\S]*item\.to === "\/chats"[\s\S]*conversation: CHAT_INBOX_TARGET/,
  );
  assert.match(bottomDock, /data-chat-inbox-entry/);
  assert.match(targetResolution, /export const CHAT_INBOX_TARGET = "__inbox__"/);
  assert.match(targetResolution, /requestedId === CHAT_INBOX_TARGET/);
  assert.match(targetResolution, /return \{ kind: "default", conversation: firstConversation \}/);
  assert.match(chatRoute, /targetResolution\.kind === "selected"/);
  assert.match(chatRoute, /mobileThreadOpen/);
  assert.match(chatRoute, /returnToConversationList/);
  assert.doesNotMatch(chatRoute, /search: \{ conversation: result\.data\[0\]\.id \}/);
});

test("conversation search keeps an explicit empty-result state and accessible touch target", () => {
  assert.match(chatRoute, /filteredConversations\.length === 0/);
  assert.match(chatRoute, /No results/);
  assert.match(chatRoute, /label=\{text\("بحث في المحادثات", "Search conversations"\)\}/);
  assert.match(communicationComponents, /aria-label=\{label\}/);
  assert.match(
    chatCss,
    /\.rawaj-chat-inbox \.rawaj-communication-search[\s\S]*min-height: 3\.2rem/,
  );
});

test("quick replies fill the composer but never auto-send", () => {
  assert.match(chatRoute, /const quickReplies =/);
  assert.match(chatRoute, /selectedConversation\.status === "active"/);
  assert.match(chatRoute, /setBody\(language === "ar" \? reply\.ar : reply\.en\)/);
  assert.match(chatRoute, /rawaj-chat-quick-replies/);
  assert.match(chatRoute, /type="button"/);
  assert.match(chatCss, /\.rawaj-chat-quick-replies button[\s\S]*min-height: 2\.2rem/);
  assert.doesNotMatch(chatRoute, /quickReplies\.map\([\s\S]*onClick=\{\(\) => void handleSend/);
  assert.doesNotMatch(chatRoute, /quickReplies\.map\([\s\S]*sendConversationMessage/);
});

test("unread badges sit beside sender names and message safety controls remain present", () => {
  assert.match(communicationComponents, /rawaj-conversation-summary__name-row/);
  assert.match(communicationComponents, /rawaj-conversation-summary__unread/);
  assert.match(chatCss, /\.rawaj-conversation-summary__unread/);
  assert.match(chatRoute, /createMessageReport/);
  assert.match(chatRoute, /blockConversationParticipant/);
  assert.match(chatRoute, /selectedConversation\.status !== "active"/);
});
