import { readFile, writeFile, unlink } from "node:fs/promises";

const path = "src/lib/api/messaging.ts";
const source = await readFile(path, "utf8");
const before = `    const row = ((response.data ?? []) as Record<string, unknown>[])[0];\n    if (row) return { ok: true, data: mapMessage(row, actorUserId) };`;
const after = `    const row = ((response.data ?? []) as Record<string, unknown>[])[0];\n    if (row) {\n      const message = mapMessage(row, actorUserId);\n      if (message.attachmentPath) {\n        message.attachmentUrl = await createChatImageSignedUrl(message.attachmentPath);\n      }\n      return { ok: true, data: message };\n    }`;
if (!source.includes(before)) throw new Error("Missing immediate attachment URL anchor");
await writeFile(path, source.replace(before, after), "utf8");
await unlink("scripts/apply-chat-image-immediate-url.mjs");
await unlink(".github/workflows/apply-chat-image-immediate-url.yml");
