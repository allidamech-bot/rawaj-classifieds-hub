export type PrimaryNavigationSection =
  "home" | "categories" | "addListing" | "offers" | "account" | "none";

const ACCOUNT_PATHS = [
  "/more",
  "/profile",
  "/notifications",
  "/verification",
  "/saved-searches",
  "/favorites",
  "/chats",
  "/support",
  "/safety",
  "/privacy",
  "/terms",
] as const;

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function resolvePrimaryNavigationSection(pathname: string): PrimaryNavigationSection {
  if (pathname === "/") return "home";
  if (matchesPath(pathname, "/categories")) return "categories";
  if (matchesPath(pathname, "/add-listing")) return "addListing";
  if (matchesPath(pathname, "/offers") || matchesPath(pathname, "/promotion")) return "offers";
  if (ACCOUNT_PATHS.some((path) => matchesPath(pathname, path))) return "account";

  return "none";
}

export function shouldShowSiteFooter(pathname: string) {
  const hiddenPaths = [
    "/add-listing",
    "/chats",
    "/verification",
    "/login",
    "/auth/callback",
    "/reset-password",
    "/admin",
  ] as const;

  if (hiddenPaths.some((path) => matchesPath(pathname, path))) return false;

  // Listing management is a focused workflow even though it lives under the profile URL space.
  if (/^\/profile\/listings\/[^/]+$/.test(pathname)) return false;

  return true;
}

export function shouldShowBottomNav(pathname: string) {
  const hiddenPaths = [
    "/add-listing",
    "/chats",
    "/verification",
    "/login",
    "/auth/callback",
    "/reset-password",
    "/admin",
  ] as const;

  if (hiddenPaths.some((path) => matchesPath(pathname, path))) return false;

  if (/^\/profile\/listings\/[^/]+$/.test(pathname)) return false;

  return true;
}
