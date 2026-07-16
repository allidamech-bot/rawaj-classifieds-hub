import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  root,
  routeStyles,
  home,
  hero,
  worlds,
  showcase,
  adaptiveCard,
  sharedCard,
  marketplaceCss,
  discoveryCss,
  adaptiveCss,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/DiscoveryHero.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/CategoryWorlds.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/FeaturedListingShowcase.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listings/cards/AdaptiveListingCard.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listings/cards/ListingCardShared.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/home-marketplace-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/home-discovery-v3.css", import.meta.url), "utf8"),
  readFile(new URL("../src/adaptive-listing-cards.css", import.meta.url), "utf8"),
]);

test("marketplace layers load after Design System V2", () => {
  assert.match(
    routeStyles,
    /import homeMarketplaceV2Css from "\.\.\/home-marketplace-v2\.css\?url";/,
  );
  assert.match(
    routeStyles,
    /import homeDiscoveryV3Css from "\.\.\/home-discovery-v3\.css\?url";/,
  );
  assert.match(
    root,
    /import adaptiveListingCardsCss from "\.\.\/adaptive-listing-cards\.css\?url";/,
  );
  const foundationIndex = root.indexOf("href: designSystemV2Css");
  const marketplaceIndex = root.indexOf("routeStyleHrefs.homeMarketplaceV2");
  const discoveryIndex = root.indexOf("routeStyleHrefs.homeDiscoveryV3");
  const adaptiveIndex = root.indexOf("href: adaptiveListingCardsCss");
  assert.notEqual(foundationIndex, -1);
  assert.notEqual(marketplaceIndex, -1);
  assert.notEqual(discoveryIndex, -1);
  assert.notEqual(adaptiveIndex, -1);
  assert.ok(marketplaceIndex > foundationIndex);
  assert.ok(discoveryIndex > marketplaceIndex);
  assert.ok(adaptiveIndex > discoveryIndex);
});

test("home discovery uses a dominant search, asymmetric worlds, and editorial featured inventory", () => {
  assert.match(home, /<DiscoveryHero/);
  assert.match(home, /<CategoryWorlds/);
  assert.match(home, /<FeaturedListingShowcase/);
  assert.match(hero, /rawaj-search-overlay/);
  assert.match(worlds, /data-size=\{index < 2 \? "large" : "compact"\}/);
  assert.match(showcase, /<FeaturedShowcaseCard listing=\{primary\}/);
  assert.doesNotMatch(showcase, /RealListingCard/);
  assert.doesNotMatch([home, hero, worlds, showcase].join("\n"), /trending/i);
});

test("listing cards adapt by category and preserve featured and reserved states", () => {
  assert.match(adaptiveCard, /resolveListingCardVariant\(listing\)/);
  assert.match(adaptiveCard, /<VehicleCard/);
  assert.match(adaptiveCard, /<PropertyCard/);
  assert.match(adaptiveCard, /<ProductCard/);
  assert.match(sharedCard, /data-featured=\{listing\.isFeatured\}/);
  assert.match(sharedCard, /data-reserved=\{Boolean\(listing\.reservedAt\)\}/);
  assert.match(sharedCard, /rawaj-adaptive-card__status/);
  assert.match(sharedCard, /rawaj-adaptive-card__price/);
  assert.match(sharedCard, /rawaj-adaptive-card__title/);
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
  assert.match(adaptiveCss, /@media \(prefers-reduced-motion: reduce\)/);
});
