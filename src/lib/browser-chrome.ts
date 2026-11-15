/**
 * Keep Safari/PWA chrome consistent with the actual approved route surfaces.
 * These fixed meta colors intentionally mirror the approved route CSS;
 * CSS variables cannot be used directly in HTML theme-color metadata.
 */
export function resolveBrowserChrome(pathname: string) {
  if (pathname === "/") {
    return { colorScheme: "light", themeColor: "#073836" } as const;
  }
  if (
    pathname === "/categories" ||
    pathname === "/listings" ||
    pathname === "/offers" ||
    /^\/listings\/[^/]+$/.test(pathname)
  ) {
    return { colorScheme: "light", themeColor: "#073836" } as const;
  }
  if (
    [
      "/support",
      "/safety",
      "/terms",
      "/privacy",
      "/prohibited",
      "/verification",
      "/promotion",
    ].includes(pathname)
  ) {
    return { colorScheme: "light", themeColor: "#073836" } as const;
  }
  if (pathname === "/add-listing" || /^\/profile\/listings\/[^/]+$/.test(pathname)) {
    return { colorScheme: "light", themeColor: "#073836" } as const;
  }
  if (
    pathname === "/more" ||
    pathname === "/profile" ||
    pathname === "/favorites" ||
    pathname === "/saved-searches"
  ) {
    return { colorScheme: "light", themeColor: "#f9f0e4" } as const;
  }
  // B3.2 communication workspaces use the petrol header over a light canvas.
  // Safari chrome must not fall back to the retired charcoal route theme.
  if (["/activity", "/notifications", "/chats"].includes(pathname)) {
    return { colorScheme: "light", themeColor: "#073836" } as const;
  }
  if (pathname === "/profile/listings" || pathname.startsWith("/seller/")) {
    return { colorScheme: "light", themeColor: "#fcfaf7" } as const;
  }
  return { colorScheme: "dark", themeColor: "#242529" } as const;
}
