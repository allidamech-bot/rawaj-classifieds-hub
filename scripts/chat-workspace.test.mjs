import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [chatRoute, communicationComponents, communicationCss, guardedMessaging, api] =
  await Promise.all([
    readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/communication-center-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/messaging-guarded.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  ]);

test("conversation search filters only the already-loaded user conversation list", () => {
  assert.match(chatRoute, /conversationQuery/);
  assert.match(chatRoute, /filteredConversations/);
  assert.match(chatRoute, /conversation\.otherParticipant\.displayName/);
  assert.match(chatRoute, /conversation\.listingTitle/);
  assert.match(chatRoute, /conversation\.lastMessagePreview/);
  assert.match(chatRoute, /filteredConversations\.map/);
  assert.match(chatRoute, /Search conversations/);
  assert.match(chatRoute, /<CommunicationSearch/);
  assert.doesNotMatch(chatRoute, /conversationQuery[\s\S]*\.from\("conversations"\)/);
});

test("conversation search keeps an explicit empty-result state and accessible touch target", () => {
  assert.match(chatRoute, /filteredConversations\.length === 0/);
  assert.match(chatRoute, /No conversations match your search/);
  assert.match(chatRoute, /label=\{text\("بحث في المحادثات", "Search conversations"\)\}/);
  assert.match(communicationComponents, /aria-label=\{label\}/);
  assert.match(communicationCss, /\.rawaj-communication-search[\s\S]*min-height: 3rem/);
});

test("quick replies fill the active composer scope but never auto-send", () => {
  assert.match(chatRoute, /const quickReplies =/);
  assert.match(chatRoute, /selectedConversation\.status === "active"/);
  assert.match(chatRoute, /setCurrentComposerBody\(language === "ar" \? reply\.ar : reply\.en\)/);
  assert.match(chatRoute, /function setCurrentComposerBody/);
  assert.match(chatRoute, /Quick replies/);
  assert.match(chatRoute, /type="button"/);
  assert.match(chatRoute, /rawaj-quick-replies/);
  assert.match(communicationCss, /\.rawaj-quick-replies button[\s\S]*min-height: 2\.45rem/);
  assert.doesNotMatch(chatRoute, /quickReplies\.map\([\s\S]*onClick=\{\(\) => void handleSend/);
  assert.doesNotMatch(chatRoute, /quickReplies\.map\([\s\S]*sendConversationMessage/);
});

test("existing message safety controls remain present", () => {
  assert.match(chatRoute, /createMessageReport/);
  assert.match(chatRoute, /blockConversationParticipant/);
  assert.match(chatRoute, /selectedConversation\.status !== "active"/);
});

test("conversation starts, reports and blocks deduplicate identical concurrent writes", () => {
  assert.match(api, /messaging-guarded/);
  assert.match(guardedMessaging, /pendingConversationStarts/);
  assert.match(guardedMessaging, /pendingMessageReports/);
  assert.match(guardedMessaging, /pendingParticipantBlocks/);
  assert.match(guardedMessaging, /function runOnce/);
  assert.match(guardedMessaging, /if \(pending\) return pending/);
  assert.match(guardedMessaging, /baseStartListingConversation/);
  assert.match(guardedMessaging, /baseCreateMessageReport/);
  assert.match(guardedMessaging, /baseBlockConversationParticipant/);
});
