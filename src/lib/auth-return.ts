const blockedReturnPrefixes = ["/auth/callback", "/login", "/reset-password"];
const DEFAULT_AUTH_RETURN_TO = "/more";
const MAX_AUTH_RETURN_LENGTH = 2048;

function isBlockedAuthReturnPath(pathname: string): boolean {
  return blockedReturnPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function safeFallback(value: unknown): string {
  if (value === DEFAULT_AUTH_RETURN_TO) return DEFAULT_AUTH_RETURN_TO;
  return sanitizeAuthReturnTo(value, DEFAULT_AUTH_RETURN_TO);
}

export function sanitizeAuthReturnTo(
  value: unknown,
  fallback = DEFAULT_AUTH_RETURN_TO,
): string {
  const normalizedFallback = safeFallback(fallback);
  if (typeof value !== "string") return normalizedFallback;
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > MAX_AUTH_RETURN_LENGTH ||
    containsControlCharacter(trimmed) ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//")
  )
    return normalizedFallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return normalizedFallback;

  try {
    const origin = typeof window === "undefined" ? "https://rawaj.local" : window.location.origin;
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) return normalizedFallback;
    if (isBlockedAuthReturnPath(url.pathname)) return normalizedFallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return normalizedFallback;
  }
}

export function currentAuthReturnTo(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
