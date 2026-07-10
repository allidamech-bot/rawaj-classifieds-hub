import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chatRoutePath = new URL("../src/routes/chats.tsx", import.meta.url);
const chatRoute = await readFile(chatRoutePath, "utf8");

test("conversation search filters only the already-loaded user conversation list", () => {
  assert.match(chatRoute, /conversationQuery/);
  assert.match(chatRoute, /filteredConversations/);
  assert.match(chatRoute, /conversation\.otherParticipant\.displayName/);
  assert.match(chatRoute, /conversation\.listingTitle/);
  assert.match(chatRoute, /conversation\.lastMessagePreview/);
  assert.match(chatRoute, /filteredConversations\.map/);
  assert.match(chatRoute, /Search conversations/);
  assert.doesNotMatch(chatRoute, /conversationQuery[\s\S]*\.from\("conversations"\)/);
});

test("conversation search keeps an explicit empty-result state and accessible touch target", () => {
  assert.match(chatRoute, /filteredConversations\.length === 0/);
  assert.match(chatRoute, /No conversations match your search/);
  assert.match(chatRoute, /aria-label=\{text\("بحث في المحادثات", "Search conversations"\)\}/);
  assert.match(chatRoute, /min-h-11/);
});

test("quick replies fill the composer but never auto-send", () => {
  assert.match(chatRoute, /const quickReplies =/);
  assert.match(chatRoute, /selectedConversation\.status === "active"/);
  assert.match(chatRoute, /setBody\(language === "ar" \? reply\.ar : reply\.en\)/);
  assert.match(chatRoute, /Quick replies/);
  assert.match(chatRoute, /type="button"/);
  assert.match(chatRoute, /min-h-11/);
  assert.doesNotMatch(chatRoute, /quickReplies\.map\([\s\S]*onClick=\{\(\) => void handleSend/);
  assert.doesNotMatch(chatRoute, /quickReplies\.map\([\s\S]*sendConversationMessage/);
});

test("existing message safety controls remain present", () => {
  assert.match(chatRoute, /createMessageReport/);
  assert.match(chatRoute, /blockConversationParticipant/);
  assert.match(chatRoute, /selectedConversation\.status !== "active"/);
});
