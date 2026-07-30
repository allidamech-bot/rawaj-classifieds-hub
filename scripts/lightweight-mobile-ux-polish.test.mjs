import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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
  addListingDirtyState,
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
    "../src/lib/add-listing-dirty-state.ts",
    "../src/lib/use-unsaved-changes-warning.ts",
    "../src/routes/profile.tsx",
    "../src/components/OfflineNotice.tsx",
    "../src/lib/ui-preferences.tsx",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
);

async function importTypeScriptModule(source, replacements = []) {
  const prepared = replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    source,
  );
  const transpiled = ts.transpileModule(prepared, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);
}

function createFakeHistoryWindow() {
  const values = new Map();
  const listeners = new Map();
  const added = new Map();
  const removed = new Map();
  let storageReads = 0;

  const emit = (type, event) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };

  return {
    values,
    added,
    removed,
    get storageReads() {
      return storageReads;
    },
    localStorage: {
      getItem(key) {
        storageReads += 1;
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
      removeItem(key) {
        values.delete(key);
      },
    },
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? new Set();
      current.add(listener);
      listeners.set(type, current);
      added.set(type, (added.get(type) ?? 0) + 1);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
      removed.set(type, (removed.get(type) ?? 0) + 1);
    },
    dispatchEvent(event) {
      emit(event.type, event);
      return true;
    },
    emit,
  };
}

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

test("listing cards share one browser subscription and one parsed history cache", async (t) => {
  const fakeWindow = createFakeHistoryWindow();
  const previousWindow = globalThis.window;
  globalThis.window = fakeWindow;
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const history = await importTypeScriptModule(listingHistory, [
    [
      'import { useSyncExternalStore } from "react";',
      "const useSyncExternalStore = () => false;",
    ],
  ]);
  const storageKey = "rawaj:listing-history:v1";

  assert.equal(history.getListingViewedSnapshot("listing-1"), false);
  const readsAfterFirstSnapshot = fakeWindow.storageReads;
  let notifications = 0;
  const unsubscribers = Array.from({ length: 80 }, (_, index) =>
    history.subscribeToListingHistory(() => {
      notifications += 1;
      history.getListingViewedSnapshot(`listing-${index}`);
    }),
  );

  assert.equal(fakeWindow.added.get("storage"), 1);
  assert.equal(fakeWindow.added.get("rawaj:listing-history-change"), 1);
  assert.equal(fakeWindow.storageReads, readsAfterFirstSnapshot + 1);
  const readsAfterSubscriptions = fakeWindow.storageReads;

  history.recordLocalListingView("listing-1");
  assert.equal(notifications, 80);
  assert.equal(fakeWindow.storageReads, readsAfterSubscriptions + 1);
  assert.equal(history.getListingViewedSnapshot("listing-1"), true);
  assert.equal(history.readLocalListingHistory().length, 1);

  history.clearLocalListingHistory();
  assert.equal(notifications, 160);
  assert.equal(fakeWindow.storageReads, readsAfterSubscriptions + 2);
  assert.equal(history.getListingViewedSnapshot("listing-1"), false);
  assert.deepEqual(history.readLocalListingHistory(), []);

  const crossTabValue = JSON.stringify([
    { listingId: "listing-2", viewedAt: "2026-07-30T12:00:00.000Z" },
  ]);
  fakeWindow.values.set(storageKey, crossTabValue);
  fakeWindow.emit("storage", {
    key: storageKey,
    newValue: crossTabValue,
  });
  assert.equal(notifications, 240);
  assert.equal(fakeWindow.storageReads, readsAfterSubscriptions + 2);
  assert.equal(history.getListingViewedSnapshot("listing-2"), true);

  unsubscribers.forEach((unsubscribe) => unsubscribe());
  assert.equal(fakeWindow.removed.get("storage"), 1);
  assert.equal(fakeWindow.removed.get("rawaj:listing-history-change"), 1);
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

test("server-autosaved fields still block navigation for an unpersisted local image", async () => {
  const dirtyState = await importTypeScriptModule(addListingDirtyState);
  const savedFieldsWithPendingImage = dirtyState.getAddListingDirtyState({
    hasMeaningfulServerChanges: true,
    autosaveState: "saved",
    draftId: "draft-1",
    draftStatus: "draft",
    submitting: false,
    images: [{ state: "pending" }],
  });

  assert.equal(savedFieldsWithPendingImage.unsavedServerChanges, false);
  assert.equal(savedFieldsWithPendingImage.unsavedLocalImageChanges, true);
  assert.equal(savedFieldsWithPendingImage.shouldBlockNavigation, true);

  for (const state of ["uploading", "failed"]) {
    assert.equal(
      dirtyState.getAddListingDirtyState({
        hasMeaningfulServerChanges: true,
        autosaveState: "saved",
        draftId: "draft-1",
        draftStatus: "draft",
        submitting: false,
        images: [{ state }],
      }).shouldBlockNavigation,
      true,
    );
  }
});

test("persisted, removed, submitted, or actively submitting images do not warn", async () => {
  const dirtyState = await importTypeScriptModule(addListingDirtyState);
  const base = {
    hasMeaningfulServerChanges: true,
    autosaveState: "saved",
    draftId: "draft-1",
    draftStatus: "draft",
    submitting: false,
  };

  assert.equal(
    dirtyState.getAddListingDirtyState({
      ...base,
      images: [
        {
          state: "uploaded",
          uploadedImage: { id: "image-1", listingId: "draft-1" },
        },
      ],
    }).shouldBlockNavigation,
    false,
  );
  assert.equal(
    dirtyState.getAddListingDirtyState({
      ...base,
      images: [
        {
          state: "uploaded",
          uploadedImage: { id: "image-2", listingId: "different-draft" },
        },
      ],
    }).shouldBlockNavigation,
    true,
  );
  assert.equal(
    dirtyState.getAddListingDirtyState({ ...base, images: [] }).shouldBlockNavigation,
    false,
  );
  assert.equal(
    dirtyState.getAddListingDirtyState({
      ...base,
      submitting: true,
      images: [{ state: "pending" }],
    }).shouldBlockNavigation,
    false,
  );
  assert.equal(
    dirtyState.getAddListingDirtyState({
      ...base,
      draftStatus: "pending_review",
      images: [{ state: "pending" }],
    }).shouldBlockNavigation,
    false,
  );
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
  assert.match(ownerListings, /role="group"/);
  assert.match(ownerListings, /aria-pressed=\{active\}/);
  assert.doesNotMatch(ownerListings, /role="tablist"|role="tab"|aria-selected=\{active\}/);
  assert.match(offlineNotice, /No internet connection/);
  assert.match(offlineNotice, /rawaj-offline-notice/);
  assert.match(appShell, /<OfflineNotice \/>/);
  assert.match(uiPreferences, /preferencesHydrated/);
  assert.match(uiPreferences, /if \(!preferencesHydrated\) return/);
});
