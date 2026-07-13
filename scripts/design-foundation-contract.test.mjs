import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootRoute = await readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/design-foundation.css", import.meta.url), "utf8");
const appShell = await readFile(
  new URL("../src/components/shell/AppShell.tsx", import.meta.url),
  "utf8",
);

test("canonical design foundation is loaded after legacy visual layers", () => {
  const foundationLink = rootRoute.indexOf('{ rel: "stylesheet", href: designFoundationCss }');
  const finalLegacyLink = rootRoute.indexOf(
    '{ rel: "stylesheet", href: launchReadinessVisualPolishCss }',
  );

  assert.notEqual(foundationLink, -1, "design foundation stylesheet must be linked");
  assert.ok(
    foundationLink > finalLegacyLink,
    "canonical tokens must load after legacy visual layers during migration",
  );
});

test("canonical design foundation exposes required semantic contracts", () => {
  const requiredTokens = [
    "--rawaj-page-background",
    "--rawaj-card-background",
    "--rawaj-primary",
    "--rawaj-primary-deep",
    "--rawaj-accent-orange",
    "--rawaj-accent-gold",
    "--rawaj-text-primary",
    "--rawaj-text-secondary",
    "--rawaj-border",
    "--rawaj-muted-surface",
    "--rawaj-success",
    "--rawaj-warning",
    "--rawaj-danger",
    "--rawaj-touch-target",
    "--rawaj-orange",
    "--rawaj-surface-card",
    "--rawaj-surface-sage",
    "--shadow-card",
    "--app-viewport-height",
    "--rawaj-shell-bottom-reserve",
  ];

  for (const token of requiredTokens) {
    assert.match(foundation, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
  }

  assert.match(foundation, /min-height:\s*100dvh/);
  assert.match(foundation, /env\(safe-area-inset-bottom/);
  assert.match(foundation, /prefers-reduced-motion/);
});

test("legacy mobile UI is normalized to readable text and touch targets", () => {
  assert.match(foundation, /rawaj-bottom-dock__label/);
  assert.match(foundation, /rawaj-search-toolbar__recent/);
  assert.match(foundation, /font-size:\s*max\(0\.75rem,\s*11px\)/);
  assert.match(foundation, /min-width:\s*var\(--rawaj-touch-target\)/);
  assert.match(foundation, /min-height:\s*var\(--rawaj-touch-target\)/);
});

test("app shell owns viewport, keyboard and bottom-reservation behavior", () => {
  assert.match(appShell, /--app-viewport-height/);
  assert.match(appShell, /orientationchange/);
  assert.match(appShell, /data-shell-dock=\{config\.showDock\}/);
  assert.match(appShell, /data-shell-sticky-action=\{config\.reserveStickyAction\}/);
  assert.match(appShell, /data-keyboard-open=\{keyboardOpen\}/);
  assert.match(appShell, /<main className="rawaj-app-shell__content"/);

  assert.match(foundation, /data-shell-dock="true"/);
  assert.match(foundation, /data-shell-sticky-action="true"/);
  assert.match(foundation, /data-shell-mode="conversation"/);
  assert.match(foundation, /data-keyboard-open="true"/);
});
