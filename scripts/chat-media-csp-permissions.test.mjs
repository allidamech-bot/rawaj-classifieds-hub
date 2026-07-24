import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [server, attachment, chats] = await Promise.all([
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/ChatVoiceAttachment.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
]);

test("CSP exposes an explicit media-src that allows self, blob, and Supabase audio", () => {
  assert.match(
    server,
    /"media-src 'self' blob: https:\/\/\*\.supabase\.co https:\/\/\*\.supabase\.com"/,
  );
  assert.match(server, /'self' blob: https:\/\/\*\.supabase\.co https:\/\/\*\.supabase\.com/);
  assert.match(server, /media-src[^;]*blob:/);
  assert.match(server, /media-src[^;]*https:\/\/\*\.supabase\.co/);
  assert.match(server, /media-src[^;]*https:\/\/\*\.supabase\.com/);
});

test("audio playback does not rely on default-src", () => {
  assert.match(server, /"default-src 'self'"/);
  const mediaIndex = server.indexOf("media-src");
  const defaultIndex = server.indexOf("default-src");
  assert.ok(mediaIndex > defaultIndex, "media-src must be declared explicitly after default-src");
});

test("permissions-policy allows geolocation, microphone, and camera for same-origin only", () => {
  assert.match(
    server,
    /"permissions-policy", "geolocation=\(self\), microphone=\(self\), camera=\(self\)"/,
  );
  assert.match(server, /geolocation=\(self\)/);
  assert.match(server, /microphone=\(self\)/);
  assert.match(server, /camera=\(self\)/);
});

test("no disabled or wildcard permissions/CSP values are introduced", () => {
  assert.doesNotMatch(server, /geolocation=\(\)/);
  assert.doesNotMatch(server, /microphone=\(\)/);
  assert.doesNotMatch(server, /camera=\(\)/);
  assert.doesNotMatch(server, /script-src \*/);
  assert.doesNotMatch(server, /media-src \*/);
  assert.doesNotMatch(server, /default-src \*/);
  assert.doesNotMatch(server, /unsafe-eval/);
});

test("Vercel Preview tooling is not opened inside Production CSP", () => {
  assert.match(server, /isVercelPreviewBuild\(\)/);
  assert.match(
    server,
    /rawajBuildInfo\.provider === "vercel" && rawajBuildInfo\.environment === "preview"/,
  );
  assert.match(server, /allowVercelPreviewTools\s*\?/);
  assert.match(server, /: "script-src 'self' 'unsafe-inline' https:\/\/va\.vercel-scripts\.com"/);
  assert.match(server, /: "manifest-src 'self'"/);
});

test("voice playback keeps a single private-download Blob and revokes it once on unmount", () => {
  assert.match(attachment, /ownedObjectUrlRef/);
  assert.match(attachment, /URL\.revokeObjectURL\(ownedObjectUrlRef\.current\)/);
  assert.match(
    attachment,
    /useEffect\(\(\) => \{[\s\S]{0,120}releaseOwnedUrl\(\);[\s\S]{0,80}\}, \[releaseOwnedUrl\]\)/,
  );
  assert.match(attachment, /loadingRef/);
});

test("voice playback failure shows a clear Arabic message without hiding the error", () => {
  assert.match(chats, /"تعذر تشغيل التسجيل الصوتي. أعد تحميله أو حاول مرة أخرى."/);
  assert.match(attachment, /onError=\{\(\) => void handleError\(\)\}/);
});
