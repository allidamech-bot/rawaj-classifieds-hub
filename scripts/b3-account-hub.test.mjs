import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("src/routes/more.tsx");
const skin = read("src/account-command-premium.css");
const shortcuts = read("src/account-shortcuts-compact-row.css");

test("B3.1 account hub retains its account destinations and auth behavior", () => {
  for (const route of [
    "/activity", "/promotion", "/favorites", "/saved-searches", "/verification",
    "/profile", "/support", "/safety", "/privacy", "/terms",
  ]) {
    assert.ok(page.includes(`to: "${route}"`), `missing destination ${route}`);
  }
  assert.match(page, /auth\.signOut\(\)/);
  assert.match(page, /auth\.status === "signedOut"/);
  assert.match(page, /search=\{\{ returnTo: "\/more" \}\}/);
  assert.match(page, /role="alert"/);
  assert.match(page, /<nav className="rawaj-more-v2__secondary"/);
});

test("B3.1 replaces the command skin at its source, with the approved shared tokens", () => {
  assert.match(skin, /--rawaj-identity-petrol/);
  assert.match(skin, /--rawaj-identity-teal/);
  assert.match(skin, /--rawaj-identity-ivory/);
  assert.match(skin, /--rawaj-identity-champagne/);
  assert.match(skin, /data-resolved-pathname="\/more"/);
  assert.match(skin, /\.rawaj-more-v2__signin/);
  assert.match(skin, /prefers-reduced-motion/);
  assert.match(skin, /:focus-visible/);
  assert.doesNotMatch(skin, /#(?:10131a|0d1016|0b0e14|8f2549|d3295f|d948ad)\b/i);
  assert.doesNotMatch(skin, /data-resolved-pathname="\/(?:listings|add-listing|seller|profile\/listings)/);
});

test("small-phone account shortcut layout is readable and store protection is intact", () => {
  assert.match(shortcuts, /max-width: 559px/);
  assert.match(shortcuts, /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(shortcuts, /white-space: normal !important/);
  assert.match(shortcuts, /data-resolved-pathname="\/profile\/listings"/);
  assert.match(shortcuts, /\.rawaj-owner-control-center/);
  assert.match(shortcuts, /\.rawaj-header-store/);
});
