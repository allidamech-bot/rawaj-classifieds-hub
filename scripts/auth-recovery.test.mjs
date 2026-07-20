import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [errors, authReturn, recoverySession, supabaseClient, login, callback, reset, admin] =
  await Promise.all([
    readFile(new URL("../src/lib/auth-errors.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/auth-return.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/auth-recovery-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8"),
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

test("password recovery events are captured immediately after creating the auth client", () => {
  assert.match(recoverySession, /export function installPasswordRecoverySessionBridge/);
  assert.match(recoverySession, /RECOVERY_BRIDGE_GLOBAL_KEY/);
  assert.match(recoverySession, /if \(root\[RECOVERY_BRIDGE_GLOBAL_KEY\]\) return/);
  assert.match(recoverySession, /root\[RECOVERY_BRIDGE_GLOBAL_KEY\] = true/);
  assert.match(recoverySession, /client\.auth\.onAuthStateChange/);
  assert.match(recoverySession, /event === "PASSWORD_RECOVERY" && session\?\.user\.id/);
  assert.match(recoverySession, /markPasswordRecoverySession\(session\.user\.id\)/);
  assert.match(recoverySession, /event === "SIGNED_OUT"/);
  assert.match(recoverySession, /clearPasswordRecoverySession\(\)/);

  assert.match(
    supabaseClient,
    /import \{ installPasswordRecoverySessionBridge \} from "@\/lib\/auth-recovery-session"/,
  );
  assert.match(
    supabaseClient,
    /const authenticatedSupabase:[\s\S]*createClient[\s\S]*installPasswordRecoverySessionBridge\(authenticatedSupabase\);[\s\S]*export const supabase/,
  );
});

test("password recovery requires bounded account-bound proof instead of any signed-in session", () => {
  assert.match(recoverySession, /RECOVERY_SESSION_TTL_MS = 15 \* 60 \* 1000/);
  assert.match(recoverySession, /interface PasswordRecoveryProof/);
  assert.match(recoverySession, /userId: cleanUserId/);
  assert.match(recoverySession, /JSON\.stringify\(proof\)/);
  assert.match(recoverySession, /proof\.userId === cleanUserId/);
  assert.match(recoverySession, /window\.sessionStorage/);

  assert.match(callback, /recoveryCodeRequested = Boolean\(code && callbackContext\.isRecovery\)/);
  assert.match(callback, /hashParams\.get\("type"\) === "recovery"/);
  assert.match(callback, /session\.access_token === recoveryHashAccessToken/);
  assert.match(callback, /event === "PASSWORD_RECOVERY"/);
  assert.match(callback, /markPasswordRecoverySession\(session\.user\.id\)/);
  assert.match(callback, /hasActivePasswordRecoverySession\(session\.user\.id\)/);
  assert.match(callback, /function hasRecoveryProof/);
  assert.match(callback, /hasRecoveryProof\(data\.session\)/);
  assert.match(callback, /hasRecoveryProof\(lateSession\.session\)/);
  assert.doesNotMatch(callback, /finish\(callbackContext\.isRecovery/);
  assert.doesNotMatch(callback, /data\.session\) \{\s*finish\(callbackContext\.isRecovery/);

  assert.match(reset, /recoveryUserId/);
  assert.match(reset, /hasActivePasswordRecoverySession\(session\.user\.id\)/);
  assert.match(reset, /markPasswordRecoverySession\(session\.user\.id\)/);
  assert.match(reset, /currentUserId !== recoveryUserId/);
  assert.match(reset, /hasActivePasswordRecoverySession\(currentUserId\)/);
  assert.match(reset, /clearPasswordRecoverySession\(\)/);
  assert.doesNotMatch(reset, /hasActivePasswordRecoverySession\(\)/);
  assert.doesNotMatch(reset, /event === "SIGNED_IN" \|\| event === "INITIAL_SESSION"/);
});

test("route-scoped password recovery listeners are released on unmount", () => {
  assert.match(callback, /unsubscribeAuth\?\.\(\)/);
  assert.match(reset, /unsubscribeAuth\?\.\(\)/);
  assert.match(reset, /listener\.subscription\.unsubscribe/);
});

test("admin child workspaces enforce permission before rendering the outlet", () => {
  assert.match(admin, /const requestedTab = tabs\.find/);
  assert.match(admin, /requestedTab && !auth\.hasPermission\(requestedTab\.permission\)/);
  assert.ok(admin.indexOf("requestedTab && !auth.hasPermission") < admin.indexOf("<Outlet />"));
  assert.match(admin, /to: "\/admin\/audit"[\s\S]*permission: "canViewAuditLogs"/);
});
