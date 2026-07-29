import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  routeStyles,
  corrections,
  homeCorrections,
  categoriesCorrections,
  admin,
  adSlot,
  categoriesRoute,
  categoriesDiscovery,
] = await Promise.all([
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-audit-corrections-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-home-audit-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-categories-discovery-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/categories/CategoriesListingDiscovery.tsx", import.meta.url), "utf8"),
]);

test("audited component corrections load after legacy recovery layers", () => {
  const recoveryIndex = routeStyles.indexOf('import "../rawaj-page-by-page-recovery-v7b.css";');
  const correctionIndex = routeStyles.indexOf('import "../rawaj-audit-corrections-v8.css";');
  const homeIndex = routeStyles.indexOf('import "../rawaj-home-audit-v8.css";');
  const categoriesIndex = routeStyles.indexOf('import "../rawaj-categories-discovery-v8.css";');

  assert.notEqual(recoveryIndex, -1);
  assert.notEqual(correctionIndex, -1);
  assert.notEqual(homeIndex, -1);
  assert.notEqual(categoriesIndex, -1);
  assert.ok(correctionIndex > recoveryIndex);
  assert.ok(homeIndex > correctionIndex);
  assert.ok(categoriesIndex > correctionIndex);
});

test("shell owns bottom navigation reserve without route-level double spacing", () => {
  assert.match(
    corrections,
    /data-shell-dock="true"[\s\S]*padding-bottom: calc\(var\(--dock-height\) \+ var\(--safe-bottom\) \+ 0\.45rem\)/,
  );
  assert.match(
    corrections,
    /main\.mobile-page-bottom[\s\S]*padding-bottom: clamp\(1rem, 2\.5vw, 1\.75rem\)/,
  );
  assert.doesNotMatch(corrections, /main\s+:is\(section, article, form/);
  assert.match(homeCorrections, /\.rawaj-signature-home[\s\S]*min-height: auto !important/);
});

test("footer and personal-space corrections retain readable semantic contrast", () => {
  assert.match(corrections, /\.rawaj-site-footer__mobile nav a/);
  assert.match(corrections, /font-size: 0\.78rem !important/);
  assert.match(corrections, /rawaj-world-orange/);
  assert.match(corrections, /rawaj-world-indigo/);
  assert.match(corrections, /rawaj-account-section\[data-tone="muted"\]/);
});

test("owner listing and listing studio surfaces have explicit compact hierarchy", () => {
  assert.match(corrections, /rawaj-storefront-identity\[data-mode="owner"\]/);
  assert.match(corrections, /rawaj-storefront-identity__metrics/);
  assert.match(corrections, /\.rawaj-studio-completion/);
  assert.match(corrections, /\.rawaj-studio-preview/);
  assert.match(corrections, /\.rawaj-studio-quality/);
});

test("admin navigation exposes visible, labelled previous and next controls", () => {
  assert.match(admin, /rawaj-admin-nav-controls/);
  assert.match(admin, /rawaj-admin-nav-scroll-button/);
  assert.match(admin, /scrollAdminNavigation\("previous"\)/);
  assert.match(admin, /scrollAdminNavigation\("next"\)/);
  assert.match(admin, /Previous admin workspaces/);
  assert.match(admin, /Next admin workspaces/);
  assert.match(corrections, /rawaj-admin-nav-rail > a\[aria-current="page"\]::after/);
});

test("home advertisement inventory supports two unique records without cloning one record", () => {
  assert.match(adSlot, /function uniquePlacements/);
  assert.match(adSlot, /placementPage === "home" \? 2 : 1/);
  assert.match(adSlot, /visiblePlacements\.map/);
  assert.doesNotMatch(adSlot, /placement: result\.data\[0\]/);
  assert.match(homeCorrections, /\.rawaj-signature-ad-placement[\s\S]*order: 30/);
});

test("categories directory continues into promoted and latest approved inventory", () => {
  assert.match(categoriesRoute, /CategoriesListingDiscovery/);
  assert.match(categoriesRoute, /resolveTaxonomyFilterScope/);
  assert.match(categoriesRoute, /taxonomyNodeIds: scope\.taxonomyNodeIds/);
  assert.match(categoriesDiscovery, /sort: "featured"/);
  assert.match(categoriesDiscovery, /sort: "latest"/);
  assert.match(categoriesDiscovery, /filter\(\(listing\) => listing\.isFeatured\)/);
  assert.match(categoriesDiscovery, /nextCursor/);
  assert.match(categoriesDiscovery, /loadMore/);
  assert.match(categoriesCorrections, /rawaj-categories-discovery__promoted-grid/);
  assert.match(categoriesCorrections, /rawaj-categories-discovery__latest-grid/);
});
