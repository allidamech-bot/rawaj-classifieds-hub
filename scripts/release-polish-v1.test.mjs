import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [css, pkg] = await Promise.all([
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("final empty states share one premium compact surface", () => {
  for (const selector of [
    "rawaj-search-empty-state",
    "rawaj-trust-empty",
    "rawaj-offers-empty",
    "rawaj-latest-discovery__empty",
  ]) assert.match(css, new RegExp(selector));
  assert.match(css, /linear-gradient\(145deg, #fffefa, #f8f7f1\)/);
});

test("final interaction polish covers selection, touch, hover, and loading", () => {
  assert.match(css, /::selection/);
  assert.match(css, /scrollbar-color/);
  assert.match(css, /-webkit-tap-highlight-color/);
  assert.match(css, /@media \(hover: none\)/);
  assert.match(css, /animation-duration: 1\.65s/);
});

test("final polish remains mobile and reduced-motion safe", () => {
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
});

test("release polish contract is permanent", () => {
  const parsed = JSON.parse(pkg);
  assert.equal(parsed.scripts["test:release-polish-v1"], "node --test scripts/release-polish-v1.test.mjs");
  assert.match(parsed.scripts.precheck, /test:release-polish-v1/);
});
