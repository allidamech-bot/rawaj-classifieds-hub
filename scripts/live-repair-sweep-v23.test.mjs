import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/rawaj-live-repair-sweep-v23.css", import.meta.url), "utf8");
const stability = await readFile(new URL("../src/stability-accessibility-fixes.css", import.meta.url), "utf8");

test("mobile listing detail keeps a compact 16:9 media stage", () => {
  assert.match(css, /data-resolved-pathname\^="\/listings\/"[\s\S]*?rawaj-detail-media__stage[\s\S]*?aspect-ratio:\s*16\s*\/\s*9\s*!important/);
});

test("sticky-action routes do not stack the floating feedback trigger", () => {
  assert.match(css, /data-shell-sticky-action="true"[\s\S]*?rawaj-feedback-trigger[\s\S]*?display:\s*none\s*!important/);
});

test("V23 is loaded after V22 in the final audited override chain", () => {
  assert.ok(stability.indexOf('rawaj-live-repair-sweep-v22.css') >= 0);
  assert.ok(stability.indexOf('rawaj-live-repair-sweep-v23.css') > stability.indexOf('rawaj-live-repair-sweep-v22.css'));
});
