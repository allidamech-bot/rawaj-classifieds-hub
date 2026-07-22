import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  css,
  foundation,
  commerceFoundation,
  root,
  routeStyles,
  button,
  input,
  card,
  badge,
  header,
  bottomDock,
] = await Promise.all([
  readFile(new URL("../src/design-system-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/design-foundation.css", import.meta.url), "utf8"),
  readFile(new URL("../src/modern-syrian-commerce-foundation.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/input.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/card.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/badge.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/BottomDock.tsx", import.meta.url), "utf8"),
]);

test("design system V2 is loaded after legacy page styles", () => {
  assert.match(root, /import designSystemV2Css from "\.\.\/design-system-v2\.css\?url";/);
  assert.match(routeStyles, /import personalSpacePolishCss from "\.\.\/personal-space-polish\.css\?url";/);
  const legacyIndex = root.indexOf("routeStyleHrefs.personalSpacePolish");
  const designSystemIndex = root.indexOf("href: designSystemV2Css");
  assert.notEqual(legacyIndex, -1);
  assert.notEqual(designSystemIndex, -1);
  assert.ok(designSystemIndex > legacyIndex);
  assert.match(root, /theme-color", content: "#123f38"/);
});

test("modern Syrian commerce foundation is global, bright, and canonical", () => {
  assert.match(routeStyles, /import "\.\.\/modern-syrian-commerce-foundation\.css";/);
  assert.match(commerceFoundation, /--color-action:#ef704b;/);
  assert.match(commerceFoundation, /--color-trust:#3f8b78;/);
  assert.match(commerceFoundation, /--color-premium:#c59b55;/);
  assert.match(commerceFoundation, /--primary:var\(--color-trust\);/);
  assert.match(commerceFoundation, /--brand-navy:var\(--color-trust-deep\);/);
  assert.match(commerceFoundation, /Bright marketplace hero/);
  assert.match(commerceFoundation, /linear-gradient\(145deg,#fff8ef 0%,#f1fbf5 54%,#fff4eb 100%\)/);
  assert.doesNotMatch(commerceFoundation, /linear-gradient\([^\n]*#092d29/);
});

test("brand palette keeps distinct page, card, sage, warm, and compatibility surfaces", () => {
  assert.match(foundation, /--rawaj-page-background: #f6f2e9;/);
  assert.match(foundation, /--rawaj-primary: #123f38;/);
  assert.match(foundation, /--rawaj-accent-orange: #f45f38;/);
  assert.match(foundation, /--rawaj-accent-gold: #c99543;/);
  assert.match(foundation, /--rawaj-surface-card: var\(--rawaj-card-background\);/);
  assert.match(foundation, /--rawaj-surface-sage: var\(--rawaj-muted-surface\);/);
  assert.match(foundation, /--rawaj-surface-warm: #fff0e8;/);
  assert.match(foundation, /--rawaj-shadow-md:/);
  assert.doesNotMatch(css, /:root\s*{/);
});

test("shared controls expose stable visual hooks and semantic variants", () => {
  assert.match(button, /data-ui="button"/);
  assert.match(button, /accent:/);
  assert.match(button, /soft:/);
  assert.match(input, /data-ui="input"/);
  assert.match(card, /data-ui="card"/);
  assert.match(badge, /data-ui="badge"/);
  assert.match(badge, /success:/);
  assert.match(badge, /warning:/);
  assert.match(badge, /gold:/);
});

test("shared navigation uses explicit active-state hooks", () => {
  assert.match(header, /rawaj-header-nav-item/);
  assert.match(header, /data-active=\{active\}/);
  assert.match(header, /rawaj-header-cta/);
  assert.match(bottomDock, /rawaj-dock-item/);
  assert.match(bottomDock, /data-primary=\{item\.primary === true\}/);
  assert.match(bottomDock, /rawaj-dock-icon/);
});

test("motion remains accessible", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none;/);
  assert.match(commerceFoundation, /animation-duration:0\.01ms!important/);
});
