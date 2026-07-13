import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const foundation = await readFile(
  new URL("../src/design-foundation.css", import.meta.url),
  "utf8",
);

test("page layout exposes canonical width and rhythm tokens", () => {
  for (const token of [
    "--rawaj-page-gutter",
    "--rawaj-page-gutter-wide",
    "--rawaj-page-max",
    "--rawaj-reading-max",
    "--rawaj-form-max",
    "--rawaj-section-gap",
    "--rawaj-stack-gap",
  ]) {
    assert.match(foundation, new RegExp(`${token}\\s*:`));
  }
});

test("shared containers use one width and gutter contract", () => {
  assert.match(foundation, /\.rawaj-page-container,\s*\n\.container-wide/);
  assert.match(foundation, /width:\s*min\(100%,\s*var\(--rawaj-page-max\)\)/);
  assert.match(foundation, /padding-inline:\s*var\(--rawaj-page-gutter\)/);
  assert.match(foundation, /rawaj-page-container--reading/);
  assert.match(foundation, /rawaj-page-container--form/);
});

test("mobile edge-to-edge sections reset at tablet width", () => {
  assert.match(foundation, /rawaj-edge-to-edge-mobile/);
  assert.match(foundation, /margin-inline:\s*calc\(var\(--rawaj-page-gutter\) \* -1\)/);
  assert.match(
    foundation,
    /@media \(min-width:\s*640px\)[\s\S]*rawaj-edge-to-edge-mobile[\s\S]*margin-inline:\s*0/,
  );
});
