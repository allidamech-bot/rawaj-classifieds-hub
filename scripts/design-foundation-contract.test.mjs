import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootRoute = await readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/design-foundation.css", import.meta.url), "utf8");
const homepageIdentity = await readFile(
  new URL("../src/rawaj-home-signature-v2.css", import.meta.url),
  "utf8",
);
const compatibilityLayer = await readFile(
  new URL("../src/design-system-v2.css", import.meta.url),
  "utf8",
);
const button = await readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8");
const card = await readFile(new URL("../src/components/ui/card.tsx", import.meta.url), "utf8");
const feedbackWidget = await readFile(new URL("../src/components/FeedbackWidget.tsx", import.meta.url), "utf8");
const input = await readFile(new URL("../src/components/ui/input.tsx", import.meta.url), "utf8");
const select = await readFile(new URL("../src/components/ui/select.tsx", import.meta.url), "utf8");
const dialog = await readFile(new URL("../src/components/ui/dialog.tsx", import.meta.url), "utf8");
const appShell = await readFile(
  new URL("../src/components/shell/AppShell.tsx", import.meta.url),
  "utf8",
);
const brandLockup = await readFile(
  new URL("../src/components/shell/BrandLockup.tsx", import.meta.url),
  "utf8",
);
const globalDarkSystem = await readFile(
  new URL("../src/rawaj-global-dark-system.css", import.meta.url),
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
  assert.match(button, /bg-\[var\(--rawaj-action-brand\)\]/);
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

test("the shared brand name cannot fall back to retired primary green text", () => {
  assert.match(brandLockup, /rawaj-brand-lockup__name/);
  assert.match(brandLockup, /rawaj-brand-lockup__latin/);
  assert.match(brandLockup, /inverse \? "text-primary-foreground" : "text-foreground"/);
  assert.doesNotMatch(brandLockup, /inverse \? "text-primary-foreground" : "text-primary"/);
  assert.match(
    globalDarkSystem,
    /\.rawaj-app-header \.rawaj-brand-lockup__name\s*{[\s\S]*color:\s*var\(--rawaj-text-primary\) !important/,
  );
});

const approvedHomepagePalette = {
  ivory: "#f9f0e4",
  champagne: "#ffe3b0",
  ink: "#132724",
  petrol: "#073836",
  teal: "#08635e",
  gold: "#eac38f",
};

function srgbLuminance(hex) {
  const components = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = components.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first, second) {
  const a = srgbLuminance(first);
  const b = srgbLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("approved homepage identity consumes canonical tokens without color drift", () => {
  for (const [role, hex] of Object.entries(approvedHomepagePalette)) {
    const canonical = `--rawaj-identity-${role}`;
    assert.ok(
      foundation.includes(`${canonical}: ${hex};`),
      `${role} must be defined in the canonical token source`,
    );
    assert.ok(
      homepageIdentity.includes(`--home-${role}: var(${canonical});`),
      `${role} must be consumed by homepage rather than redeclared`,
    );
  }

  assert.doesNotMatch(homepageIdentity, /#073836/i, "homepage petrol must use its named token");
  assert.ok(homepageIdentity.includes('data-resolved-pathname="/"'), "homepage selectors stay route-scoped");
});

test("approved identity text pairs meet WCAG AA normal-text contrast", () => {
  for (const [foreground, background] of [
    ["ink", "ivory"],
    ["teal", "ivory"],
    ["ivory", "petrol"],
    ["champagne", "petrol"],
    ["gold", "petrol"],
  ]) {
    const ratio = contrastRatio(
      approvedHomepagePalette[foreground],
      approvedHomepagePalette[background],
    );
    assert.ok(
      ratio >= 4.5,
      `${foreground} on ${background} must achieve 4.5:1 (got ${ratio.toFixed(2)})`,
    );
  }
});

test("shared button shadows follow semantic color roles, not retired chromatic constants", () => {
  for (const token of [
    "--rawaj-button-shadow-primary",
    "--rawaj-button-shadow-primary-hover",
    "--rawaj-button-shadow-accent",
    "--rawaj-button-shadow-brand",
  ]) {
    assert.ok(foundation.includes(`${token}:`), `${token} must be owned by canonical tokens`);
    assert.ok(button.includes(`var(${token})`), `${token} must be used by shared Button`);
  }
  for (const legacy of ["rgba(155,40,111,", "rgba(194,68,49,", "rgba(96,64,168,"]) {
    assert.ok(!button.includes(legacy), `Shared Button must not hard-code ${legacy}`);
  }
});

const ivoryBadgePairs = [
  ["accent", "#073836", "#dcefe8"],
  ["success", "#14583c", "#e7f5ed"],
  ["warning", "#714900", "#fff1d1"],
  ["gold", "#6e4919", "#f8ead0"],
  ["destructive", "#942a36", "#ffe9e8"],
];

test("shared badge variants use central status tokens, never embedded colors", async () => {
  const badge = await readFile(new URL("../src/components/ui/badge.tsx", import.meta.url), "utf8");
  for (const [role] of ivoryBadgePairs) {
    for (const property of ["border", "surface", "ink"]) {
      const token = `--rawaj-badge-${role}-${property}`;
      assert.ok(foundation.includes(`${token}:`), `Missing badge token: ${token}`);
      assert.ok(badge.includes(`var(${token})`), `Badge must consume ${token}`);
    }
  }
  assert.doesNotMatch(badge, /#[0-9a-f]{3,8}/i);
  assert.ok(foundation.includes('.rawaj-app-shell[data-design-palette="ivory"]'));
  assert.ok(!appShell.includes('data-design-palette='), "Do not opt in other routes before visual acceptance");
});

test("ivory badge labels meet normal-text AA contrast", () => {
  for (const [name, ink, surface] of ivoryBadgePairs) {
    const ratio = contrastRatio(ink, surface);
    assert.ok(ratio >= 4.5, `${name} badge contrast must meet 4.5:1; got ${ratio.toFixed(2)}`);
  }
});

test("shared Card and form controls consume canonical interaction roles", () => {
  const roles = [
    "--rawaj-card-interactive-border",
    "--rawaj-card-interactive-shadow",
    "--rawaj-control-hover-border",
    "--rawaj-control-focus-border",
    "--rawaj-dialog-overlay-background",
  ];
  for (const role of roles) {
    assert.ok(foundation.includes(`${role}:`), `Missing canonical component role: ${role}`);
  }
  for (const role of ["--rawaj-card-interactive-border", "--rawaj-card-interactive-shadow"]) {
    assert.ok(card.includes(`var(${role})`), `Card must consume ${role}`);
  }
  for (const role of ["--rawaj-control-hover-border", "--rawaj-control-focus-border"]) {
    assert.ok(input.includes(`var(${role})`), `Input must consume ${role}`);
    assert.ok(select.includes(`var(${role})`), `Select must consume ${role}`);
  }
  assert.ok(dialog.includes("bg-[var(--rawaj-dialog-overlay-background)]"));
  assert.ok(
    foundation.includes(
      "--rawaj-dialog-overlay-background: color-mix(in srgb, var(--primary) 45%, transparent);",
    ),
    "Legacy dialog overlay must retain 45% primary opacity",
  );
});

test("shared cards and dialogs respect reduced motion; select scroll buttons are touch-sized", () => {
  assert.ok(card.includes("motion-reduce:transition-none"));
  assert.ok(card.includes("motion-reduce:hover:transform-none"));
  assert.ok(dialog.includes("motion-reduce:animate-none"));
  const controls = select.match(/flex min-h-11 cursor-default items-center justify-center py-1/g) ?? [];
  assert.equal(controls.length, 2, "Both select scroll buttons must meet 44px minimum");
});

test("feedback trigger uses approved identity and no retired pink-purple gradient", () => {
  for (const role of ["petrol", "ivory", "teal", "gold"]) {
    assert.ok(
      feedbackWidget.includes(`var(--rawaj-identity-${role})`),
      `Feedback trigger must consume ${role} brand role`,
    );
  }
  assert.ok(feedbackWidget.includes("rawaj-feedback-teaser"));
  assert.ok(feedbackWidget.includes("rawaj-feedback-button"));
  assert.ok(!feedbackWidget.includes("from-pink-500"));
  assert.ok(!feedbackWidget.includes("via-fuchsia-500"));
  assert.ok(!feedbackWidget.includes("to-purple-600"));
  assert.ok(feedbackWidget.includes("motion-reduce:hover:transform-none"));
});
