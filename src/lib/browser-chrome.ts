/**
 * Keep Safari/PWA chrome consistent with the actual approved route surfaces.
 * These fixed meta colors intentionally mirror the homepage / My Store CSS;
 * CSS variables cannot be used directly in HTML theme-color metadata.
 */
export function resolveBrowserChrome(pathname: string) {
  if (pathname === "/") {
    return { colorScheme: "light", themeColor: "#073836" } as const;
  }
  if (pathname === "/profile/listings" || pathname.startsWith("/seller/")) {
    return { colorScheme: "light", themeColor: "#fcfaf7" } as const;
  }
  return { colorScheme: "dark", themeColor: "#242529" } as const;
}
