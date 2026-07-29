import {
  adminFetchPendingListings,
  adminFetchReports,
  adminModerateReport as baseAdminModerateReport,
  createListingReport as baseCreateListingReport,
  fromDbReportStatus,
  toDbReportStatus,
} from "@/lib/api/reports";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

const pendingListingReports = new Map<string, ReturnType<typeof baseCreateListingReport>>();
const pendingReportModeration = new Map<string, ReturnType<typeof baseAdminModerateReport>>();

export function createListingReport(
  listingId: string,
  reportType: Parameters<typeof baseCreateListingReport>[1],
  reason: string,
) {
  const cleanListingId = listingId.trim();
  const cleanReason = reason.trim();
  const key = JSON.stringify([cleanListingId, reportType, cleanReason]);
  return runDeduplicatedRequest(key, pendingListingReports, () =>
    baseCreateListingReport(cleanListingId, reportType, cleanReason),
  );
}

export function adminModerateReport(payload: Parameters<typeof baseAdminModerateReport>[0]) {
  const key = JSON.stringify([
    payload.reportId.trim(),
    payload.status,
    payload.adminNote?.trim() ?? "",
    payload.expectedUpdatedAt,
  ]);
  return runDeduplicatedRequest(key, pendingReportModeration, () =>
    baseAdminModerateReport(payload),
  );
}

export { adminFetchPendingListings, adminFetchReports, fromDbReportStatus, toDbReportStatus };
