import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-chat-image-ui-v1.mjs";
let source = await readFile(path, "utf8");
for (const token of [
  "${cleanBody}",
  "${image.file.name}",
  "${image.file.size}",
  "${image.file.lastModified}",
]) {
  source = source.replaceAll(token, `\\${token}`);
}
source = source.replace(
  `await replaceIn(\n  "scripts/conversations-messaging-realtime-integrity.test.mjs",\n  \`assert.match(messaging, /rawaj_send_conversation_message_v2/);\`,\n  \`assert.match(messaging, /rawaj_send_conversation_message_v3/);\`,\n);\n\n`,
  "",
);
await writeFile(path, source, "utf8");
