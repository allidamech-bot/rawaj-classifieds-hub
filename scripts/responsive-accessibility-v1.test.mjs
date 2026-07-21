import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [css, pkg] = await Promise.all([
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("phase 9 prevents horizontal overflow and preserves narrow-screen layouts", () => {
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /max-width: calc\(100vw - 1\.5rem\)/);
});

test("RTL mixed content and readable measures remain stable", () => {
  assert.match(css, /unicode-bidi: isolate/);
  assert.match(css, /--rawaj-readable-measure: 72ch/);
  assert.match(css, /overflow-wrap: break-word/);
});

test("keyboard, coarse pointer, contrast, and reduced motion are explicit", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(pointer: coarse\)/);
  assert.match(css, /min-height: 2\.75rem/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("phase 9 contract is permanent", () => {
  const parsed = JSON.parse(pkg);
  assert.equal(
    parsed.scripts["test:responsive-accessibility-v1"],
    "node --test scripts/responsive-accessibility-v1.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:responsive-accessibility-v1/);
});
