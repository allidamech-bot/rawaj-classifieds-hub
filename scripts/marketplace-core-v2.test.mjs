import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, home, listingCard, css] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/RealListingCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/home-marketplace-v2.css", import.meta.url), "utf8"),
]);

test("marketplace core styles load after Design System V2", () => {
  assert.match(root, /import homeMarketplaceV2Css from "\.\.\/home-marketplace-v2\.css\?url";/);
  const foundationIndex = root.indexOf("href: designSystemV2Css");
  const marketplaceIndex = root.indexOf("href: homeMarketplaceV2Css");
  assert.notEqual(foundationIndex, -1);
  assert.notEqual(marketplaceIndex, -1);
  assert.ok(marketplaceIndex > foundationIndex);
});

test("home discovery uses layered hero, section surfaces, and honest quick searches", () => {
  assert.match(home, /rawaj-home-v2-hero/);
  assert.match(home, /rawaj-home-v2-categories/);
  assert.match(home, /rawaj-home-v2-listings/);
  assert.match(home, /rawaj-home-tone-featured/);
  assert.match(home, /rawaj-home-tone-latest/);
  assert.match(home, /quickSearches/);
  assert.match(home, /rawaj-home-shortcut/);
  assert.doesNotMatch(home, /trending/i);
});

test("listing cards expose featured and reserved states with stronger hierarchy", () => {
  assert.match(listingCard, /data-featured=\{listing\.isFeatured\}/);
  assert.match(listingCard, /data-reserved=\{Boolean\(listing\.reservedAt\)\}/);
  assert.match(listingCard, /rawaj-listing-status/);
  assert.match(listingCard, /rawaj-listing-price/);
  assert.match(listingCard, /rawaj-listing-title/);
});

test("mobile listing grid protects readability on narrow screens", () => {
  assert.match(css, /\.listing-card-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(
    css,
    /@media \(min-width: 390px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
