import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, navigation, shell, header, dock, primitives, css] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/primary-navigation.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/AppShell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/BottomDock.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/spatial-primitives.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/spatial-app-shell.css", import.meta.url), "utf8"),
]);

test("root renders every route through the Spatial App Shell", () => {
  assert.match(root, /import \{ AppShell \} from "@\/components\/shell\/AppShell";/);
  assert.match(root, /<AppShell[\s\S]*?<Outlet \/>[\s\S]*?<\/AppShell>/);
  assert.match(root, /import spatialAppShellCss from "\.\.\/spatial-app-shell\.css\?url";/);

  const designSystemIndex = root.indexOf("href: designSystemV2Css");
  const spatialShellIndex = root.indexOf("href: spatialAppShellCss");
  const homeMarketplaceIndex = root.indexOf("href: homeMarketplaceV2Css");

  assert.ok(designSystemIndex >= 0);
  assert.ok(spatialShellIndex > designSystemIndex);
  assert.ok(homeMarketplaceIndex > spatialShellIndex);
});

test("route policy exposes explicit shell modes and centralized visibility", () => {
  for (const mode of [
    "standard",
    "stickyAction",
    "noDock",
    "conversation",
    "mediaViewer",
    "auth",
    "listingStudio",
  ]) {
    assert.match(navigation, new RegExp(`mode: "${mode}"`));
  }

  assert.match(navigation, /shouldShowSiteFooter[\s\S]*resolveAppShellConfig/);
  assert.match(navigation, /shouldShowBottomNav[\s\S]*resolveAppShellConfig/);
  assert.match(navigation, /if \(matchesPath\(pathname, "\/chats"\)\) return "chats";/);
});

test("shell centralizes keyboard, safe regions, and reserved action space", () => {
  assert.match(shell, /window\.visualViewport/);
  assert.match(shell, /--keyboard-inset/);
  assert.match(shell, /data-shell-region="page-canvas"/);
  assert.match(shell, /data-shell-region="page-content"/);
  assert.match(shell, /data-shell-region="floating-layer"/);
  assert.match(shell, /data-shell-region="sticky-action-region"/);
  assert.match(shell, /data-shell-region="modal-sheet-region"/);
  assert.match(shell, /<BottomDock pathname=\{pathname\} \/>/);
});

test("floating navigation includes location, chats, and independent unread badges", () => {
  assert.match(header, /rawaj-floating-header-shell/);
  assert.match(header, /MapPin/);
  assert.match(header, /كل سوريا/);
  assert.match(dock, /to: "\/chats"/);
  assert.match(dock, /counts\.messages/);
  assert.match(dock, /counts\.notifications/);
  assert.doesNotMatch(dock, /section: "offers"/);
});

test("shared Spatial primitives remain page agnostic", () => {
  for (const primitive of [
    "PageContainer",
    "PageTransition",
    "SpatialCard",
    "GlassAction",
    "StickyActionBar",
    "SectionHeader",
    "HorizontalRail",
    "EmptyState",
    "LoadingSkeleton",
    "NotificationBadge",
    "BottomSheetContent",
  ]) {
    assert.match(primitives, new RegExp(`(?:const|function) ${primitive}`));
  }
});

test("Spatial CSS defines depth, safe-area, dock, and reduced-motion contracts", () => {
  for (const token of [
    "--depth-page",
    "--depth-surface",
    "--depth-card",
    "--depth-floating",
    "--depth-sheet",
    "--depth-navigation",
    "--safe-top",
    "--safe-bottom",
    "--keyboard-inset",
    "--dock-height",
    "--header-height",
    "--sticky-action-height",
  ]) {
    assert.match(css, new RegExp(token));
  }

  assert.match(css, /html\[data-keyboard-open="true"\] \.rawaj-mobile-dock/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.rawaj-app-shell\[data-shell-dock="true"\]/);
});
