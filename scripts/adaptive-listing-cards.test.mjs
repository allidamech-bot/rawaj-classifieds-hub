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
  cardImage,
  utils,
  legacyComponents,
  listingsRoute,
  favoritesRoute,
  favoriteCard,
  homeShowcase,
  offersRoute,
  css,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/RealListingCard.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listings/cards/AdaptiveListingCard.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/features/listings/cards/ProductCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/VehicleCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/PropertyCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/cards/CompactCard.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listings/cards/FeaturedShowcaseCard.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listings/cards/ListingCardSkeleton.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listings/cards/ListingCardShared.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/features/listings/cards/ListingCardImage.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listings/cards/listing-card-utils.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/features/listings/listings-components.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/favorites.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/favorites/FavoriteListingCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/FeaturedListingShowcase.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/offers.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/adaptive-listing-cards.css", import.meta.url), "utf8"),
]);

test("adaptive card styles load after home discovery layers", () => {
  assert.match(
    root,
    /import adaptiveListingCardsCss from "\.\.\/adaptive-listing-cards\.css\?url";/,
  );
  const homeIndex = root.indexOf("routeStyleHrefs.homeDiscoveryV3");
  const adaptiveIndex = root.indexOf("href: adaptiveListingCardsCss");
  assert.notEqual(homeIndex, -1);
  assert.notEqual(adaptiveIndex, -1);
  assert.ok(adaptiveIndex > homeIndex);
});

test("one compatibility entry point resolves product, vehicle, and property cards", () => {
  assert.match(compatibility, /const cardAction =/);
  assert.match(compatibility, /<AdaptiveListingCard listing=\{listing\} action=\{cardAction\}/);
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
  assert.match(shared, /<ListingCardImage/);
  assert.match(shared, /data-tone="reserved"/);
  assert.match(shared, /data-tone="featured"/);
  assert.match(shared, /rawaj-adaptive-card__action/);
  assert.match(shared, /listingLocationDisplay\(listing, language\)/);
  assert.match(shared, /formatDate\(listing\.createdAt, language\)/);
});

test("listing card images fall back cleanly, reserve space, and prioritize only near-viewport media", () => {
  assert.match(cardImage, /onError=\{\(\) => setFailedSrc\(src\)\}/);
  assert.match(cardImage, /failedSrc === src/);
  assert.match(cardImage, /placeholderAspect = "standard"/);
  assert.match(
    cardImage,
    /<PlaceholderArt[\s\S]*type=\{placeholder\}[\s\S]*aspect=\{placeholderAspect\}[\s\S]*className=\{className\}/,
  );
  assert.match(cardImage, /useState<string \| null>\(null\)/);
  assert.match(cardImage, /loading = "lazy"/);
  assert.match(cardImage, /getBoundingClientRect\(\)/);
  assert.match(cardImage, /rootMargin: "25% 0px"/);
  assert.match(cardImage, /loading=\{effectiveLoading\}/);
  assert.match(cardImage, /fetchPriority=\{effectiveFetchPriority\}/);
  assert.match(cardImage, /nearViewport \? "high" : undefined/);
  assert.match(cardImage, /decoding="async"/);
  assert.match(cardImage, /width=\{width\}/);
  assert.match(cardImage, /height=\{height\}/);
  assert.match(cardImage, /draggable=\{false\}/);
  assert.match(cardImage, /className=\{className\}/);
  assert.match(featured, /<ListingCardImage/);
});

test("offer cards reuse the resilient media path with wide intrinsic dimensions", () => {
  assert.match(offersRoute, /<ListingCardImage/);
  assert.match(offersRoute, /placeholderAspect="wide"/);
  assert.match(offersRoute, /width=\{640\}/);
  assert.match(offersRoute, /height=\{360\}/);
  assert.doesNotMatch(offersRoute, /listing\.primaryImageUrl \? \(/);
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

test("favorites preserve successful snapshots and recover failed reads in place", () => {
  assert.match(favoritesRoute, /const \[hasLoaded, setHasLoaded\]/);
  assert.match(favoritesRoute, /const loadFavorites = useCallback/);
  assert.match(favoritesRoute, /error && !hasLoaded/);
  assert.match(favoritesRoute, /onAction=\{\(\) => void loadFavorites\(\)\}/);
  assert.match(favoritesRoute, /actionLabel=\{text\("إعادة المحاولة", "Try again"\)\}/);
  assert.match(favoritesRoute, /const \[actionMessage, setActionMessage\]/);
  assert.doesNotMatch(favoritesRoute, /setError\(result\.error\);[\s\S]{0,80}setItems\(\[\]\)/);
  assert.doesNotMatch(favoritesRoute, /window\.location\.reload\(\)/);
});

test("favorites reject stale account and route responses", () => {
  assert.match(favoritesRoute, /const loadRequestIdRef = useRef\(0\)/);
  assert.match(favoritesRoute, /requestId !== loadRequestIdRef\.current/);
  assert.match(favoritesRoute, /currentProfileId !== profileIdRef\.current/);
  assert.match(
    favoritesRoute,
    /return \(\) => \{[\s\S]*loadRequestIdRef\.current \+= 1;[\s\S]*\};/,
  );
});

test("results use matching skeletons before adaptive real cards", () => {
  assert.match(listingsRoute, /<ListingCardSkeleton/);
  assert.match(listingsRoute, /categoryFieldKind === "vehicles"/);
  assert.match(listingsRoute, /categoryFieldKind === "real_estate"/);
  assert.match(
    listingsRoute,
    /<RealListingCard[\s\S]{0,180}key=\{listing\.id\}[\s\S]{0,180}listing=\{listing\}/,
  );
  assert.match(skeleton, /data-card-variant=\{compact \? "compact" : variant\}/);
  assert.match(css, /rawaj-card-skeleton-shimmer/);
});

test("card text uses accessible light and dark contrast colors", () => {
  assert.match(css, /rawaj-adaptive-card__price[\s\S]*color: #b63f24/);
  assert.match(css, /dark \.rawaj-adaptive-card__price[\s\S]*color: #ff9a7d/);
  assert.match(css, /rawaj-adaptive-card__category[\s\S]*color: #4c625a/);
  assert.match(css, /dark \.rawaj-adaptive-card__category[\s\S]*color: #c1d0c7/);
  assert.match(css, /rawaj-search-results-v1 > \.mt-4[\s\S]*color: #4c625a/);
  assert.match(css, /dark \.rawaj-search-results-v1 > \.mt-4[\s\S]*color: #c1d0c7/);
});

test("card interactions avoid layout shift and respect reduced motion", () => {
  assert.match(css, /aspect-ratio: 4 \/ 3/);
  assert.match(css, /aspect-ratio: 16 \/ 10/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
  assert.match(css, /animation: none/);
});
