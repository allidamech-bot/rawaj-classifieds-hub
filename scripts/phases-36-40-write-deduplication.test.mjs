import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [api, helper, favorites, savedSearches, promotions, reports, support, moderation] =
  await Promise.all([
    readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/request-dedup.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/favorites-guarded.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/saved-searches-guarded.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/promotions-guarded.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/reports-guarded.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/support-guarded.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/lib/api/admin-listing-moderation-guarded.ts", import.meta.url),
      "utf8",
    ),
  ]);

test("phase 36 to 40 writes use one shared in-flight deduplication contract", () => {
  assert.match(helper, /runDeduplicatedRequest/);
  assert.match(helper, /const pending = requests\.get\(key\)/);
  assert.match(helper, /if \(pending\) return pending/);
  assert.match(helper, /requests\.delete\(key\)/);
});

test("favorites and saved searches route through guarded APIs", () => {
  assert.match(api, /favorites-guarded/);
  assert.match(api, /saved-searches-guarded/);
  assert.match(favorites, /pendingFavoriteWrites/);
  assert.match(favorites, /baseFavoriteListing/);
  assert.match(favorites, /baseUnfavoriteListing/);
  assert.match(savedSearches, /pendingSavedSearchWrites/);
  assert.match(savedSearches, /baseCreateSavedSearch/);
  assert.match(savedSearches, /baseUpdateSavedSearchAlertFrequency/);
  assert.match(savedSearches, /baseDeleteSavedSearch/);
});

test("promotion, report, support, and admin moderation writes are guarded", () => {
  assert.match(api, /promotions-guarded/);
  assert.match(api, /reports-guarded/);
  assert.match(api, /support-guarded/);
  assert.match(api, /admin-listing-moderation-guarded/);
  assert.match(promotions, /pendingPromotionCreates/);
  assert.match(promotions, /pendingPromotionUploads/);
  assert.match(promotions, /pendingPromotionModeration/);
  assert.match(reports, /pendingListingReports/);
  assert.match(reports, /pendingReportModeration/);
  assert.match(support, /pendingSupportRequests/);
  assert.match(support, /pendingAccountDeletionRequests/);
  assert.match(moderation, /pendingAdminListingModeration/);
});
