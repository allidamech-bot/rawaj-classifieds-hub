import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootRoute = await readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/design-foundation.css", import.meta.url), "utf8");
const compatibilityLayer = await readFile(
  new URL("../src/design-system-v2.css", import.meta.url),
  "utf8",
);
const button = await readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8");
const card = await readFile(new URL("../src/components/ui/card.tsx", import.meta.url), "utf8");
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
    "--rawaj-elevated-background",
    "--rawaj-border-strong",
    "--rawaj-control-height",
    "--rawaj-card-padding",
    "--rawaj-icon-md",
    "--z-overlay",
  ];

  for (const token of requiredTokens) {
    assert.match(foundation, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
  }

  assert.match(foundation, /min-height:\s*100dvh/);
  assert.match(foundation, /env\(safe-area-inset-bottom/);
  assert.match(foundation, /prefers-reduced-motion/);
});

test("the compatibility layer consumes the canonical token source", () => {
  assert.doesNotMatch(compatibilityLayer, /:root\s*{/);
  assert.doesNotMatch(compatibilityLayer, /\.dark\s*{/);
  assert.match(compatibilityLayer, /Canonical tokens live in design-foundation\.css/);
});

test("shared primitives expose the premium calm component contracts", () => {
  assert.match(button, /brand:/);
  assert.match(button, /compact:/);
  assert.match(button, /bg-brand-orange/);
  assert.match(card, /variant:\s*{/);
  assert.match(card, /subtle:/);
  assert.match(card, /elevated:/);
  assert.match(card, /interactive\?: boolean/);
});

test("legacy mobile UI is normalized to readable text and touch targets", () => {
  assert.match(foundation, /rawaj-bottom-dock__label/);
  assert.match(foundation, /rawaj-search-toolbar__recent/);
  assert.match(foundation, /font-size:\s*max\((?:0\.75rem|\.75rem),\s*(?:11|12)px\)/);
  assert.match(foundation, /min-width:\s*var\(--rawaj-touch-target\)/);
  assert.match(foundation, /min-height:\s*var\(--rawaj-touch-target\)/);
});

test("app shell owns viewport, keyboard and bottom-reservation behavior", () => {
  assert.match(appShell, /--app-viewport-height/);
  assert.match(appShell, /orientationchange/);
  assert.match(appShell, /data-shell-dock=\{config\.showDock\}/);
  assert.match(appShell, /data-shell-sticky-action=\{config\.reserveStickyAction\}/);
  assert.match(appShell, /data-keyboard-open=\{keyboardOpen\}/);
  assert.match(appShell, /className="rawaj-app-shell__content"/);
  assert.doesNotMatch(appShell, /<main className="rawaj-app-shell__content"/);

  assert.match(foundation, /data-shell-dock=(?:"true"|true)/);
  assert.match(foundation, /data-shell-sticky-action=(?:"true"|true)/);
  assert.match(foundation, /data-shell-mode=(?:"conversation"|conversation)/);
  assert.match(foundation, /data-keyboard-open=(?:"true"|true)/);
});
