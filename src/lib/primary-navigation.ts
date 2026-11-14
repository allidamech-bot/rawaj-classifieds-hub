export type PrimaryNavigationSection =
  "home" | "categories" | "addListing" | "chats" | "offers" | "account" | "none";

export type AppShellMode =
  | "standard"
  | "immersive"
  | "fullScreen"
  | "stickyAction"
  | "noDock"
  | "noHeader"
  | "conversation"
  | "mediaViewer"
  | "auth"
  | "listingStudio";

export interface AppShellConfig {
  mode: AppShellMode;
  showDock: boolean;
  showFooter: boolean;
  showHeader: boolean;
  reserveStickyAction: boolean;
}

const ACCOUNT_PATHS = [
  "/more",
  "/profile",
  "/activity",
  "/notifications",
  "/verification",
  "/saved-searches",
  "/favorites",
  "/support",
  "/safety",
  "/privacy",
  "/terms",
  "/prohibited",
] as const;

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isListingDetailPath(pathname: string) {
  return /^\/listings\/[^/]+$/.test(pathname);
}

function isListingMediaPath(pathname: string) {
  return /^\/listings\/[^/]+\/media(?:\/|$)/.test(pathname);
}

function isListingManagementPath(pathname: string) {
  return /^\/profile\/listings\/[^/]+$/.test(pathname);
}

function isConversationPath(pathname: string) {
  return /^\/chats\/[^/]+$/.test(pathname);
}

export function resolvePrimaryNavigationSection(pathname: string): PrimaryNavigationSection {
  if (pathname === "/") return "home";
  if (
    matchesPath(pathname, "/categories") ||
    matchesPath(pathname, "/category") ||
    matchesPath(pathname, "/listings") ||
    matchesPath(pathname, "/seller")
  ) {
    return "categories";
  }
  if (matchesPath(pathname, "/add-listing")) return "addListing";
  if (matchesPath(pathname, "/chats")) return "chats";
  if (matchesPath(pathname, "/offers") || matchesPath(pathname, "/promotion")) return "offers";
  if (ACCOUNT_PATHS.some((path) => matchesPath(pathname, path))) return "account";

  return "none";
}

export function resolveAppShellConfig(pathname: string): AppShellConfig {
  if (isListingMediaPath(pathname)) {
    return {
      mode: "mediaViewer",
      showDock: false,
      showFooter: false,
      showHeader: false,
      reserveStickyAction: false,
    };
  }

  if (
    matchesPath(pathname, "/login") ||
    matchesPath(pathname, "/reset-password") ||
    matchesPath(pathname, "/auth/callback")
  ) {
    return {
      mode: "auth",
      showDock: false,
      showFooter: false,
      showHeader: false,
      reserveStickyAction: false,
    };
  }

  if (matchesPath(pathname, "/add-listing") || isListingManagementPath(pathname)) {
    return {
      mode: "listingStudio",
      showDock: false,
      showFooter: false,
      showHeader: false,
      reserveStickyAction: true,
    };
  }

  if (isConversationPath(pathname)) {
    return {
      mode: "conversation",
      showDock: false,
      showFooter: false,
      showHeader: false,
      reserveStickyAction: true,
    };
  }

  if (isListingDetailPath(pathname)) {
    return {
      mode: "stickyAction",
      showDock: false,
      showFooter: true,
      showHeader: true,
      reserveStickyAction: true,
    };
  }

  if (matchesPath(pathname, "/admin")) {
    return {
      mode: "noDock",
      showDock: false,
      showFooter: false,
      showHeader: true,
      reserveStickyAction: false,
    };
  }

  if (matchesPath(pathname, "/verification")) {
    return {
      mode: "noDock",
      showDock: false,
      showFooter: false,
      showHeader: true,
      reserveStickyAction: false,
    };
  }

  return {
    mode: "standard",
    showDock: true,
    showFooter: pathname !== "/chats" && pathname !== "/chats/",
    showHeader: true,
    reserveStickyAction: false,
  };
}

export function shouldShowSiteFooter(pathname: string) {
  return resolveAppShellConfig(pathname).showFooter;
}

export function shouldShowBottomNav(pathname: string) {
  return resolveAppShellConfig(pathname).showDock;
}
