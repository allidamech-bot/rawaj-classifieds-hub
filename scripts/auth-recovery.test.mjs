import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [errors, authReturn, login, callback, reset] = await Promise.all([
  readFile(new URL("../src/lib/auth-errors.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth-return.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/auth.callback.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/reset-password.tsx", import.meta.url), "utf8"),
]);

test("account failures are translated into safe bilingual messages", () => {
  assert.match(errors, /over_email_send_rate_limit/);
  assert.match(errors, /invalid_credentials/);
  assert.match(errors, /user_already_exists/);
  assert.match(errors, /weak_password/);
  assert.match(errors, /otp_expired/);
  assert.match(login, /authErrorMessage\(resetError, "recovery", text\)/);
  assert.match(
    login,
    /authErrorMessage\(result\.error, mode === "login" \? "login" : "register", text\)/,
  );
  assert.doesNotMatch(login, /: result\.error\.message/);
});

test("authentication return destinations reject unsafe fallback and oversized input", () => {
  assert.match(authReturn, /DEFAULT_AUTH_RETURN_TO/);
  assert.match(authReturn, /MAX_AUTH_RETURN_LENGTH = 2048/);
  assert.match(authReturn, /containsControlCharacter/);
  assert.match(authReturn, /const normalizedFallback = safeFallback\(fallback\)/);
  assert.match(authReturn, /trimmed\.length > MAX_AUTH_RETURN_LENGTH/);
  assert.doesNotMatch(authReturn, /typeof value !== "string"\) return fallback/);
});

test("expired recovery links reopen the forgot-password form directly", () => {
  assert.match(login, /looseSearch\.mode === "forgot" \? "forgot" : "login"/);
  assert.match(callback, /\/login\?mode=forgot&returnTo=/);
  assert.match(reset, /\/login\?mode=forgot&returnTo=/);
});

test("authentication callback derives recovery context from router search", () => {
  assert.match(callback, /useRouterState/);
  assert.match(callback, /looseSearch\.type === "recovery"/);
  assert.doesNotMatch(callback, /typeof window === "undefined"/);
  assert.doesNotMatch(callback, /useMemo/);
});

test("password recovery listener is always released on unmount", () => {
  assert.match(reset, /unsubscribeAuth\?\.\(\)/);
  assert.match(reset, /listener\.subscription\.unsubscribe/);
});
