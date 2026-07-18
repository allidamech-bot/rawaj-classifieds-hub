import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const current = await readFile(path, "utf8");
  if (!current.includes(before)) {
    throw new Error(`Missing patch anchor in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, current.replace(before, after));
}

await replaceOnce(
  "src/features/communication/ChatVoiceRecorder.tsx",
  `function extensionForMime(mime: string) {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}
`,
  `function normalizeRecordedMimeType(mime: string) {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  return ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"].includes(base) ? base : "";
}

function extensionForMime(mime: string) {
  if (mime === "audio/mp4") return "m4a";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/ogg") return "ogg";
  return "webm";
}
`,
);

await replaceOnce(
  "src/features/communication/ChatVoiceRecorder.tsx",
  `        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) {
          const file = new File([blob], \`voice-\${Date.now()}.\${extensionForMime(type)}\`, { type });
          onRecorded({ file, previewUrl: URL.createObjectURL(blob), durationMs });
        }
        cleanup();`,
  `        const type = normalizeRecordedMimeType(recorder.mimeType || mimeType || "audio/webm");
        if (!type) {
          cleanup();
          onError(labels.unsupported);
          return;
        }
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) {
          const file = new File([blob], \`voice-\${Date.now()}.\${extensionForMime(type)}\`, { type });
          onRecorded({ file, previewUrl: URL.createObjectURL(blob), durationMs });
        } else {
          onError(labels.unsupported);
        }
        cleanup();`,
);

await replaceOnce(
  "src/lib/api/messaging.ts",
  `export function validateChatAudio(file: File, durationMs: number): ClassifiedsResult<null> {
  const mimeType = file.type.split(";")[0];
  if (!CHAT_AUDIO_MIME_TYPES.includes(mimeType as UploadedChatAudio["mimeType"]))`,
  `function normalizeChatAudioMimeType(value: string): UploadedChatAudio["mimeType"] | null {
  const mimeType = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return CHAT_AUDIO_MIME_TYPES.includes(mimeType as UploadedChatAudio["mimeType"])
    ? (mimeType as UploadedChatAudio["mimeType"])
    : null;
}

export function validateChatAudio(file: File, durationMs: number): ClassifiedsResult<null> {
  const mimeType = normalizeChatAudioMimeType(file.type);
  if (!mimeType)`,
);

await replaceOnce(
  "src/lib/api/messaging.ts",
  `  const conversationId = normalizeChatResourceId(payload.conversationId);
  const requestId = normalizeChatResourceId(payload.requestId);
  const mimeType = payload.file.type.split(";")[0];
  const validation = validateChatAudio(payload.file, payload.durationMs);`,
  `  const conversationId = normalizeChatResourceId(payload.conversationId);
  const requestId = normalizeChatResourceId(payload.requestId);
  const mimeType = normalizeChatAudioMimeType(payload.file.type);
  const validation = validateChatAudio(payload.file, payload.durationMs);`,
);

await replaceOnce(
  "src/lib/api/messaging.ts",
  `  if (!conversationId || !requestId || !validation.ok)
    return validation.ok
      ? { ok: false, error: { code: "validation_error", message: "تعذر تحديد التسجيل الصوتي." } }
      : validation;`,
  `  if (!conversationId || !requestId || !mimeType || !validation.ok)
    return validation.ok
      ? { ok: false, error: { code: "validation_error", message: "تعذر تحديد التسجيل الصوتي." } }
      : validation;`,
);

await replaceOnce(
  "src/lib/api/messaging.ts",
  `  const path = [conversationId, userId, requestId].join("/") + "." + extension;
  const { error } = await clientResult.data.storage
    .from("conversation-audio")
    .upload(path, payload.file, { upsert: false, contentType: mimeType, cacheControl: "3600" });
  if (error) return { ok: false, error: mapError(error, "chat_audio_upload") };`,
  `  const path = [conversationId, userId, requestId].join("/") + "." + extension;
  let audioBytes: ArrayBuffer;
  try {
    audioBytes = await payload.file.arrayBuffer();
  } catch {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تجهيز التسجيل الصوتي للإرسال. أعد تسجيله ثم حاول مجدداً.",
        operation: "chat_audio_prepare",
      },
    };
  }
  const { error } = await clientResult.data.storage
    .from("conversation-audio")
    .upload(path, audioBytes, { upsert: false, contentType: mimeType, cacheControl: "3600" });
  if (error) {
    const mapped = mapError(error, "chat_audio_upload");
    return {
      ok: false,
      error: {
        ...mapped,
        message:
          mapped.code === "permission_denied"
            ? "تعذر رفع التسجيل بسبب صلاحيات التخزين. أعد تسجيل الدخول ثم حاول مجدداً."
            : "تعذر رفع التسجيل الصوتي الآن. حاول إعادة التسجيل والإرسال.",
      },
    };
  }`,
);

await writeFile(
  "scripts/chat-voice-upload-arraybuffer.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [recorder, messaging, migration, packageJson] = await Promise.all([
  readFile(new URL("../src/features/communication/ChatVoiceRecorder.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/202607170008_chat_voice_messages_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("recorder strips codec parameters before creating the voice File", () => {
  assert.match(recorder, /normalizeRecordedMimeType/);
  assert.match(recorder, /mime\.split\(";"\)/);
  assert.match(recorder, /new Blob\(chunksRef\.current, \{ type \}\)/);
  assert.match(recorder, /new File\(\[blob\].*\{ type \}/s);
  assert.match(recorder, /audio\/webm/);
  assert.match(recorder, /audio\/mp4/);
});

test("voice upload uses ArrayBuffer so Supabase applies the canonical content type", () => {
  assert.match(messaging, /normalizeChatAudioMimeType/);
  assert.match(messaging, /await payload\.file\.arrayBuffer\(\)/);
  assert.match(messaging, /\.upload\(path, audioBytes,/);
  assert.doesNotMatch(messaging, /conversation-audio"\)\s*\.upload\(path, payload\.file/);
  assert.match(messaging, /contentType: mimeType/);
});

test("client MIME contract remains aligned with the production migration", () => {
  for (const mime of ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]) {
    assert.ok(messaging.includes(mime));
    assert.ok(migration.includes(mime));
  }
  assert.match(migration, /conversation-audio/);
  assert.match(migration, /rawaj_send_conversation_message_v4/);
});

test("the repository uses the Supabase client version whose Blob path is avoided", () => {
  assert.match(packageJson, /"@supabase\/supabase-js": "\^2\.87\.1"/);
  assert.match(messaging, /chat_audio_prepare/);
  assert.match(messaging, /chat_audio_upload/);
});
`,
);
