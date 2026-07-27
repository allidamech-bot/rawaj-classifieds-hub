import type { SupabaseClient } from "@supabase/supabase-js";

const RECOVERY_SESSION_KEY = "rawaj.password-recovery-session";
const RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000;
const RECOVERY_BRIDGE_GLOBAL_KEY = "__rawajPasswordRecoveryBridgeInstalled";

interface PasswordRecoveryProof {
  userId: string;
  issuedAt: number;
}

type RecoveryBridgeGlobal = typeof globalThis & {
  __rawajPasswordRecoveryBridgeInstalled?: boolean;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function installPasswordRecoverySessionBridge(client: SupabaseClient | null): void {
  if (!client || typeof window === "undefined") return;

  const root = globalThis as RecoveryBridgeGlobal;
  if (root[RECOVERY_BRIDGE_GLOBAL_KEY]) return;
  root[RECOVERY_BRIDGE_GLOBAL_KEY] = true;

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session?.user.id) {
      markPasswordRecoverySession(session.user.id);
      return;
    }
    if (event === "SIGNED_OUT") clearPasswordRecoverySession();
  });
}

export function markPasswordRecoverySession(userId: string, now = Date.now()): void {
  const cleanUserId = userId.trim();
  if (!cleanUserId) return;
  storage()?.setItem(
    RECOVERY_SESSION_KEY,
    JSON.stringify({ userId: cleanUserId, issuedAt: now } satisfies PasswordRecoveryProof),
  );
}

export function hasActivePasswordRecoverySession(
  userId: string | null | undefined,
  now = Date.now(),
): boolean {
  const cleanUserId = userId?.trim() ?? "";
  if (!cleanUserId) return false;

  const value = storage()?.getItem(RECOVERY_SESSION_KEY);
  if (!value) return false;

  try {
    const proof = JSON.parse(value) as Partial<PasswordRecoveryProof>;
    const active =
      proof.userId === cleanUserId &&
      typeof proof.issuedAt === "number" &&
      Number.isFinite(proof.issuedAt) &&
      proof.issuedAt <= now &&
      now - proof.issuedAt <= RECOVERY_SESSION_TTL_MS;
    if (!active) clearPasswordRecoverySession();
    return active;
  } catch {
    clearPasswordRecoverySession();
    return false;
  }
}

export function clearPasswordRecoverySession(): void {
  storage()?.removeItem(RECOVERY_SESSION_KEY);
}
