import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  appShell,
  backToTop,
  bottomDock,
  scrollUtils,
  router,
  routeStyles,
  css,
  listingsRoute,
  listingPreferences,
  listingHistory,
  cardShared,
  ownerListings,
  sellerComponents,
  recentAccount,
  moreRoute,
  localDraft,
  addListing,
  unsavedWarning,
  profileRoute,
  offlineNotice,
  uiPreferences,
] = await Promise.all(
  [
    "../src/components/shell/AppShell.tsx",
    "../src/components/BackToTop.tsx",
    "../src/components/shell/BottomDock.tsx",
    "../src/lib/scroll-utils.ts",
    "../src/router.tsx",
    "../src/lib/route-styles.ts",
    "../src/lightweight-mobile-ux-polish.css",
    "../src/routes/listings.index.tsx",
    "../src/lib/listing-browsing-preferences.ts",
    "../src/lib/listing-history.ts",
    "../src/features/listings/cards/ListingCardShared.tsx",
    "../src/routes/profile/listings.tsx",
    "../src/features/listings/listings-components.tsx",
    "../src/features/retention/AccountRecentlyViewed.tsx",
    "../src/routes/more.tsx",
    "../src/lib/local-listing-draft.ts",
    "../src/routes/add-listing.tsx",
    "../src/lib/use-unsaved-changes-warning.ts",
    "../src/routes/profile.tsx",
    "../src/components/OfflineNotice.tsx",
    "../src/lib/ui-preferences.tsx",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);

test("one lightweight back-to-top control respects motion and obstruction contracts", () => {
  assert.match(appShell, /<BackToTop \/>/);
  assert.match(backToTop, /REVEAL_OFFSET = 700/);
  assert.match(backToTop, /requestAnimationFrame/);
  assert.match(backToTop, /\{ passive: true \}/);
  assert.match(backToTop, /tabIndex=\{visible \? 0 : -1\}/);
  assert.match(scrollUtils, /prefers-reduced-motion: reduce/);
  assert.match(css, /--rawaj-floating-bottom/);
  assert.match(css, /data-shell-sticky-action="true"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("mobile navigation re-tap scrolls without duplicate navigation", () => {
  assert.match(bottomDock, /if \(!active \|\| item\.primary\) return/);
  assert.match(bottomDock, /event\.preventDefault\(\)/);
  assert.match(bottomDock, /scrollPageToTop\(\)/);
  assert.match(bottomDock, /item\.primary/);
});

test("router restoration and explicit URL preference precedence remain intact", () => {
  assert.match(router, /scrollRestoration: true/);
  assert.match(listingPreferences, /rawaj:listing-browsing-preferences:v1/);
  assert.match(listingsRoute, /search\.sort \?\? storedPreferences\.sort/);
  assert.match(listingsRoute, /search\.view \?\? storedPreferences\.view/);
  assert.match(listingsRoute, /writeListingBrowsingPreferences\(\{ sort, view \}\)/);
});

test("viewed history is bounded and account history uses one batch endpoint", () => {
  assert.match(listingHistory, /MAX_LISTING_HISTORY = 50/);
  assert.match(listingHistory, /filter\(\(entry\) => entry\.listingId !== cleanListingId\)/);
  assert.match(cardShared, /useIsListingViewed/);
  assert.match(cardShared, /rawaj-adaptive-card__viewed/);
  assert.match(recentAccount, /fetchRecentListingViews\(userId, 10\)/);
  assert.match(recentAccount, /clearRecentListingViews\(userId\)/);
  assert.match(moreRoute, /<AccountRecentlyViewed/);
  assert.doesNotMatch(recentAccount, /fetchCloudflareListingDetail/);
});

test("marketplace images use resilient shared fallbacks", () => {
  assert.match(ownerListings, /<ListingCardImage/);
  assert.match(sellerComponents, /<ResilientImage/);
  assert.match(sellerComponents, /width=\{48\}/);
  assert.match(sellerComponents, /height=\{48\}/);
});

test("local drafts are scoped, bounded, debounced, and never persist image data", () => {
  assert.match(localDraft, /rawaj:add-listing-draft:v1:/);
  assert.match(localDraft, /MAX_AGE_MS/);
  assert.match(localDraft, /encodeURIComponent\(userId\)/);
  assert.doesNotMatch(localDraft, /\bfile(s)?\b|\bblob\b|base64|objectUrl/i);
  assert.match(addListing, /window\.setTimeout\(\(\) => \{/);
  assert.match(addListing, /\}, 800\)/);
  assert.match(addListing, /restoreLocalDraft/);
  assert.match(addListing, /discardLocalDraft/);
  assert.match(addListing, /clearLocalListingDraft\(localDraftUserId\)/);
});

test("dirty forms, invalid focus, and duplicate submission guards are explicit", () => {
  assert.match(unsavedWarning, /useBlocker/);
  assert.match(unsavedWarning, /enableBeforeUnload/);
  assert.match(addListing, /useUnsavedChangesWarning/);
  assert.match(profileRoute, /useUnsavedChangesWarning/);
  assert.match(addListing, /focus\(\{ preventScroll: true \}\)/);
  assert.match(addListing, /prefersReducedMotion/);
  assert.match(addListing, /if \(submittingRef\.current\) return/);
  assert.match(addListing, /aria-busy=\{submitting\}/);
});

test("dark surfaces, safe-area, overflow, offline, and final CSS ordering are protected", () => {
  assert.match(routeStyles, /lightweight-mobile-ux-polish\.css/);
  assert.ok(
    routeStyles.lastIndexOf("lightweightMobileUxPolishCss") >
      routeStyles.lastIndexOf("footerContrastSystemV13Css"),
  );
  assert.match(css, /\.rawaj-admin-nav-shell/);
  assert.match(css, /\.rawaj-storefront-owner-tabs/);
  assert.match(css, /main\.mobile-page-bottom/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /-webkit-line-clamp: 2/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(ownerListings, /role="tablist"/);
  assert.match(ownerListings, /aria-selected=\{active\}/);
  assert.match(offlineNotice, /No internet connection/);
  assert.match(offlineNotice, /rawaj-offline-notice/);
  assert.match(appShell, /<OfflineNotice \/>/);
  assert.match(uiPreferences, /preferencesHydrated/);
  assert.match(uiPreferences, /if \(!preferencesHydrated\) return/);
});
