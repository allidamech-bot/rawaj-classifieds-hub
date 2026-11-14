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
  assert.match(dock, /data-primary=\{item\.primary === true\}/);
  assert.match(dock, /unread/);
  assert.match(dock, /focus-visible:ring-2/);
});

test("bottom dock retains four core destinations plus one auth-aware account destination", () => {
  const coreItemsSource = dock.match(/const coreItems: NavItem\[\] = \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const destinationMatches =
    coreItemsSource.match(/\bto:\s*"\/(?:categories|add-listing|chats)?"/g) ?? [];
  assert.equal(destinationMatches.length, 4);
  assert.match(coreItemsSource, /section:\s*"addListing"[\s\S]*primary:\s*true/);
  assert.match(dock, /to:\s*signedIn \? "\/more" : "\/login"/);
  assert.match(dock, /labelAr:\s*"حسابي"/);
  assert.match(dock, /labelEn:\s*"Account"/);
  assert.match(dock, /item\.section === "account" && signedIn/);
});

test("bottom dock keeps the primary action restrained", () => {
  assert.match(dock, /-mt-3 h-11 w-11/);
  assert.match(dock, /ring-\[3px\]/);
  assert.doesNotMatch(dock, /rawaj-dock-active-indicator/);
});
