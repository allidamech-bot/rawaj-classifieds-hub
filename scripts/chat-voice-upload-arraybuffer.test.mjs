import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [recorder, strategy, messaging, migration, packageJson] = await Promise.all([
  readFile(new URL("../src/features/communication/ChatVoiceRecorder.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/chat-audio-recorder-strategy.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/migrations/202607170008_chat_voice_messages_v1.sql", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("recorder canonicalizes codec MIME values before creating the uploadable voice file", () => {
  assert.ok(recorder.includes("normalizeRecordedMimeType"));
  assert.ok(strategy.includes('split(";")'));
  assert.ok(recorder.includes("const snapshotChunks = chunksRef.current.slice()"));
  assert.ok(recorder.includes("new Blob(snapshotChunks, { type })"));
  assert.ok(recorder.includes("createUploadableFromBlob(blob, type, extension)"));
  assert.ok(strategy.includes("new File([blob]"));
  assert.ok(strategy.includes("audio/webm"));
  assert.ok(strategy.includes("audio/mp4"));
});

test("voice upload uses ArrayBuffer so Supabase applies the canonical content type", () => {
  assert.ok(messaging.includes("normalizeChatAudioMimeType"));
  assert.ok(messaging.includes("await payload.file.arrayBuffer()"));
  assert.ok(messaging.includes(".upload(path, audioBytes,"));
  const audioUpload = messaging.slice(
    messaging.indexOf("export async function uploadChatAudio"),
    messaging.indexOf("export async function removeChatAudio"),
  );
  assert.ok(!audioUpload.includes(".upload(path, payload.file"));
  assert.ok(messaging.includes("contentType: mimeType"));
});

test("client MIME contract remains aligned with the production migration", () => {
  for (const mime of ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]) {
    assert.ok(messaging.includes(mime));
    assert.ok(migration.includes(mime));
  }
  assert.ok(migration.includes("conversation-audio"));
  assert.ok(migration.includes("rawaj_send_conversation_message_v4"));
});

test("the repository uses the Supabase client version whose Blob path is avoided", () => {
  assert.ok(packageJson.includes('"@supabase/supabase-js": "^2.87.1"'));
  assert.ok(messaging.includes("chat_audio_prepare"));
  assert.ok(messaging.includes("chat_audio_upload"));
});
