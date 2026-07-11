import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, home, hero, worlds, showcase, listingCard, marketplaceCss, discoveryCss] =
  await Promise.all([
    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/DiscoveryHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/CategoryWorlds.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/FeaturedListingShowcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/listings/RealListingCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/home-marketplace-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../src/home-discovery-v3.css", import.meta.url), "utf8"),
  ]);

test("marketplace layers load after Design System V2", () => {
  assert.match(root, /import homeMarketplaceV2Css from "\.\.\/home-marketplace-v2\.css\?url";/);
  assert.match(root, /import homeDiscoveryV3Css from "\.\.\/home-discovery-v3\.css\?url";/);
  const foundationIndex = root.indexOf("href: designSystemV2Css");
  const marketplaceIndex = root.indexOf("href: homeMarketplaceV2Css");
  const discoveryIndex = root.indexOf("href: homeDiscoveryV3Css");
  assert.notEqual(foundationIndex, -1);
  assert.notEqual(marketplaceIndex, -1);
  assert.notEqual(discoveryIndex, -1);
  assert.ok(marketplaceIndex > foundationIndex);
  assert.ok(discoveryIndex > marketplaceIndex);
});

test("home discovery uses a dominant search, asymmetric worlds, and editorial featured inventory", () => {
  assert.match(home, /<DiscoveryHero/);
  assert.match(home, /<CategoryWorlds/);
  assert.match(home, /<FeaturedListingShowcase/);
  assert.match(hero, /rawaj-search-overlay/);
  assert.match(worlds, /data-size=\{index < 2 \? "large" : "compact"\}/);
  assert.match(showcase, /rawaj-featured-showcase__main/);
  assert.doesNotMatch(showcase, /RealListingCard/);
  assert.doesNotMatch([home, hero, worlds, showcase].join("\n"), /trending/i);
});

test("listing cards expose featured and reserved states with stronger hierarchy", () => {
  assert.match(listingCard, /data-featured=\{listing\.isFeatured\}/);
  assert.match(listingCard, /data-reserved=\{Boolean\(listing\.reservedAt\)\}/);
  assert.match(listingCard, /rawaj-listing-status/);
  assert.match(listingCard, /rawaj-listing-price/);
  assert.match(listingCard, /rawaj-listing-title/);
});

test("mobile listing grid protects readability on narrow screens", () => {
  assert.match(
    marketplaceCss,
    /\.listing-card-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/s,
  );
  assert.match(
    marketplaceCss,
    /@media \(min-width: 390px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(discoveryCss, /@media \(prefers-reduced-motion: reduce\)/);
});
