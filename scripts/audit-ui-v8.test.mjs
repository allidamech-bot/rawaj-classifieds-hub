import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  routeStyles,
  corrections,
  homeCorrections,
  categoriesCorrections,
  ownerCorrections,
  studioCorrections,
  personalCorrections,
  adminCorrections,
  admin,
  adminOverview,
  adSlot,
  categoriesRoute,
  categoriesDiscovery,
  storefrontIdentity,
  ownerWorkspace,
] = await Promise.all([
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-audit-corrections-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-home-audit-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-categories-discovery-v8.css", import.meta.url), "utf8"),
  readFile(new URL("../src/owner-listings-workspace-v9.css", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-studio-audit-v9.css", import.meta.url), "utf8"),
  readFile(new URL("../src/personal-space-audit-v9.css", import.meta.url), "utf8"),
  readFile(new URL("../src/admin-command-center-v9.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.index.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/categories/CategoriesListingDiscovery.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/storefront/StorefrontIdentityHero.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/storefront/OwnerStoreWorkspaceSummary.tsx", import.meta.url), "utf8"),
]);

test("audited component corrections load after legacy recovery layers", () => {
  const recoveryIndex = routeStyles.indexOf('import "../rawaj-page-by-page-recovery-v7b.css";');
  const correctionIndex = routeStyles.indexOf('import "../rawaj-audit-corrections-v8.css";');
  const homeIndex = routeStyles.indexOf('import "../rawaj-home-audit-v8.css";');
  const categoriesIndex = routeStyles.indexOf('import "../rawaj-categories-discovery-v8.css";');
  const ownerIndex = routeStyles.indexOf('import "../owner-listings-workspace-v9.css";');
  const studioIndex = routeStyles.indexOf('import "../listing-studio-audit-v9.css";');
  const personalIndex = routeStyles.indexOf('import "../personal-space-audit-v9.css";');
  const adminIndex = routeStyles.indexOf('import "../admin-command-center-v9.css";');

  for (const index of [
    recoveryIndex,
    correctionIndex,
    homeIndex,
    categoriesIndex,
    ownerIndex,
    studioIndex,
    personalIndex,
    adminIndex,
  ]) {
    assert.notEqual(index, -1);
  }
  assert.ok(correctionIndex > recoveryIndex);
  assert.ok(homeIndex > correctionIndex);
  assert.ok(categoriesIndex > correctionIndex);
  assert.ok(ownerIndex > categoriesIndex);
  assert.ok(studioIndex > ownerIndex);
  assert.ok(personalIndex > studioIndex);
  assert.ok(adminIndex > personalIndex);
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

test("owner workspace uses a compact management summary and prioritizes drafts", () => {
  assert.match(storefrontIdentity, /OwnerStoreWorkspaceSummary/);
  assert.match(storefrontIdentity, /if \(mode === "owner"\)/);
  assert.match(ownerWorkspace, /rawaj-owner-workspace-summary/);
  assert.match(ownerWorkspace, /approvedCount/);
  assert.match(ownerWorkspace, /needsEditCount/);
  assert.match(ownerCorrections, /rawaj-storefront-notice\[data-tone="draft"\][\s\S]*order: 1/);
  assert.match(ownerCorrections, /rawaj-owner-workspace-summary[\s\S]*order: 2/);
  assert.match(ownerCorrections, /a:has\(svg\.lucide-pencil\)[\s\S]*grid-column: 1 \/ -1/);
  assert.doesNotMatch(ownerCorrections, /main\s+:is\(section, article, form/);
});

test("listing creation and draft editing use one compact semantic studio", () => {
  assert.match(studioCorrections, /data-resolved-pathname="\/add-listing"/);
  assert.match(studioCorrections, /data-resolved-pathname\^="\/profile\/listings\/"/);
  assert.match(studioCorrections, /\.rawaj-studio-shell[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(18\.5rem, 21rem\)/);
  assert.match(studioCorrections, /\.rawaj-studio-completion\[data-ready="true"\]/);
  assert.match(studioCorrections, /\.rawaj-studio-quality li\[data-done="false"\]/);
  assert.match(studioCorrections, /\.rawaj-studio-preview[\s\S]*display: none !important/);
  assert.match(studioCorrections, /\.rawaj-studio-quality li\[data-done="true"\][\s\S]*display: none !important/);
  assert.match(studioCorrections, /\.rawaj-studio-action-bar[\s\S]*position: sticky !important/);
});

test("more and profile routes have explicit personal-space hierarchy", () => {
  assert.match(personalCorrections, /data-resolved-pathname="\/more"/);
  assert.match(personalCorrections, /data-resolved-pathname="\/profile"/);
  assert.match(personalCorrections, /rawaj-trust-hero\[data-mode="more"\]/);
  assert.match(personalCorrections, /rawaj-more-v2__sections[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(personalCorrections, /rawaj-account-identity__actions/);
  assert.match(personalCorrections, /rawaj-account-quick-links/);
  assert.match(personalCorrections, /button:last-child[\s\S]*color: #f2aaa4/);
  assert.doesNotMatch(personalCorrections, /main\s+:is\(section, article, form/);
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

test("admin command center separates hero metrics queues commands and shortcuts", () => {
  assert.match(adminOverview, /rawaj-admin-command-hero/);
  assert.match(adminOverview, /rawaj-admin-metrics-grid/);
  assert.match(adminOverview, /rawaj-admin-queue-grid/);
  assert.match(adminOverview, /rawaj-admin-command-grid/);
  assert.match(adminOverview, /rawaj-admin-quick-grid/);
  assert.match(adminOverview, /data-attention=\{attention\}/);
  assert.match(adminOverview, /data-active=\{value > 0\}/);
  assert.match(adminCorrections, /\.rawaj-admin-command-hero/);
  assert.match(adminCorrections, /\.rawaj-admin-metric-card\[data-attention="true"\]/);
  assert.match(adminCorrections, /\.rawaj-admin-queue-card\[data-active="true"\]/);
  assert.match(adminCorrections, /\.rawaj-admin-dashboard-state/);
  assert.doesNotMatch(adminCorrections, /main\s+:is\(section, article, form/);
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
