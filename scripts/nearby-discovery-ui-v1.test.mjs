import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [route, control, hook] = await Promise.all([
  readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/NearbyDiscoveryControl.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/use-nearby-discovery.ts", import.meta.url), "utf8"),
]);

test("nearby discovery is explicitly activated and remains ephemeral", () => {
  assert.match(control, /onActivate/);
  assert.match(hook, /requestNearbyPosition\(\)/);
  assert.match(hook, /pointRef = useRef<NearbyPoint \| null>\(null\)/);
  assert.doesNotMatch(hook, /localStorage|sessionStorage|URLSearchParams/);
});

test("cancelled permission requests cannot reactivate nearby mode", () => {
  assert.match(hook, /const requestId = \+\+requestRef\.current;[\s\S]*requestNearbyPosition\(\)/);
  assert.match(hook, /if \(requestRef\.current !== requestId\) return;/);
  assert.match(hook, /requestRef\.current \+= 1;/);
});

test("nearby mode supports the approved radius choices and manual fallback", () => {
  assert.match(control, /\[5, 10, 25, 50, 100\]/);
  assert.match(control, /permission_denied/);
  assert.match(control, /manual location filters/);
  assert.match(control, /onClear/);
});

test("listing results switch to nearby matches and expose coarse distance", () => {
  assert.match(route, /const visibleItems = nearby\.active/);
  assert.match(route, /nearbyDistanceById/);
  assert.match(route, /كم تقريبًا/);
  assert.match(route, /!nearby\.active && nextCursor/);
});

test("nearby requests reuse existing public filters without precise URL state", () => {
  assert.match(route, /categoryId: selectedCategory\?\.id/);
  assert.match(route, /governorateId: govId \|\| undefined/);
  assert.match(hook, /fetchNearbyPublicListings/);
  assert.doesNotMatch(route, /latitude|longitude/);
});
