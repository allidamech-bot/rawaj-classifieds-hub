import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [listingComponents, mediaUrl, adPlacements] = await Promise.all([
  readFile(new URL("../src/features/listings/listings-components.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/ad-placement-media-url.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/ad-placements.ts", import.meta.url), "utf8"),
]);

test("listing dates use a deterministic marketplace timezone during SSR and hydration", () => {
  assert.match(listingComponents, /timeZone: "Asia\/Damascus"/);
  assert.match(listingComponents, /new Intl\.DateTimeFormat/);
});

test("legacy private-object ad media URLs are repaired to public-object URLs", () => {
  assert.match(mediaUrl, /storage\/v1\/object\/public/);
  assert.match(mediaUrl, /storage\/v1\/object\//);
  assert.match(mediaUrl, /url\.pathname = url\.pathname\.replace/);
  assert.match(adPlacements, /normalizeAdPlacementMediaUrl\(data\.publicUrl \?\? ""\)/);
  assert.match(
    adPlacements,
    /imageUrl: normalizeAdPlacementMediaUrl\(rowString\(row, "image_url"\)\)/,
  );
  assert.match(adPlacements, /const imageUrl = normalizeAdPlacementMediaUrl\(payload\.imageUrl\)/);
});
