import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [runtime, recorder, guarded, migration, ledger, workflow] = await Promise.all([
  readFile(new URL("../src/lib/api/chat-audio-send-guarded.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/ChatVoiceRecorder.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/lib/api/messaging-guarded.ts", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/202607180002_reconcile_chat_audio_send_runtime.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/chat-audio-send-runtime.yml", import.meta.url),
    "utf8",
  ),
]);

test("Android recorder produces only canonical supported audio formats", () => {
  assert.match(recorder, /audio\/webm;codecs=opus/);
  assert.match(recorder, /audio\/mp4;codecs=mp4a\.40\.2/);
  assert.match(recorder, /if \(!mimeType\)/);
  assert.match(recorder, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(recorder, /canonicalMimeType\(recorder\.mimeType \|\| mimeType\)/);
  assert.doesNotMatch(recorder, /mimeType \?\s*new MediaRecorder[\s\S]*:\s*new MediaRecorder\(stream\)/);
});

test("audio runtime canonicalizes WebView MIME aliases and retries stale uploads", () => {
  assert.match(runtime, /"video\/webm": "audio\/webm"/);
  assert.match(runtime, /"audio\/x-m4a": "audio\/mp4"/);
  assert.match(runtime, /"audio\/mp3": "audio\/mpeg"/);
  assert.match(runtime, /new File\(\[file\], normalizedName/);
  assert.match(runtime, /isDuplicateStorageObject/);
  assert.match(runtime, /\.from\(CHAT_AUDIO_BUCKET\)[\s\S]*\.remove\(\[pathResult\.data\]\)/);
  assert.match(runtime, /operation: "chat_audio_retry_cleanup"/);
  assert.match(runtime, /operation: "chat_audio_upload"/);
  assert.match(runtime, /operation: "chat_audio_message_send"/);
});

test("public classifieds API routes audio operations through the hardened layer", () => {
  assert.match(guarded, /from "@\/lib\/api\/chat-audio-send-guarded"/);
  assert.match(guarded, /sendConversationMessage/);
  assert.match(guarded, /uploadChatAudio/);
  assert.match(guarded, /validateChatAudio/);
  assert.doesNotMatch(
    guarded,
    /sendConversationMessage,[\s\S]*uploadChatAudio,[\s\S]*validateChatAudio,[\s\S]*from "@\/lib\/api\/messaging"/,
  );
});

test("forward migration repairs the complete authenticated audio contract", () => {
  assert.match(migration, /conversation-audio/);
  assert.match(migration, /conversation_audio_participant_read/);
  assert.match(migration, /conversation_audio_sender_insert/);
  assert.match(migration, /conversation_audio_sender_delete/);
  assert.match(migration, /rawaj_chat_attachment_conversation_id/);
  assert.match(migration, /rawaj_is_conversation_participant/);
  assert.match(migration, /create or replace function public\.rawaj_send_conversation_message_v4/);
  assert.match(
    migration,
    /grant execute on function public\.rawaj_send_conversation_message_v4\([\s\S]*to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.rawaj_send_conversation_message_v4\([\s\S]*to anon/,
  );
  assert.match(migration, /notify pgrst, 'reload schema'/);
  assert.match(ledger, /202607180002_reconcile_chat_audio_send_runtime\.sql/);
});

test("permanent workflow validates code, migration ledger, typecheck, and build", () => {
  assert.match(workflow, /scripts\/chat-audio-send-runtime\.test\.mjs/);
  assert.match(workflow, /scripts\/check-migration-ledger\.mjs/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
  assert.doesNotMatch(workflow, /contents: write/);
});
