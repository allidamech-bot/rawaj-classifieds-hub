import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [css, root, button, input, card, badge, header, bottomNav] = await Promise.all([
  readFile(new URL("../src/design-system-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/input.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/card.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/ui/badge.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/BottomNav.tsx", import.meta.url), "utf8"),
]);

test("design system V2 is loaded after legacy page styles", () => {
  assert.match(root, /import designSystemV2Css from "\.\.\/design-system-v2\.css\?url";/);
  const legacyIndex = root.indexOf('href: personalSpacePolishCss');
  const designSystemIndex = root.indexOf('href: designSystemV2Css');
  assert.notEqual(legacyIndex, -1);
  assert.notEqual(designSystemIndex, -1);
  assert.ok(designSystemIndex > legacyIndex);
  assert.match(root, /theme-color", content: "#123f38"/);
});

test("brand palette defines distinct page, card, sage, warm, and dark surfaces", () => {
  assert.match(css, /--background: #f6f2e9;/);
  assert.match(css, /--primary: #123f38;/);
  assert.match(css, /--brand-orange: #f45f38;/);
  assert.match(css, /--gold: #c99543;/);
  assert.match(css, /--rawaj-surface-card: #fffdf9;/);
  assert.match(css, /--rawaj-surface-sage: #e9f0ea;/);
  assert.match(css, /--rawaj-surface-warm: #fff0e8;/);
  assert.match(css, /--rawaj-shadow-md:/);
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
  assert.match(bottomNav, /rawaj-dock-item/);
  assert.match(bottomNav, /data-primary=\{item\.primary === true\}/);
  assert.match(bottomNav, /rawaj-dock-icon/);
});

test("motion remains accessible", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none;/);
});
