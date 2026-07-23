import { fetchNotificationPreferences } from "@/lib/api/notification-preferences";
import { fetchPublicListingsCanonicalAware } from "@/lib/api/location-aware-listings-v2";
import {
  fetchSavedSearches,
  recordSavedSearchAlertMatch,
  touchSavedSearchAlertChecked,
} from "@/lib/api/saved-searches";
import { getClient, mapError, rowNumber, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult, SavedSearch } from "@/lib/classifieds-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

export interface SavedSearchAlertScanSummary {
  checkedSearches: number;
  matchedListings: number;
  createdNotifications: number;
  skippedSearches: number;
  checkedAt: string;
}

const MAX_SEARCHES_PER_SCAN = 10;
const MAX_MATCHES_PER_SEARCH = 20;

export async function scanDueSavedSearchAlerts(
  userId: string | null,
  force = false,
): Promise<ClassifiedsResult<SavedSearchAlertScanSummary>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لفحص تنبيهات البحث المحفوظ." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    return {
      ok: true,
      data: {
        checkedSearches: 0,
        matchedListings: 0,
        createdNotifications: 0,
        skippedSearches: 0,
        checkedAt: new Date().toISOString(),
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const serverFlush = await clientResult.data.rpc("rawaj_flush_my_saved_search_alerts_v2", {
    p_force: force,
  });
  if (!serverFlush.error) {
    const row = Array.isArray(serverFlush.data)
      ? (serverFlush.data[0] as Record<string, unknown> | undefined)
      : undefined;
    const checkedAt = rowString(row ?? {}, "checked_at", new Date().toISOString());
    return {
      ok: true,
      data: {
        checkedSearches: rowNumber(row ?? {}, "checked_searches", 0),
        matchedListings: rowNumber(row ?? {}, "matched_listings", 0),
        createdNotifications: rowNumber(row ?? {}, "created_notifications", 0),
        skippedSearches: rowNumber(row ?? {}, "skipped_searches", 0),
        checkedAt,
      },
    };
  }

  if (!isMissingServerFlush(serverFlush.error)) {
    return { ok: false, error: mapError(serverFlush.error) };
  }

  return scanDueSavedSearchAlertsLegacy(userId);
}

async function scanDueSavedSearchAlertsLegacy(
  userId: string,
): Promise<ClassifiedsResult<SavedSearchAlertScanSummary>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const checkedAt = new Date().toISOString();

  const preferencesResult = await fetchNotificationPreferences();
  if (!preferencesResult.ok) return preferencesResult;
  if (!preferencesResult.data.savedSearchMatchesEnabled) {
    return {
      ok: true,
      data: {
        checkedSearches: 0,
        matchedListings: 0,
        createdNotifications: 0,
        skippedSearches: 0,
        checkedAt,
      },
    };
  }

  const searchesResult = await fetchSavedSearches(userId);
  if (!searchesResult.ok) return searchesResult;

  const dueSearches = searchesResult.data
    .filter((search) => isSavedSearchAlertDue(search, Date.parse(checkedAt)))
    .slice(0, MAX_SEARCHES_PER_SCAN);

  let checkedSearches = 0;
  let matchedListings = 0;
  let createdNotifications = 0;

  for (const search of dueSearches) {
    const since = search.lastAlertCheckedAt ?? search.createdAt;
    const listingsResult = await fetchPublicListingsCanonicalAware(
      { ...search.filters, sort: "latest" },
      null,
      MAX_MATCHES_PER_SEARCH,
    );
    if (!listingsResult.ok) return listingsResult;

    const sinceTimestamp = Date.parse(since);
    const candidates = listingsResult.data.items.filter((listing) => {
      const createdTimestamp = Date.parse(listing.createdAt);
      return Number.isFinite(createdTimestamp) && createdTimestamp > sinceTimestamp;
    });

    matchedListings += candidates.length;
    for (const listing of candidates) {
      const recordResult = await recordSavedSearchAlertMatch(client, search.id, listing.id);
      if (!recordResult.ok) return recordResult;
      if (recordResult.data) createdNotifications += 1;
    }

    const touchResult = await touchSavedSearchAlertChecked(client, search.id, checkedAt);
    if (!touchResult.ok) return touchResult;
    checkedSearches += 1;
  }

  return {
    ok: true,
    data: {
      checkedSearches,
      matchedListings,
      createdNotifications,
      skippedSearches: Math.max(0, searchesResult.data.length - dueSearches.length),
      checkedAt,
    },
  };
}

function isMissingServerFlush(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("rawaj_flush_my_saved_search_alerts_v2")
  );
}

function isSavedSearchAlertDue(search: SavedSearch, now: number) {
  if (search.alertFrequency === "off") return false;
  const lastChecked = Date.parse(search.lastAlertCheckedAt ?? search.createdAt);
  if (!Number.isFinite(lastChecked)) return true;
  const cadenceMs =
    search.alertFrequency === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return now - lastChecked >= cadenceMs;
}
