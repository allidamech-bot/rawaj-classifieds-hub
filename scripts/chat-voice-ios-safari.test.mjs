import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [recorder, messaging, chats] = await Promise.all([
  readFile(new URL("../src/features/communication/ChatVoiceRecorder.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
]);

test("recorder candidates include iPhone Safari MP4 video types", () => {
  assert.match(recorder, /"video\/mp4;codecs=mp4a\.40\.2"/);
  assert.match(recorder, /"video\/mp4"/);
  assert.match(recorder, /"audio\/mp4;codecs=mp4a\.40\.2"/);
  assert.match(recorder, /"audio\/mp4"/);
  assert.match(recorder, /"audio\/webm;codecs=opus"/);
  assert.match(recorder, /"audio\/webm"/);
  assert.match(recorder, /"audio\/ogg;codecs=opus"/);
  assert.match(recorder, /"audio\/ogg"/);
  assert.match(recorder, /MediaRecorder\.isTypeSupported\(type\)/);
});

test("canonical MIME maps video/mp4 and video/webm to audio variants", () => {
  assert.match(recorder, /if \(base === "video\/mp4"\) return "audio\/mp4"/);
  assert.match(recorder, /if \(base === "video\/webm"\) return "audio\/webm"/);
  assert.match(recorder, /if \(base === "audio\/m4a" \|\| base === "audio\/x-m4a"\) return "audio\/mp4"/);
  assert.match(recorder, /if \(base === "audio\/mp3"\) return "audio\/mpeg"/);
});

test("recorder prefers the actual chunk MIME before recorder.mimeType", () => {
  assert.match(recorder, /recordedChunkMimeRef/);
  assert.match(recorder, /if \(!recordedChunkMimeRef\.current && event\.data\.type\)/);
  assert.match(recorder, /const resolvedRaw =/);
  assert.match(recorder, /storedChunkMime && normalizeRecordedMimeType\(storedChunkMime\) \? storedChunkMime : ""/);
  assert.match(recorder, /recorderMime \|\|/);
  assert.match(recorder, /selectedMimeType/);
});

test("MP4 uses recorder.start() with no timeslice; other types keep timeslice", () => {
  assert.match(recorder, /shouldUseRecorderTimeslice/);
  assert.match(
    recorder,
    /if \(shouldUseRecorderTimeslice\(selectedMimeType \?\? "audio\/webm"\)\) \{\s*recorder\.start\(500\);\s*\} else \{\s*recorder\.start\(\);\s*\}/,
  );
  assert.match(recorder, /base === "video\/mp4" \|\| base === "audio\/mp4"\) return false/);
});

test("audio/mp4 produces an m4a file and stops microphone tracks after onstop", () => {
  assert.match(recorder, /if \(mime === "audio\/mp4"\) return "m4a"/);
  assert.match(recorder, /stopMicrophone\(\);/);
  assert.match(recorder, /const snapshotChunks = chunksRef\.current\.slice\(\)/);
  assert.match(recorder, /const blob = new Blob\(snapshotChunks, \{ type \}\)/);
  assert.doesNotMatch(
    recorder,
    /new Blob\(chunksRef\.current, \{ type \}\)/,
  );
});

test("onRecorded is invoked exactly once and onError gives staged Arabic messages", () => {
  assert.match(recorder, /if \(completedRef\.current\) return;\s*completedRef\.current = true;/);
  assert.match(recorder, /labels\.noAudio/);
  assert.match(recorder, /labels\.permission/);
  assert.match(
    chats,
    /"تعذر الوصول إلى الميكروفون. تحقق من إذن Safari ثم حاول مجددًا."/,
  );
  assert.match(
    chats,
    /"لم يتم التقاط صوت. أعد التسجيل لمدة أطول."/,
  );
});

test("recorder emits structured diagnostics only in development/preview", () => {
  assert.match(recorder, /\[chat_audio_recorder\]/);
  assert.match(recorder, /isDevelopmentOrPreview\(\)/);
  assert.match(recorder, /stage: "permission"/);
  assert.match(recorder, /stage: "recorder_create"/);
  assert.match(recorder, /stage: "recorder_start"/);
  assert.match(recorder, /stage: "recorder_runtime"/);
  assert.match(recorder, /stage: "recorder_stop"/);
  assert.match(recorder, /stage: "blob_prepare"/);
});

test("chat audio upload keeps ArrayBuffer transport and uses audioBytes.byteLength", () => {
  assert.match(messaging, /\.upload\(path, audioBytes, \{ upsert: false, contentType: mimeType/);
  assert.match(messaging, /sizeBytes: audioBytes\.byteLength/);
  assert.match(messaging, /"video\/mp4": "audio\/mp4"/);
  assert.doesNotMatch(messaging, /conversation-audio"\)\s*\n\s*\.upload\(path, payload\.file,/);
  assert.doesNotMatch(messaging, /new File\(\[audioBytes\]/);
});

test("no unsupported or non-canonical MIME escapes the audio contract", () => {
  assert.match(messaging, /CHAT_AUDIO_MIME_ALIASES/);
  assert.match(messaging, /"video\/mp4": "audio\/mp4"/);
  assert.doesNotMatch(messaging, /"audio\/x-m4a": "audio\/webm"/);
});
