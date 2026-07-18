import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [messaging, recorder] = await Promise.all([
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/communication/ChatVoiceRecorder.tsx", import.meta.url), "utf8"),
]);

test("chat audio MIME aliases canonicalize Android WebView quirks", () => {
  assert.match(messaging, /CHAT_AUDIO_MIME_ALIASES/);
  assert.match(messaging, /"video\/webm": "audio\/webm"/);
  assert.match(messaging, /"audio\/m4a": "audio\/mp4"/);
  assert.match(messaging, /"audio\/x-m4a": "audio\/mp4"/);
  assert.match(messaging, /"audio\/mp3": "audio\/mpeg"/);
  assert.match(messaging, /"audio\/ogg": "audio\/ogg"/);
});

test("chat audio validation keeps the canonical list and adds an operation code", () => {
  assert.match(
    messaging,
    /operation: "chat_audio_validation"/,
  );
  for (const type of ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]) {
    assert.match(messaging, new RegExp(`"${type}"`));
  }
});

test("chat audio upload canonicalizes MIME/extension and keeps the ArrayBuffer transport", () => {
  assert.match(messaging, /normalizeChatAudioFileName/);
  assert.match(messaging, /extensionForChatAudioMime/);
  assert.match(messaging, /payload\.file\.arrayBuffer\(\)/);
  assert.match(messaging, /\.upload\(path, audioBytes, \{ upsert: false, contentType: mimeType/);
  assert.match(messaging, /operation: "chat_audio_recorder"/);
  assert.match(messaging, /operation: "chat_audio_prepare"/);
  assert.match(messaging, /operation: "chat_audio_upload"/);
});

test("recorder supports candidate MIME list with safe fallback and error handling", () => {
  assert.match(recorder, /RECORDER_MIME_CANDIDATES/);
  assert.match(recorder, /audio\/webm;codecs=opus/);
  assert.match(recorder, /audio\/mp4;codecs=mp4a\.40\.2/);
  assert.match(recorder, /audio\/mp4/);
  assert.match(recorder, /audio\/webm/);
  assert.match(recorder, /audio\/ogg;codecs=opus/);
  assert.match(recorder, /audio\/ogg/);
});

test("recorder normalizes Android aliases, guards stop, and exposes onerror", () => {
  assert.match(recorder, /if \(base === "video\/webm"\) return "audio\/webm"/);
  assert.match(recorder, /if \(base === "audio\/m4a" \|\| base === "audio\/x-m4a"\) return "audio\/mp4"/);
  assert.match(recorder, /if \(base === "audio\/mp3"\) return "audio\/mpeg"/);
  assert.match(recorder, /recorder\.onerror = /);
  assert.match(recorder, /recorder\.state === "recording"\) recorder\.stop\(\)/);
  assert.match(recorder, /stopMicrophone\(\)/);
});
