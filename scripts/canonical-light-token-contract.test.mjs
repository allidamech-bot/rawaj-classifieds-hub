import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/design-foundation.css", import.meta.url), "utf8");

test("the initial design foundation uses canonical white-first surfaces", () => {
  assert.match(css, /--rawaj-canvas:\s*#ffffff/);
  assert.match(css, /--rawaj-brand-primary:\s*#103f42/);
  assert.match(css, /--rawaj-ink-primary:\s*#152322/);
  assert.match(css, /--rawaj-page-background:\s*var\(--rawaj-canvas\)/);
  assert.match(css, /--rawaj-card-background:\s*var\(--rawaj-surface\)/);
  assert.match(css, /--rawaj-text-primary:\s*var\(--rawaj-ink-primary\)/);
  assert.doesNotMatch(css, /--rawaj-page-background:\s*#171e1c/);
  assert.doesNotMatch(css, /--rawaj-text-primary:\s*#f5f1e8/);
});
