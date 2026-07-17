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

test("messages use v3 and short-lived signed attachment URLs", () => {
  assert.match(messaging, /rawaj_send_conversation_message_v3/);
  assert.match(messaging, /attachment_path/);
  assert.match(messaging, /createChatImageSignedUrl/);
  assert.match(
    messaging,
    /message\.attachmentUrl = await createChatImageSignedUrl\(message\.attachmentPath\)/,
  );
  assert.match(types, /attachmentUrl: string \| null/);
  assert.match(route, /message\.attachmentUrl/);
});
