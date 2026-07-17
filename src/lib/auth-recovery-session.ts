const RECOVERY_SESSION_KEY = "rawaj.password-recovery-session";
const RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markPasswordRecoverySession(now = Date.now()): void {
  storage()?.setItem(RECOVERY_SESSION_KEY, String(now));
}

export function hasActivePasswordRecoverySession(now = Date.now()): boolean {
  const value = storage()?.getItem(RECOVERY_SESSION_KEY);
  if (!value) return false;

  const issuedAt = Number(value);
  const active =
    Number.isFinite(issuedAt) && issuedAt <= now && now - issuedAt <= RECOVERY_SESSION_TTL_MS;
  if (!active) clearPasswordRecoverySession();
  return active;
}

export function clearPasswordRecoverySession(): void {
  storage()?.removeItem(RECOVERY_SESSION_KEY);
}
