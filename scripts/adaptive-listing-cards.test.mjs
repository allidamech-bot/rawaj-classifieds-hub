import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  root,
  compatibility,
  adaptive,
  product,
  vehicle,
  property,
  compact,
  featured,
  skeleton,
  shared,
  utils,
  legacyComponents,
  listingsRoute,
  favoritesRoute,
  favoriteCard,
  homeShowcase,
  css,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/RealListingCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/AdaptiveListingCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/ProductCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/VehicleCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/PropertyCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/CompactCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/FeaturedShowcaseCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/ListingCardSkeleton.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/ListingCardShared.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/listing-card-utils.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/listings-components.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/favorites.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/favorites/FavoriteListingCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/FeaturedListingShowcase.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/adaptive-listing-cards.css", import.meta.url), "utf8"),
]);

test("adaptive card styles load after home discovery layers", () => {
  assert.match(
    root,
    /import adaptiveListingCardsCss from "\.\.\/adaptive-listing-cards\.css\?url";/,
  );
  const homeIndex = root.indexOf("href: homeDiscoveryV3Css");
  const adaptiveIndex = root.indexOf("href: adaptiveListingCardsCss");
  assert.notEqual(homeIndex, -1);
  assert.notEqual(adaptiveIndex, -1);
  assert.ok(adaptiveIndex > homeIndex);
});

test("one compatibility entry point resolves product, vehicle, and property cards", () => {
  assert.match(compatibility, /<AdaptiveListingCard listing=\{listing\} action=\{action\}/);
  assert.match(adaptive, /resolveListingCardVariant\(listing\)/);
  assert.match(adaptive, /<VehicleCard listing=\{listing\}/);
  assert.match(adaptive, /<PropertyCard listing=\{listing\}/);
  assert.match(adaptive, /<ProductCard listing=\{listing\}/);
  assert.doesNotMatch(legacyComponents, /export function RealListingCard/);
});

test("variant mapping uses the canonical category field detector", () => {
  assert.match(utils, /detectCategoryFieldKind\(undefined, listing\)/);
  assert.match(utils, /kind === "vehicles"/);
  assert.match(utils, /kind === "real_estate"/);
  assert.match(utils, /return "product"/);
});

test("vehicle and property cards expose only factual category details", () => {
  assert.match(vehicle, /vehicleCardFacts\(listing, language\)/);
  assert.match(property, /propertyCardFacts\(listing, language\)/);
  for (const key of ["year", "mileage_km", "transmission", "fuel_type"]) {
    assert.match(utils, new RegExp(key));
  }
  for (const key of ["area_sqm", "bedrooms", "rooms", "property_type", "listing_purpose"]) {
    assert.match(utils, new RegExp(key));
  }
  assert.match(product, /productCardFacts\(listing, language\)/);
});

test("shared cards preserve media, state, links, action slot, location, and time", () => {
  assert.match(shared, /to="\/listings\/\$id"/);
  assert.match(shared, /params=\{\{ id: listing\.id \}\}/);
  assert.match(shared, /loading=\{imageLoading\}/);
  assert.match(shared, /listing\.primaryImageUrl/);
  assert.match(shared, /PlaceholderArt/);
  assert.match(shared, /data-tone="reserved"/);
  assert.match(shared, /data-tone="featured"/);
  assert.match(shared, /rawaj-adaptive-card__action/);
  assert.match(shared, /listingLocationDisplay\(listing, language\)/);
  assert.match(shared, /formatDate\(listing\.createdAt, language\)/);
});

test("compact and featured variants replace route-local card duplication", () => {
  assert.match(compact, /variant="compact"/);
  assert.match(featured, /data-card-variant="featured"/);
  assert.match(featured, /resolveListingCardVariant\(listing\)/);
  assert.match(homeShowcase, /<FeaturedShowcaseCard listing=\{primary\}/);
  assert.match(homeShowcase, /<CompactCard key=\{listing\.id\} listing=\{listing\}/);
  assert.match(favoriteCard, /<CompactCard/);
  assert.match(favoritesRoute, /<FavoriteListingCard/);
});

test("results use matching skeletons before adaptive real cards", () => {
  assert.match(listingsRoute, /<ListingCardSkeleton/);
  assert.match(listingsRoute, /categoryFieldKind === "vehicles"/);
  assert.match(listingsRoute, /categoryFieldKind === "real_estate"/);
  assert.match(listingsRoute, /<RealListingCard key=\{listing\.id\} listing=\{listing\}/);
  assert.match(skeleton, /data-card-variant=\{compact \? "compact" : variant\}/);
  assert.match(css, /rawaj-card-skeleton-shimmer/);
});

test("card interactions avoid layout shift and respect reduced motion", () => {
  assert.match(css, /aspect-ratio: 4 \/ 3/);
  assert.match(css, /aspect-ratio: 16 \/ 10/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
  assert.match(css, /animation: none/);
});
