import type { ClassifiedsResult } from "@/lib/classifieds-types";

export interface SavedSearchAlertScanSummary {
  checkedSearches: number;
  matchedListings: number;
  createdNotifications: number;
  skippedSearches: number;
  checkedAt: string;
}

/**
 * Alert matching is executed by the backend scheduler. Browser navigation must
 * never scan all searches, create notifications, or perform database writes.
 */
export async function scanDueSavedSearchAlerts(
  userId: string | null,
  _force = false,
): Promise<ClassifiedsResult<SavedSearchAlertScanSummary>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لفحص تنبيهات البحث المحفوظ." },
    };
  }

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
