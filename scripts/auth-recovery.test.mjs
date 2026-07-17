import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [errors, authReturn, recoverySession, login, callback, reset, admin] = await Promise.all([
  readFile(new URL("../src/lib/auth-errors.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth-return.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth-recovery-session.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/auth.callback.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/reset-password.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
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

test("password recovery requires a bounded verified proof instead of any signed-in session", () => {
  assert.match(recoverySession, /RECOVERY_SESSION_TTL_MS = 15 \* 60 \* 1000/);
  assert.match(recoverySession, /window\.sessionStorage/);
  assert.match(callback, /recoveryCodeRequested = Boolean\(code && callbackContext\.isRecovery\)/);
  assert.match(callback, /markPasswordRecoverySession\(\)/);
  assert.match(reset, /hasActivePasswordRecoverySession\(\)/);
  assert.match(reset, /event === "PASSWORD_RECOVERY"/);
  assert.match(reset, /clearPasswordRecoverySession\(\)/);
  assert.doesNotMatch(reset, /event === "SIGNED_IN" \|\| event === "INITIAL_SESSION"/);
});

test("password recovery listener is always released on unmount", () => {
  assert.match(reset, /unsubscribeAuth\?\.\(\)/);
  assert.match(reset, /listener\.subscription\.unsubscribe/);
});

test("admin child workspaces enforce permission before rendering the outlet", () => {
  assert.match(admin, /const requestedTab = tabs\.find/);
  assert.match(admin, /requestedTab && !auth\.hasPermission\(requestedTab\.permission\)/);
  assert.ok(
    admin.indexOf("requestedTab && !auth.hasPermission") < admin.indexOf("<Outlet />"),
  );
  assert.match(admin, /to: "\/admin\/audit"[\s\S]*permission: "canViewAuditLogs"/);
});
