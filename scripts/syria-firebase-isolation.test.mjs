import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const firebase = read("src/lib/firebase.ts");
const auth = read("src/lib/auth.tsx");
const environment = read(".env.example");
const workerBase = read("cloudflare/worker/wrangler.base.jsonc");
const workerRender = read("cloudflare/worker/scripts/render-config.mjs");

test("Syria Web Firebase configuration is environment-owned and fail-closed", () => {
  for (const name of [
    "VITE_SYRIA_FIREBASE_API_KEY",
    "VITE_SYRIA_FIREBASE_AUTH_DOMAIN",
    "VITE_SYRIA_FIREBASE_PROJECT_ID",
    "VITE_SYRIA_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_SYRIA_FIREBASE_APP_ID",
  ]) {
    assert.match(firebase, new RegExp(name));
    assert.match(environment, new RegExp(`^${name}=$`, "m"));
  }
  assert.match(firebase, /firebaseAppName = "rawaj-syria"/);
  assert.match(firebase, /rawaj-syria-auth-pending/);
  assert.match(firebase, /firebaseAuthAvailable/);
  assert.doesNotMatch(firebase, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(firebase, /project-af18fcaf-c46e-4ec5-93a/);
  assert.doesNotMatch(firebase, /165848071823/);
});

test("authentication UI stops safely when Syria Firebase is not configured", () => {
  assert.match(auth, /firebaseAuth, firebaseAuthAvailable/);
  assert.match(auth, /firebaseAuthAvailable \? "loading" : "authUnavailable"/);
  assert.match(auth, /if \(!firebaseAuthAvailable\)/);
  assert.match(auth, /تسجيل الدخول السوري غير مهيأ في بيئة النشر/);
});

test("Worker Firebase verification uses the protected Syria project variable", () => {
  assert.doesNotMatch(workerBase, /FIREBASE_PROJECT_ID/);
  assert.match(workerRender, /SYRIA_FIREBASE_PROJECT_ID/);
  assert.match(workerRender, /FIREBASE_PROJECT_ID: firebaseProjectId/);
  assert.match(workerRender, /rawaj-syria-auth-pending/);
  assert.match(environment, /^SYRIA_FIREBASE_PROJECT_ID=$/m);
});
