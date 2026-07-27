#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const authPath = path.join(root, "src/lib/auth.tsx");
let auth = await readFile(authPath, "utf8");

if (!auth.includes('import { Capacitor } from "@capacitor/core";')) {
  auth = auth.replace(
    'import type { Session } from "@supabase/supabase-js";',
    'import { Capacitor } from "@capacitor/core";\nimport type { Session } from "@supabase/supabase-js";',
  );
}

const normalizeBlock = `function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}`;
const callbackBlock = `${normalizeBlock}

function buildOAuthCallbackUrl(returnTo: string | undefined): string {
  const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
  const callbackUrl = Capacitor.isNativePlatform()
    ? new URL("com.rawaj.marketplace://auth/callback")
    : new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("returnTo", safeReturnTo);
  return callbackUrl.toString();
}`;
if (!auth.includes("function buildOAuthCallbackUrl")) {
  if (!auth.includes(normalizeBlock)) throw new Error("normalizeAuthEmail block not found");
  auth = auth.replace(normalizeBlock, callbackBlock);
}

const oldGoogleBlock = `        const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("returnTo", safeReturnTo);
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callbackUrl.toString() },
        });`;
const newGoogleBlock = `        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: buildOAuthCallbackUrl(returnTo) },
        });`;
if (!auth.includes(newGoogleBlock)) {
  if (!auth.includes(oldGoogleBlock)) throw new Error("Google OAuth block not found");
  auth = auth.replace(oldGoogleBlock, newGoogleBlock);
}
await writeFile(authPath, auth, "utf8");

const testPath = path.join(root, "scripts/android-deep-link-oauth-readiness.test.mjs");
await writeFile(
  testPath,
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, activity, strings, auth] = await Promise.all([
  readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../android/app/src/main/java/com/rawaj/marketplace/MainActivity.java",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../android/app/src/main/res/values/strings.xml", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
]);

test("Android App Links remain verified and scoped to RAWAJ", () => {
  assert.match(manifest, /<intent-filter android:autoVerify="true">/);
  assert.match(manifest, /android:scheme="https" android:host="rawa-j\\.com"/);
  assert.doesNotMatch(manifest, /android:host="\\*"/);
});

test("native OAuth custom scheme remains package-owned", () => {
  assert.match(strings, /<string name="custom_url_scheme">com\\.rawaj\\.marketplace<\\/string>/);
  assert.match(manifest, /android:scheme="@string\\/custom_url_scheme"/);
});

test("incoming Android intents remain restricted to RAWAJ-owned targets", () => {
  assert.match(activity, /TRUSTED_WEB_HOST = "rawa-j\\.com"/);
  assert.match(activity, /OAUTH_CALLBACK_PATH = "\\/auth\\/callback"/);
  assert.match(activity, /TRUSTED_WEB_HOST\\.equalsIgnoreCase\\(host\\)/);
  assert.match(activity, /getString\\(R\\.string\\.custom_url_scheme\\)\\.equalsIgnoreCase\\(scheme\\)/);
  assert.match(activity, /if \\(!OAUTH_CALLBACK_PATH\\.equals\\(customPath\\)\\)/);
  assert.match(activity, /bridge\\.getWebView\\(\\)\\.loadUrl\\(trustedTarget\\.toString\\(\\)\\)/);
});

test("Supabase Google OAuth uses native custom scheme and sanitized web fallback", () => {
  assert.match(auth, /import \\{ Capacitor \\} from "@capacitor\\/core"/);
  assert.match(auth, /Capacitor\\.isNativePlatform\\(\\)/);
  assert.match(auth, /new URL\\("com\\.rawaj\\.marketplace:\\/\\/auth\\/callback"\\)/);
  assert.match(auth, /new URL\\("\\/auth\\/callback", window\\.location\\.origin\\)/);
  assert.match(auth, /sanitizeAuthReturnTo\\(returnTo, "\\/more"\\)/);
  assert.match(auth, /client\\.auth\\.signInWithOAuth\\(\\{/);
  assert.match(auth, /provider: "google"/);
  assert.match(auth, /redirectTo: buildOAuthCallbackUrl\\(returnTo\\)/);
  assert.doesNotMatch(auth, /firebase|signInWithPopup|GoogleAuthProvider/i);
});
`,
  "utf8",
);

console.log("Supabase native OAuth callback and Android contract updated.");