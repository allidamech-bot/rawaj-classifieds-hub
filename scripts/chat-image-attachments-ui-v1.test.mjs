import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, messaging, types] = await Promise.all([
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),
]);

test("chat composer supports a validated private image", () => {
  assert.match(route, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(route, /validateChatImage/);
  assert.match(route, /uploadChatImage/);
  assert.match(route, /removeChatImage/);
  assert.match(route, /currentImage/);
});

test("images use v4 with v3 fallback and short-lived signed attachment URLs", () => {
  assert.match(messaging, /rawaj_send_conversation_message_v4/);
  assert.match(messaging, /rawaj_send_conversation_message_v3/);
  assert.match(messaging, /attachment_path/);
  assert.match(messaging, /createChatImageSignedUrl/);
  assert.match(
    messaging,
    /message\.attachmentKind === "audio"[\s\S]{0,160}createChatImageSignedUrl\(message\.attachmentPath\)/,
  );
  assert.match(types, /attachmentUrl: string \| null/);
  assert.match(types, /attachmentKind: "image" \| "audio" \| null/);
  assert.match(route, /message\.attachmentUrl/);
});
