import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chats = await readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8");

test("conversation and message loading release loading after exceptions", () => {
  assert.match(chats, /async function loadConversations[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(chats, /operation: "chat_conversations_load"/);
  assert.match(chats, /async function loadMessages[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(chats, /operation: "chat_messages_load"/);
  assert.match(chats, /setLoadingConversations\(false\)/);
  assert.match(chats, /setLoadingMessages\(false\)/);
});

test("message send cleans attachments and releases its scope", () => {
  assert.match(chats, /async function handleSend[\s\S]*?sendInFlightScopesRef\.current\.has\(scopeKey\)/);
  assert.match(chats, /catch \(caught\)[\s\S]*?removeChatAudio[\s\S]*?removeChatImage/);
  assert.match(chats, /operation: "chat_message_send"/);
  assert.match(
    chats,
    /finally \{[\s\S]*?sendInFlightScopesRef\.current\.delete\(scopeKey\);[\s\S]*?next\.delete\(scopeKey\)/,
  );
  assert.match(chats, /aria-busy=\{sending\}/);
});

test("message reporting and blocking handle thrown failures", () => {
  assert.match(chats, /async function handleReport[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(chats, /async function handleBlock[\s\S]*?setBlocking\(true\)[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(chats, /setBlocking\(false\)/);
  assert.match(chats, /disabled=\{blocking\}/);
  assert.match(chats, /aria-busy=\{blocking\}/);
});
