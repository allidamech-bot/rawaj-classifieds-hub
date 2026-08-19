import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/rawaj-live-repair-sweep-v24.css", import.meta.url), "utf8");
const stability = await readFile(new URL("../src/stability-accessibility-fixes.css", import.meta.url), "utf8");

test("active listing-studio step description uses an opaque high-contrast final tone", () => {
  assert.match(css, /data-resolved-pathname="\/add-listing"/);
  assert.match(
    css,
    /rawaj-studio-steps[\s\S]*?li\[data-state="active"\][\s\S]*?rawaj-studio-steps__copy[\s\S]*?small[\s\S]*?color:\s*#fff\s*!important[\s\S]*?opacity:\s*1\s*!important/,
  );
});

test("Boost request count uses primary text on the muted pill", () => {
  assert.match(
    css,
    /data-resolved-pathname="\/promotion"[\s\S]*?span\.rounded-full\.bg-muted\.px-3[\s\S]*?color:\s*var\(--rawaj-text-primary, #f4f1ed\)\s*!important/,
  );
});

test("More unread badge keeps destructive semantics with AA-safe small white text", () => {
  assert.match(
    css,
    /rawaj-more-v2__command[\s\S]*?rawaj-color-card[\s\S]*?background:\s*#9f1239\s*!important[\s\S]*?color:\s*#fff\s*!important/,
  );
});

test("V24 is last in the audited override chain", () => {
  assert.ok(stability.indexOf('rawaj-live-repair-sweep-v23.css') >= 0);
  assert.ok(
    stability.indexOf('rawaj-live-repair-sweep-v24.css') >
      stability.indexOf('rawaj-live-repair-sweep-v23.css'),
  );
});
