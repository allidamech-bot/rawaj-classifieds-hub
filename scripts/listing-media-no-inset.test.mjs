import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/listing-preview-true-size.css", import.meta.url), "utf8");

test("listing photos and placeholders fill every card media shell without an inset", () => {
  assert.match(css, /\.rawaj-adaptive-card__media\s*\{[\s\S]*?padding:\s*0\s*!important;/);
  assert.match(
    css,
    /\.rawaj-adaptive-card__media\s*>\s*\.rawaj-listing-media\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?height:\s*100%\s*!important;[\s\S]*?margin:\s*0\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?border-radius:\s*0\s*!important;/,
  );
  assert.match(
    css,
    /\.rawaj-listing-media\.rawaj-listing-media--placeholder\s*\{[\s\S]*?width:\s*100%\s*!important;[\s\S]*?height:\s*100%\s*!important;[\s\S]*?margin:\s*0\s*!important;[\s\S]*?padding:\s*0\s*!important;[\s\S]*?border-radius:\s*0\s*!important;/,
  );
});
