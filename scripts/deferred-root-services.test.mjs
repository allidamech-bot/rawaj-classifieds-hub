import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, scanner, comparisonCore, comparisonDock, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../src/features/saved-searches/SavedSearchAlertBackgroundScanner.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/features/comparison/listing-comparison.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/comparison/ListingComparisonDock.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("route-only announcements are lazy and mounted only on matching paths", () => {
  assert.doesNotMatch(
    root,
    /import \{ DraftRecoveryBanner \} from "@\/features\/listing-studio\/DraftRecoveryBanner"/,
  );
  assert.doesNotMatch(
    root,
    /import \{ ViewedBeforeBanner \} from "@\/features\/listing-detail\/ViewedBeforeBanner"/,
  );
  assert.doesNotMatch(
    root,
    /import \{ ExistingConversationBanner \} from "@\/features\/listing-detail\/ExistingConversationBanner"/,
  );
  assert.match(root, /LazyDraftRecoveryBanner = lazy/);
  assert.match(root, /import\("@\/features\/listing-studio\/DraftRecoveryBanner"\)/);
  assert.match(root, /LazyViewedBeforeBanner = lazy/);
  assert.match(root, /import\("@\/features\/listing-detail\/ViewedBeforeBanner"\)/);
  assert.match(root, /LazyExistingConversationBanner = lazy/);
  assert.match(root, /import\("@\/features\/listing-detail\/ExistingConversationBanner"\)/);
  assert.match(root, /function DeferredRouteAnnouncements/);
  assert.match(root, /if \(!showDraftRecovery && !listingDetailId\) return null/);
  assert.match(root, /showDraftRecovery \? <LazyDraftRecoveryBanner \/>/);
  assert.match(root, /<LazyViewedBeforeBanner listingId=\{listingDetailId\} \/>/);
  assert.match(root, /<LazyExistingConversationBanner listingId=\{listingDetailId\} \/>/);
});

test("account background services stay outside the signed-out public bundle", () => {
  assert.doesNotMatch(
    root,
    /import \{ SavedSearchAlertBackgroundScanner \} from "@\/features\/saved-searches\/SavedSearchAlertBackgroundScanner"/,
  );
  assert.match(root, /LazySavedSearchAlertBackgroundScanner = lazy/);
  assert.match(root, /import\("@\/features\/saved-searches\/SavedSearchAlertBackgroundScanner"\)/);
  assert.match(root, /function DeferredAccountBackgroundServices/);
  assert.match(root, /auth\.status !== "signedIn" \|\| !profileId/);
  assert.match(root, /<LazySavedSearchAlertBackgroundScanner key=\{profileId\} \/>/);
  assert.match(scanner, /<PushNotificationBridge \/>/);
  assert.ok(
    root.indexOf("<UnreadActivityProvider>") <
      root.indexOf("<DeferredAccountBackgroundServices />"),
  );
});

test("comparison keeps state eager but loads the dialog workspace only when entries exist", () => {
  assert.match(root, /ListingComparisonProvider/);
  assert.match(root, /useListingComparison/);
  assert.match(root, /LazyListingComparisonDock = lazy/);
  assert.match(root, /import\("@\/features\/comparison\/ListingComparisonDock"\)/);
  assert.match(root, /function ListingComparisonDockBoundary/);
  assert.match(root, /if \(entries\.length === 0\) return null/);
  assert.match(root, /<LazyListingComparisonDock \/>/);
  assert.doesNotMatch(comparisonCore, /@\/components\/ui\/dialog/);
  assert.doesNotMatch(comparisonCore, /ListingCardImage/);
  assert.doesNotMatch(comparisonCore, /function ListingComparisonDock/);
  assert.match(comparisonDock, /@\/components\/ui\/dialog/);
  assert.match(comparisonDock, /ListingCardImage/);
  assert.match(comparisonDock, /export default function ListingComparisonDock/);
});

test("deferred services preserve Suspense fallbacks and the shared comparison provider", () => {
  assert.match(root, /import \{ Suspense, lazy, useEffect, type ReactNode \} from "react"/);
  assert.match(root, /<Suspense fallback=\{null\}>/);
  assert.match(root, /<ListingComparisonProvider>/);
  assert.ok(root.indexOf("<ListingComparisonProvider>") < root.indexOf("<Outlet />"));
  assert.ok(root.indexOf("<Outlet />") < root.indexOf("<ListingComparisonDockBoundary />"));
});

test("quality gate permanently enforces deferred root services read-only", () => {
  assert.match(qualityGate, /Deferred root services contract/);
  assert.match(qualityGate, /node --test scripts\/deferred-root-services\.test\.mjs/);
  assert.match(qualityGate, /contents: read/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
