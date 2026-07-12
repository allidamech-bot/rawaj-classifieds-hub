/* eslint-disable */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderDemoPng } from "./demo-media-renderer.mjs";

const manifest = JSON.parse(
  await readFile(new URL("../supabase/demo-data/demo-media-manifest.json", import.meta.url), "utf8"),
);
const applyScript = await readFile(new URL("./apply-demo-media-pack.mjs", import.meta.url), "utf8");
const removeScript = await readFile(new URL("./remove-demo-media-pack.mjs", import.meta.url), "utf8");

const imageCount = manifest.listings.reduce((sum, listing) => sum + listing.count, 0);

 test("demo media manifest covers all launch listings", () => {
  assert.equal(manifest.listings.length, 26);
  assert.equal(new Set(manifest.listings.map((listing) => listing.id)).size, 26);
  assert.equal(imageCount, 55);
  assert.ok(manifest.listings.every((listing) => listing.count >= 1));
});

test("demo media paths follow the private bucket public-signing contract", () => {
  assert.match(applyScript, /owner_id/);
  assert.match(applyScript, /\$\{databaseListing\.owner_id\}\/\$\{listing\.id\}/);
  assert.match(applyScript, /\$\{manifest\.batch\}-\$\{suffix\}\.png/);
  assert.doesNotMatch(applyScript, /const storagePath = `\$\{manifest\.batch\}\/\$\{listing\.category\}/);
});

test("renderer produces valid non-empty PNG media", () => {
  for (const listing of manifest.listings) {
    const image = renderDemoPng({
      category: listing.category,
      kind: listing.kind,
      variant: 0,
      width: 160,
      height: 120,
    });
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(image.length > 500);
  }
});

test("apply and cleanup scripts are paired and guarded", () => {
  assert.match(applyScript, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(applyScript, /marker\?\.batch !== manifest\.batch/);
  assert.match(applyScript, /upsert: true/);
  assert.match(applyScript, /legacyPaths/);
  assert.match(applyScript, /listing_images/);
  assert.match(removeScript, /listing_images/);
  assert.match(removeScript, /storage/);
  assert.match(removeScript, /manifest\.batch/);
  assert.match(removeScript, /cleanup incomplete/);
});
