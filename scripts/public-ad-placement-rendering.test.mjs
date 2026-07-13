import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [header, slot, api] = await Promise.all([
  readFile(new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/public-ad-placements.ts", import.meta.url), "utf8"),
]);

test("supported marketplace pages resolve to their ad placement inventory", () => {
  for (const placement of ["home", "search_results", "listing_detail", "categories", "offers"]) {
    assert.match(header, new RegExp(`return \\"${placement}\\"`));
  }
  assert.match(header, /PublicAdPlacementSlot/);
});

test("public ad slot loads device-targeted active placements and renders one banner", () => {
  assert.match(slot, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(slot, /fetchActiveAdPlacements\(placementPage, device\)/);
  assert.match(slot, /result\.data\[0\]/);
  assert.match(slot, /rel="noopener noreferrer sponsored"/);
});

test("broken public ad media is removed without blocking future refreshed URLs", () => {
  assert.match(slot, /useState<string \| null>\(null\)/);
  assert.match(slot, /failedImageUrl === placement\.imageUrl/);
  assert.match(slot, /onError=\{\(\) => setFailedImageUrl\(placement\.imageUrl\)\}/);
});

test("public ad API uses the safe active-placement RPC and repairs media URLs", () => {
  assert.match(api, /rawaj_fetch_active_ad_placements/);
  assert.match(api, /normalizeAdPlacementMediaUrl/);
  assert.match(api, /p_placement_page: placementPage/);
  assert.match(api, /p_device: device/);
});
