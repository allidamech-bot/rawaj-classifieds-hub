import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [login, resetPassword] = await Promise.all([
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/reset-password.tsx", import.meta.url), "utf8"),
]);

test("email and Google authentication actions reject duplicate submissions", () => {
  assert.match(login, /const signInInFlightRef = useRef\(false\);/);
  assert.match(login, /if \(signInInFlightRef\.current\) return;/);
  assert.match(login, /signInInFlightRef\.current = true;/);
  assert.match(login, /finally \{[\s\S]*?signInInFlightRef\.current = false;[\s\S]*?setLoading\(false\);/);

  assert.match(login, /const submitInFlightRef = useRef\(false\);/);
  assert.match(login, /if \(submitInFlightRef\.current\) return;/);
  assert.ok((login.match(/submitInFlightRef\.current = true;/g) ?? []).length >= 2);
  assert.ok((login.match(/submitInFlightRef\.current = false;/g) ?? []).length >= 2);
});

test("authentication actions release loading state after thrown failures", () => {
  assert.match(login, /catch \(error\)[\s\S]*?authErrorMessage/);
  assert.ok((login.match(/finally \{/g) ?? []).length >= 3);
  assert.match(login, /await navigate\(\{ to: returnTo \}\);/);
  assert.doesNotMatch(login, /setSubmitting\(false\);\n\s*if \(result\.error\)/);
});

test("login and registration apply explicit validation before requests", () => {
  assert.match(login, /if \(!cleanEmail\)/);
  assert.match(login, /if \(password\.length < 6\)/);
  assert.match(login, /mode === "register" && cleanName\.length < 2/);
  assert.match(login, /sanitizeAuthReturnTo/);
});

test("password reset is single-flight and cleans delayed navigation", () => {
  assert.match(resetPassword, /const saveInFlightRef = useRef\(false\);/);
  assert.match(resetPassword, /if \(saveInFlightRef\.current\) return;/);
  assert.match(resetPassword, /saveInFlightRef\.current = true;/);
  assert.match(
    resetPassword,
    /finally \{[\s\S]*?saveInFlightRef\.current = false;[\s\S]*?setSaving\(false\);/,
  );
  assert.match(resetPassword, /const navigationTimerRef = useRef/);
  assert.match(resetPassword, /clearTimeout\(navigationTimerRef\.current\)/);
  assert.match(resetPassword, /aria-busy=\{saving\}/);
  assert.ok((resetPassword.match(/disabled=\{saving\}/g) ?? []).length >= 3);
});
