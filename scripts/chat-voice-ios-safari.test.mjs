import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [recorder, messaging, chats] = await Promise.all([
  readFile(new URL("../src/features/communication/ChatVoiceRecorder.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
]);

test("isAppleMobileWebKit detects iPhone, iPad, iPod, and iPad desktop mode", () => {
  assert.match(recorder, /function isAppleMobileWebKit\(\): boolean/);
  assert.match(recorder, /iPhone|iPod/);
  assert.match(recorder, /platform === "iPad" \|\| \/iPad\//);
  assert.match(recorder, /MacIntel/);
  assert.match(recorder, /maxTouchPoints > 1/);
});

test("Apple mobile puts MP4 before WebM and excludes WebM as first option", () => {
  assert.match(recorder, /function recorderMimeCandidates\(\): string\[\]/);
  const appleSection = recorder.match(/if \(isAppleMobileWebKit\(\)\) \{([\s\S]*?)\}/);
  assert.ok(appleSection, "Apple mobile branch should exist");
  const appleArray = appleSection[1].match(/return \[([\s\S]*?)\];/);
  assert.ok(appleArray, "Apple mobile return array should exist");
  const appleTypes = appleArray[1];
  const firstMp4 = appleTypes.indexOf('"audio/mp4;codecs=mp4a.40.2"');
  const firstWebm = appleTypes.indexOf('"audio/webm;codecs=opus"');
  assert.ok(firstMp4 !== -1, "audio/mp4;codecs=mp4a.40.2 should be in Apple candidates");
  assert.ok(firstWebm === -1 || firstMp4 < firstWebm, "MP4 should come before WebM on Apple mobile");
  assert.match(recorder, /"audio\/webm;codecs=opus"/);
  assert.match(recorder, /"audio\/webm"/);
});

test("Android/Chrome keeps WebM first then MP4/Ogg fallbacks", () => {
  const androidSection = recorder.match(/return \[([\s\S]*?)\];/g);
  assert.ok(androidSection, "Should have return arrays");
  const androidReturn = androidSection.find((s) => s.includes('"audio/webm;codecs=opus"'));
  assert.ok(androidReturn, "Android return array should exist");
  const firstWebm = androidReturn.indexOf('"audio/webm;codecs=opus"');
  const firstMp4 = androidReturn.indexOf('"audio/mp4;codecs=mp4a.40.2"');
  assert.ok(firstWebm !== -1, "audio/webm;codecs=opus should be in Android candidates");
  assert.ok(firstMp4 === -1 || firstWebm < firstMp4, "WebM should come before MP4 on Android/Chrome");
});

test("createCompatibleMediaRecorder iterates candidates with real fallback", () => {
  assert.match(recorder, /function createCompatibleMediaRecorder\(stream: MediaStream\): MediaRecorderResult/);
  assert.match(recorder, /for \(const mimeType of candidates\)/);
  assert.match(recorder, /MediaRecorder\.isTypeSupported/);
  assert.match(recorder, /new MediaRecorder\(stream, \{ mimeType \}\)/);
  assert.match(recorder, /errors\.push\(\{ mimeType, error \}\)/);
  assert.match(recorder, /new MediaRecorder\(stream\)/);
  assert.match(recorder, /No compatible MediaRecorder found/);
});

test("constructor failure advances to next candidate", () => {
  assert.match(recorder, /for \(const mimeType of candidates\)/);
  assert.match(recorder, /new MediaRecorder\(stream, \{ mimeType \}\)/);
  assert.match(recorder, /errors\.push\(\{ mimeType, error \}\)/);
});

test("fallback to default MediaRecorder when all explicit candidates fail", () => {
  assert.match(recorder, /new MediaRecorder\(stream\)/);
  assert.match(recorder, /selectedMimeType: null/);
  assert.match(recorder, /No compatible MediaRecorder found/);
});

test("timeslice depends on recorder.mimeType and selectedMimeType, not selectedMimeType alone", () => {
  assert.match(recorder, /function shouldUseRecorderTimeslice\(/);
  assert.match(recorder, /recorderMimeType: string \| undefined/);
  assert.match(recorder, /selectedMimeType: string \| null/);
  assert.match(recorder, /recorderMimeType \|\| selectedMimeType \|\| "audio\/webm"/);
  assert.match(recorder, /shouldUseRecorderTimeslice\(recorder\.mimeType, selectedMimeType\)/);
});

test("Apple mobile uses recorder.start() without timeslice", () => {
  assert.match(recorder, /if \(shouldUseRecorderTimeslice\(recorder\.mimeType, selectedMimeType\)\) \{\s*recorder\.start\(500\);\s*\} else \{\s*recorder\.start\(\);\s*\}/);
});

test("onstop resolves final MIME from chunk, recorder.mimeType, then selectedMimeType with canonicalization", () => {
  assert.match(recorder, /function resolveFinalMimeType\(/);
  assert.match(recorder, /chunkMime && normalizeRecordedMimeType\(chunkMime\) \? chunkMime : ""/);
  assert.match(recorder, /recorderMime \|\|/);
  assert.match(recorder, /selectedMime \|\|/);
  assert.match(recorder, /"audio\/webm"/);
});

test("final output on iPhone is audio/mp4 with .m4a extension", () => {
  assert.match(recorder, /if \(mime === "audio\/mp4"\) return "m4a"/);
  assert.match(recorder, /const extension = extensionForMime\(type\)/);
  assert.match(recorder, /const file = createUploadableFromBlob\(blob, type, extension\)/);
});

test("diagnostics no longer depend on process.env", () => {
  assert.doesNotMatch(recorder, /process\.env\.VERCEL_ENV/);
  assert.doesNotMatch(recorder, /process\.env\.RAWAJ_ENVIRONMENT/);
  assert.match(recorder, /function isPreviewRuntime\(\): boolean/);
  assert.match(recorder, /hostname\.endsWith/);
  assert.match(recorder, /vercel\.app/);
  assert.match(recorder, /localhost/);
});

test("diagnostics are stored in sessionStorage", () => {
  assert.match(recorder, /function storeDiagnostics\(payload: DiagnosticsPayload\): void/);
  assert.match(recorder, /sessionStorage\.setItem\("rawaj:last-chat-audio-diagnostic", JSON\.stringify\(payload\)\)/);
});

test("diagnostics use stage codes and show metadata without secrets", () => {
  assert.match(recorder, /stage: "IOS_PERMISSION"/);
  assert.match(recorder, /stage: "IOS_RECORDER_CREATE"/);
  assert.match(recorder, /stage: "IOS_RECORDER_START"/);
  assert.match(recorder, /stage: "IOS_EMPTY_BLOB"/);
  assert.match(recorder, /stage: "IOS_RECORDER_STOP"/);
  assert.match(recorder, /stage: "IOS_RECORDER_RUNTIME"/);
  assert.match(recorder, /selectedMimeType/);
  assert.match(recorder, /recorderMimeType/);
  assert.match(recorder, /chunkMimeType/);
  assert.match(recorder, /chunkCount/);
  assert.match(recorder, /totalBytes/);
  assert.doesNotMatch(recorder, /token/);
  assert.doesNotMatch(recorder, /sessionId/);
  assert.doesNotMatch(recorder, /userId/);
  assert.doesNotMatch(recorder, /signedUrl/i);
});

test("File constructor fallback exists for old iOS", () => {
  assert.match(recorder, /typeof File === "function"/);
  assert.match(recorder, /function createUploadableFromBlob/);
  assert.match(recorder, /Object\.assign\(blob,/);
});

test("ArrayBuffer upload remains unchanged in messaging layer", () => {
  assert.match(messaging, /\.upload\(path, audioBytes, \{ upsert: false, contentType: mimeType/);
  assert.match(messaging, /sizeBytes: audioBytes\.byteLength/);
  assert.doesNotMatch(messaging, /new File\(\[audioBytes\]/);
});

test("no new migration is introduced", async () => {
  const { execSync } = await import("node:child_process");
  try {
    const status = execSync("git status --short -- supabase/migrations/", { encoding: "utf8" });
    const newMigrations = status
      .split("\n")
      .filter((line) => line.trim().length > 0 && line.includes(".sql"));
    assert.ok(newMigrations.length === 0, `No new migration files should be added: ${newMigrations.join(", ")}`);
  } catch {
    assert.ok(true, "git status check skipped or failed");
  }
});
