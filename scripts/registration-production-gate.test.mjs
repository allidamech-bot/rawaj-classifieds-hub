import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [login, callback] = await Promise.all([
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/auth.callback.tsx", import.meta.url), "utf8"),
]);

test("registration uses a first-party confirmation callback", () => {
  assert.match(login, /new URL\("\/auth\/callback", window\.location\.origin\)/);
  assert.match(login, /signupCallbackUrl\.searchParams\.set\("returnTo", returnTo\)/);
  assert.match(login, /emailRedirectTo: signupCallbackUrl\.toString\(\)/);
  assert.match(callback, /sanitizeAuthReturnTo/);
});

test("registration submit is protected against duplicate execution", () => {
  assert.match(login, /const submitInFlightRef = useRef\(false\)/);
  assert.match(login, /if \(submitInFlightRef\.current\) return;/);
  assert.ok((login.match(/submitInFlightRef\.current = true;/g) ?? []).length >= 2);
  assert.ok((login.match(/submitInFlightRef\.current = false;/g) ?? []).length >= 2);
  assert.match(login, /disabled=\{submitting\}/);
});

test("registration releases the action lock after thrown failures", () => {
  assert.match(login, /catch \(error\)[\s\S]*?authErrorMessage/);
  assert.match(
    login,
    /finally \{[\s\S]*?submitInFlightRef\.current = false;[\s\S]*?setSubmitting\(false\);/,
  );
});

test("registration never creates a browser-selected profile identity", () => {
  assert.match(login, /id: user\.id/);
  assert.match(login, /\.eq\("id", user\.id\)/);
  assert.doesNotMatch(login, /userId:\s*clean/);
});
