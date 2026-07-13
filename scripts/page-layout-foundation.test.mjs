import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const foundation = await readFile(
  new URL("../src/design-foundation.css", import.meta.url),
  "utf8",
);

const requiredTokens = [
  "--rawaj-page-gutter",
  "--rawaj-page-gutter-wide",
  "--rawaj-page-max",
  "--rawaj-reading-max",
  "--rawaj-form-max",
  "--rawaj-section-gap",
  "--rawaj-stack-gap",
];

test("page layout exposes canonical width and rhythm tokens", () => {
  for (const token of requiredTokens) {
    assert.ok(foundation.includes(`${token}:`), `Missing ${token}`);
  }
});

test("shared containers use one width and gutter contract", () => {
  assert.ok(foundation.includes(".rawaj-page-container,\n.container-wide"));
  assert.ok(foundation.includes("width: min(100%, var(--rawaj-page-max));"));
  assert.ok(foundation.includes("padding-inline: var(--rawaj-page-gutter);"));
  assert.ok(foundation.includes(".rawaj-page-container--reading"));
  assert.ok(foundation.includes(".rawaj-page-container--form"));
});

test("mobile edge-to-edge sections reset at tablet width", () => {
  assert.ok(foundation.includes(".rawaj-edge-to-edge-mobile"));
  assert.ok(
    foundation.includes("margin-inline: calc(var(--rawaj-page-gutter) * -1);"),
  );
  assert.ok(foundation.includes("@media (min-width: 640px)"));
  assert.ok(foundation.includes("margin-inline: 0;"));
});
