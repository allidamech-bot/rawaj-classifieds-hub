import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [
  root,
  routeStyles,
  home,
  hero,
  worlds,
  showcase,
  featuredCard,
  latest,
  trust,
  css,
  selectionSource,
  visualPolishCss,
  homeLoader,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
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
  readFile(new URL("../src/features/home/home-listing-selection.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/launch-readiness-visual-polish.css", import.meta.url), "utf8"),
  readFile(new URL("../src/features/home/public-home-page-data.ts", import.meta.url), "utf8"),
]);

const transpiledSelection = ts.transpileModule(selectionSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { selectDiverseListings } = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledSelection).toString("base64")}`
);

test("home discovery V3 styles load after marketplace V2", () => {
  assert.match(routeStyles, /import homeDiscoveryV3Css from "\.\.\/home-discovery-v3\.css\?url";/);
  const marketplaceIndex = root.indexOf("routeStyleHrefs.homeMarketplaceV2");
  const discoveryIndex = root.indexOf("routeStyleHrefs.homeDiscoveryV3");
  assert.notEqual(marketplaceIndex, -1);
  assert.notEqual(discoveryIndex, -1);
  assert.ok(discoveryIndex > marketplaceIndex);
});

test("launch visual polish loads last so populated-card safeguards win", () => {
  assert.match(
    root,
    /import launchReadinessVisualPolishCss from "\.\.\/launch-readiness-visual-polish\.css\?url";/,
  );
  const adaptiveIndex = root.indexOf("href: adaptiveListingCardsCss");
  const desktopIndex = root.indexOf("href: desktopExperienceV1Css");
  const polishIndex = root.indexOf("href: launchReadinessVisualPolishCss");
  assert.ok(polishIndex > adaptiveIndex);
  assert.ok(polishIndex > desktopIndex);
});

test("home composes the new discovery flow from real loader data", () => {
  assert.match(home, /<DiscoveryHero/);
  assert.match(home, /<CategoryWorlds worlds=\{categoryWorlds\}/);
  assert.match(home, /<FeaturedListingShowcase listings=\{featuredListings\}/);
  assert.match(home, /<LatestDiscovery listings=\{latestListings\}/);
  assert.match(home, /<HomeTrustStrip/);
  assert.match(home, /loader: loadPublicHomePageData/);
  assert.match(homeLoader, /fetchPublicTaxonomyNodes\(\)/);
  assert.match(homeLoader, /fetchPublicCategories\(\)/);
  assert.match(homeLoader, /fetchPublicListings\(\{\}, null, 18\)/);
  assert.doesNotMatch(home, /mockListings|fakeListings|sampleListings/i);
});

test("home discovery exposes partial read failures and retries the route loader", () => {
  assert.match(homeLoader, /categoryLoadFailed:/);
  assert.match(homeLoader, /listingLoadFailed: !listingsResult\.ok/);
  assert.match(home, /categoryLoadFailed \? \(/);
  assert.match(home, /listingLoadFailed \? \(/);
  assert.match(home, /تعذر تحميل أقسام السوق/);
  assert.match(home, /تعذر تحميل إعلانات السوق/);
  assert.match(home, /router\.invalidate\(\)/);
  assert.match(home, /إعادة المحاولة/);
  assert.doesNotMatch(home, /<CategoryWorlds worlds=\{\[\]\}/);
});

test("search overlay preserves listings search and filter behavior", () => {
  assert.match(hero, /rawaj-search-overlay/);
  assert.match(hero, /to="\/listings"/);
  assert.match(hero, /open_filters: true/);
  assert.match(hero, /search=\{\{ q: shortcut\.query \}\}/);
});

test("category worlds use canonical targets, legacy fallback, and asymmetric sizing", () => {
  assert.match(worlds, /world\.target\.kind === "directory"/);
  assert.match(worlds, /to="\/listings"/);
  assert.match(worlds, /to="\/category\/\$slug"/);
  assert.match(worlds, /params=\{\{ slug: world\.target\.slug \}\}/);
  assert.match(worlds, /"data-size": index < 2 \? \("large" as const\) : \("compact" as const\)/);
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

test("populated home selection distributes categories before filling remaining slots", () => {
  const candidates = [
    { id: "a1", categoryId: "cars" },
    { id: "a2", categoryId: "cars" },
    { id: "a3", categoryId: "cars" },
    { id: "b1", categoryId: "homes" },
    { id: "c1", categoryId: "phones" },
    { id: "d1", categoryId: "services" },
    { id: "b2", categoryId: "homes" },
  ];

  assert.deepEqual(
    selectDiverseListings(candidates, 4, 1).map((listing) => listing.id),
    ["a1", "b1", "c1", "d1"],
  );
  assert.deepEqual(
    selectDiverseListings(candidates, 6, 2).map((listing) => listing.id),
    ["a1", "b1", "c1", "d1", "a2", "b2"],
  );
  assert.deepEqual(selectDiverseListings(candidates, 20, 2).length, candidates.length);
});

test("latest discovery excludes showcased ids and uses diverse standard real cards", () => {
  assert.match(home, /const featuredListingIds = new Set/);
  assert.match(home, /!featuredListingIds\.has\(listing\.id\)/);
  assert.match(home, /selectDiverseListings\(/);
  assert.match(home, /12,\s*2,/);
  assert.match(latest, /<RealListingCard key=\{listing\.id\} listing=\{listing\}/);
});

test("populated cards guard mobile density, long copy, and image crop", () => {
  assert.match(visualPolishCss, /\.rawaj-featured-card__content h3/);
  assert.match(visualPolishCss, /-webkit-line-clamp: [23]/);
  assert.match(visualPolishCss, /\.rawaj-featured-card__location span/);
  assert.match(visualPolishCss, /text-overflow: ellipsis/);
  assert.match(visualPolishCss, /object-position: center/);
  assert.match(visualPolishCss, /@media \(max-width: 767px\)/);
  assert.match(visualPolishCss, /min-height: (?:21\.5|24)rem/);
  assert.match(visualPolishCss, /@media \(min-width: 768px\)/);
  assert.match(visualPolishCss, /min-height: (?:30|34)rem/);
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
