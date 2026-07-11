import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, home, hero, worlds, showcase, featuredCard, latest, trust, css] =
  await Promise.all([
    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/index.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/DiscoveryHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/CategoryWorlds.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/FeaturedListingShowcase.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/listings/cards/FeaturedShowcaseCard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/features/home/LatestDiscovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/home/HomeTrustStrip.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/home-discovery-v3.css", import.meta.url), "utf8"),
  ]);

test("home discovery V3 styles load after marketplace V2", () => {
  assert.match(root, /import homeDiscoveryV3Css from "\.\.\/home-discovery-v3\.css\?url";/);
  const marketplaceIndex = root.indexOf("href: homeMarketplaceV2Css");
  const discoveryIndex = root.indexOf("href: homeDiscoveryV3Css");
  assert.notEqual(marketplaceIndex, -1);
  assert.notEqual(discoveryIndex, -1);
  assert.ok(discoveryIndex > marketplaceIndex);
});

test("home composes the new discovery flow from real loader data", () => {
  assert.match(home, /<DiscoveryHero/);
  assert.match(home, /<CategoryWorlds categories=\{categories\}/);
  assert.match(home, /<FeaturedListingShowcase listings=\{featuredListings\}/);
  assert.match(home, /<LatestDiscovery listings=\{latestListings\}/);
  assert.match(home, /<HomeTrustStrip/);
  assert.match(home, /fetchPublicCategories\(\)/);
  assert.match(home, /fetchPublicListings\(\{\}, null, 18\)/);
  assert.doesNotMatch(home, /mockListings|fakeListings|sampleListings/i);
});

test("search overlay preserves listings search and filter behavior", () => {
  assert.match(hero, /rawaj-search-overlay/);
  assert.match(hero, /to="\/listings"/);
  assert.match(hero, /open_filters: true/);
  assert.match(hero, /search=\{\{ q: shortcut\.query \}\}/);
});

test("category worlds use live categories and asymmetric sizing", () => {
  assert.match(worlds, /categories\.slice\(0, 6\)/);
  assert.match(worlds, /search=\{\{ category: category\.id \}\}/);
  assert.match(worlds, /data-size=\{index < 2 \? "large" : "compact"\}/);
  assert.match(css, /\.rawaj-category-world\[data-size="large"\]/);
  assert.match(css, /grid-column: span 2/);
});

test("featured inventory uses the adaptive editorial showcase", () => {
  assert.match(showcase, /const \[primary, \.\.\.secondary\] = listings/);
  assert.match(showcase, /if \(!primary\) return null/);
  assert.match(showcase, /<FeaturedShowcaseCard listing=\{primary\}/);
  assert.match(showcase, /<CompactCard key=\{listing\.id\} listing=\{listing\}/);
  assert.doesNotMatch(showcase, /RealListingCard/);
  assert.match(featuredCard, /data-card-variant="featured"/);
  assert.match(featuredCard, /listing\.reservedAt/);
  assert.match(featuredCard, /listingLocationDisplay\(listing, language\)/);
});

test("latest discovery excludes showcased ids and keeps standard real cards", () => {
  assert.match(home, /const featuredListingIds = new Set/);
  assert.match(home, /!featuredListingIds\.has\(listing\.id\)/);
  assert.match(home, /\.slice\(0, 12\)/);
  assert.match(latest, /<RealListingCard key=\{listing\.id\} listing=\{listing\}/);
});

test("trust strip links to the safety guide", () => {
  assert.match(trust, /to="\/safety"/);
  assert.match(trust, /افحص السلعة قبل الدفع/);
  assert.match(trust, /لا تحوّل المال قبل التحقق/);
});

test("claims and motion remain honest and accessible", () => {
  const combined = [home, hero, worlds, showcase, featuredCard, latest].join("\n");
  assert.doesNotMatch(combined, /trending|most viewed|الأكثر مشاهدة|الأكثر رواجًا/i);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
});
