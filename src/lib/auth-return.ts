const blockedReturnPrefixes = ["/auth/callback", "/login", "/reset-password"];

function isBlockedAuthReturnPath(pathname: string) {
  return blockedReturnPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function sanitizeAuthReturnTo(value: unknown, fallback = "/more") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;

  try {
    const origin = typeof window === "undefined" ? "https://rawaj.local" : window.location.origin;
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) return fallback;
    if (isBlockedAuthReturnPath(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function currentAuthReturnTo() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
