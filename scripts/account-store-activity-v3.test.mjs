import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  profile,
  ownerStore,
  seller,
  favorites,
  savedSearches,
  activity,
  notifications,
  more,
  personalCss,
  storefrontCss,
  ownerStoreCss,
  promotionRequest,
  v25Css,
  stabilityCss,
  packageJson,
] = await Promise.all([
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/favorites.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/saved-searches.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/more.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/personal-space-polish.css", import.meta.url), "utf8"),
  readFile(new URL("../src/seller-storefront-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/owner-listings-workspace-v9.css", import.meta.url), "utf8"),
  readFile(new URL("../src/features/storefront/CustomerPromotionRequestButton.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/rawaj-live-repair-sweep-v25.css", import.meta.url), "utf8"),
  readFile(new URL("../src/stability-accessibility-fixes.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("phase 6 scopes every account and activity surface without changing route behavior", () => {
  assert.match(profile, /rawaj-account-hub-v3/);
  assert.match(favorites, /rawaj-account-collection-v3/);
  assert.match(savedSearches, /rawaj-account-collection-v3/);
  assert.match(activity, /rawaj-account-activity-v3/);
  assert.match(notifications, /rawaj-account-activity-v3/);
  assert.match(more, /rawaj-account-command-v3/);
});

test("owner and public storefronts receive distinct premium identity scopes", () => {
  assert.match(ownerStore, /rawaj-account-store-v3/);
  assert.match(seller, /rawaj-seller-premium-v3/);
  assert.match(storefrontCss, /\.rawaj-storefront-identity__metrics/);
  assert.match(storefrontCss, /data-tone="rating"/);
  assert.match(storefrontCss, /--store-v3-coral/);
  assert.match(ownerStoreCss, /\.rawaj-owner-workspace-summary__completeness/);
  assert.match(ownerStoreCss, /\.rawaj-owner-listings-toolbar__advanced/);
});

test("customer paid promotion intake is exposed beside Boost for approved store listings", () => {
  assert.match(ownerStore, /CustomerPromotionRequestButton/);
  assert.match(
    ownerStore,
    /listing\.status === "approved"[\s\S]*?<CustomerPromotionRequestButton listing=\{listing\}/,
  );
  assert.match(promotionRequest, /createMySupportRequest/);
  assert.match(promotionRequest, /relatedListingId:\s*listing\.id/);
  assert.match(promotionRequest, /createPortal\(/);
  for (const target of [
    "home",
    "search_results",
    "categories",
    "listing_detail",
    "offers",
    "campaign",
  ]) {
    assert.match(promotionRequest, new RegExp(`id: "${target}"`));
  }
  assert.doesNotMatch(
    promotionRequest,
    /ownerSaveAdPlacement|ownerSaveCampaign|createSearchBoostRequest/,
  );
});

test("native search-field light surfaces are suppressed by the final dark repair layer", () => {
  assert.match(v25Css, /input\[type="search"\]/);
  assert.match(v25Css, /appearance:\s*none !important/);
  assert.match(v25Css, /background:\s*transparent !important/);
  assert.match(v25Css, /:-webkit-autofill/);
  assert.match(v25Css, /::-webkit-search-cancel-button/);
  assert.match(stabilityCss, /rawaj-live-repair-sweep-v25\.css/);
});

test("account collections use structural borders, clear actions, focus states, and restrained motion", () => {
  assert.match(personalCss, /--account-v3-coral/);
  assert.match(personalCss, /background:\s*var\(--account-v3-coral\)/);
  assert.match(personalCss, /border:\s*1px solid var\(--account-v3-line\)/);
  assert.match(personalCss, /:focus-visible/);
  assert.match(personalCss, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(personalCss, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(personalCss, /translateY\(-2px\)/);
});

test("phase 6 contract is part of the permanent precheck", () => {
  const parsed = JSON.parse(packageJson);
  assert.equal(
    parsed.scripts["test:account-store-activity-v3"],
    "node --test scripts/account-store-activity-v3.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:account-store-activity-v3/);
});
