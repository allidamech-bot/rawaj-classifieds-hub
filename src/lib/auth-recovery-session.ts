const RECOVERY_SESSION_KEY = "rawaj.password-recovery-session";
const RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000;

interface PasswordRecoveryProof {
  userId: string;
  issuedAt: number;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markPasswordRecoverySession(userId: string, now = Date.now()): void {
  const cleanUserId = userId.trim();
  if (!cleanUserId) return;
  const proof: PasswordRecoveryProof = { userId: cleanUserId, issuedAt: now };
  storage()?.setItem(RECOVERY_SESSION_KEY, JSON.stringify(proof));
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
