import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [css, accountCss, messagingCss, ownerStoreCss, pkg] = await Promise.all([
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/personal-space-polish.css", import.meta.url), "utf8"),
  readFile(new URL("../src/messaging-v4.css", import.meta.url), "utf8"),
  readFile(new URL("../src/owner-listings-workspace-v9.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("final empty states share one compact reusable surface", () => {
  for (const selector of [
    "rawaj-search-empty-state",
    "rawaj-trust-empty",
    "rawaj-offers-empty",
    "rawaj-latest-discovery__empty",
  ]) assert.match(css, new RegExp(selector));
  assert.match(css, /padding:\s*clamp\(/);
});

test("final interaction polish covers selection, touch, hover, and loading", () => {
  assert.match(css, /::selection/);
  assert.match(css, /scrollbar-color/);
  assert.match(css, /-webkit-tap-highlight-color/);
  assert.match(css, /@media \(hover: none\)/);
  assert.match(css, /animation-duration: 1\.65s/);
});

test("correction pass keeps premium hierarchy structural rather than decorative", () => {
  assert.match(accountCss, /background:\s*var\(--account-v3-surface\)/);
  assert.match(accountCss, /box-shadow:\s*0 3px 12px/);
  assert.match(messagingCss, /background:\s*var\(--message-surface\)/);
  assert.match(messagingCss, /font-size:\s*max\(0\.84rem, 13\.5px\)/);
  assert.match(ownerStoreCss, /\.rawaj-owner-workspace-summary__completeness/);
  assert.match(ownerStoreCss, /prefers-reduced-motion: reduce/);
});

test("final polish remains mobile and reduced-motion safe", () => {
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
  assert.match(accountCss, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(messagingCss, /@media \(max-width: 639px\)/);
});

test("release polish contract is permanent", () => {
  const parsed = JSON.parse(pkg);
  assert.equal(parsed.scripts["test:release-polish-v1"], "node --test scripts/release-polish-v1.test.mjs");
  assert.match(parsed.scripts.precheck, /test:release-polish-v1/);
});
