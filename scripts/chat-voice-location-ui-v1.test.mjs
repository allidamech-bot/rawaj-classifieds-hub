import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, messaging, recorder, player, types] = await Promise.all([
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/communication/ChatVoiceRecorder.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/communication/ChatVoiceAttachment.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),
]);

test("voice composer records only after an explicit user action", () => {
  assert.match(recorder, /getUserMedia\(\{ audio: true \}\)/);
  assert.match(recorder, /MediaRecorder/);
  assert.match(recorder, /MAX_DURATION_MS = 120_000/);
  assert.match(route, /ChatVoiceRecorder/);
  assert.match(route, /handleVoiceRecorded/);
});

test("private voice uploads use v4 metadata and signed playback", () => {
  assert.match(messaging, /conversation-audio/);
  assert.match(messaging, /rawaj_send_conversation_message_v4/);
  assert.match(messaging, /p_attachment_kind: attachment\?\.kind/);
  assert.match(messaging, /p_attachment_duration_ms: attachment\?\.durationMs/);
  assert.match(messaging, /createChatAudioSignedUrl/);
  assert.match(player, /createChatAudioSignedUrl\(attachmentPath\)/);
  assert.match(types, /attachmentKind: "image" \| "audio" \| null/);
});

test("voice attachment state is isolated and orphan uploads are cleaned", () => {
  assert.ok((route.match(/setSelectedVoice\(\(current\) =>/g) ?? []).length >= 4);
  assert.match(route, /clearSelectedVoice\(\);\n\s+setMessageError\(null\)/);
  assert.match(route, /voice\) await removeChatAudio\(uploadedPath\)/);
  assert.match(route, /clearSelectedVoice\(\);\n\s+setConfirmedRisk/);
});

test("location sharing is explicit and inserted into the editable draft", () => {
  assert.match(route, /onClick=\{shareCurrentLocation\}/);
  assert.match(route, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(route, /setCurrentComposerBody/);
  assert.match(route, /google\.com\/maps\?q=/);
  assert.doesNotMatch(route, /watchPosition/);
  assert.doesNotMatch(route, /localStorage.*latitude|localStorage.*longitude/);
});
