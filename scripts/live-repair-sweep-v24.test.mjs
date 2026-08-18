import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/rawaj-live-repair-sweep-v24.css", import.meta.url), "utf8");
const stability = await readFile(new URL("../src/stability-accessibility-fixes.css", import.meta.url), "utf8");

test("active listing-studio step uses the primary audited text tone", () => {
  assert.match(
    css,
    /rawaj-studio-steps li\[data-active="true"\] small[\s\S]*?color:\s*var\(--studio-v5-text, #f4f1ed\)\s*!important/,
  );
});

test("Boost request count uses primary text on the muted pill", () => {
  assert.match(
    css,
    /data-resolved-pathname="\/promotion"[\s\S]*?span\.rounded-full\.bg-muted\.px-3[\s\S]*?color:\s*var\(--rawaj-text-primary, #f4f1ed\)\s*!important/,
  );
});

test("V24 is last in the audited override chain", () => {
  assert.ok(stability.indexOf('rawaj-live-repair-sweep-v23.css') >= 0);
  assert.ok(
    stability.indexOf('rawaj-live-repair-sweep-v24.css') >
      stability.indexOf('rawaj-live-repair-sweep-v23.css'),
  );
});
