import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dock = await readFile(
  new URL("../src/components/shell/BottomDock.tsx", import.meta.url),
  "utf8",
);

test("bottom dock exposes stable navigation and accessibility contracts", () => {
  assert.match(dock, /preload="intent"/);
  assert.match(dock, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(dock, /role="list"/);
  assert.match(dock, /role="listitem"/);
  assert.match(dock, /aria-hidden="true"/);
  assert.match(dock, /data-badge-count/);
  assert.match(dock, /unread/);
  assert.match(dock, /focus-visible:ring-2/);
});
