import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicApi = await readFile(
  new URL("../src/lib/api/public-ad-placements.ts", import.meta.url),
  "utf8",
);
const facade = await readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8");

test("public ad placement cache exposes an explicit invalidation boundary", () => {
  assert.match(publicApi, /export function invalidateActiveAdPlacementCache\(\): void/);
  assert.match(publicApi, /activePlacementCacheGeneration \+= 1/);
  assert.match(publicApi, /activePlacementCache\.clear\(\)/);
  assert.match(publicApi, /activePlacementRequests\.clear\(\)/);
});

test("stale in-flight placement reads cannot repopulate invalidated image data", () => {
  assert.match(publicApi, /const requestGeneration = activePlacementCacheGeneration/);
  assert.match(
    publicApi,
    /result\.ok && requestGeneration === activePlacementCacheGeneration/,
  );
});

test("successful owner placement saves invalidate the public image cache", () => {
  assert.match(facade, /ownerSaveAdPlacement as ownerSaveAdPlacementBase/);
  assert.match(facade, /const result = await ownerSaveAdPlacementBase\(\.\.\.args\)/);
  assert.match(facade, /if \(result\.ok\) invalidateActiveAdPlacementCache\(\)/);
  assert.match(facade, /return result/);
});
