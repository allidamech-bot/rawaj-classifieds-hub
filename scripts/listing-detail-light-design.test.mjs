import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/listing-detail-v3.css", import.meta.url), "utf8");

test("listing detail reads on the shared white canvas without changing dark photo viewing", () => {
  assert.match(css, /--detail-canvas:\s*var\(--rawaj-canvas\)/);
  assert.match(css, /--detail-surface:\s*var\(--rawaj-surface\)/);
  assert.match(css, /--detail-ink:\s*var\(--rawaj-ink-primary\)/);
  assert.match(css, /rawaj-detail-media__stage\s*\{[\s\S]*background:\s*#061b18/);
  assert.doesNotMatch(css, /--detail-canvas:\s*#f2efe7/);
});
