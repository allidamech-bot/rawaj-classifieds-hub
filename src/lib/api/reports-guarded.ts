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
  userId: Parameters<typeof baseCreateListingReport>[0],
  listingId: string,
  reportType: Parameters<typeof baseCreateListingReport>[2],
  reason: string,
) {
  const cleanListingId = listingId.trim();
  const cleanReason = reason.trim();
  const key = JSON.stringify([userId ?? "anonymous", cleanListingId, reportType, cleanReason]);
  return runDeduplicatedRequest(key, pendingListingReports, () =>
    baseCreateListingReport(userId, cleanListingId, reportType, cleanReason),
  );
}

export function adminModerateReport(
  canUseAdminAccess: boolean,
  payload: Parameters<typeof baseAdminModerateReport>[1],
) {
  const key = JSON.stringify([
    canUseAdminAccess,
    payload.reportId.trim(),
    payload.status,
    payload.assignedTo ?? "",
    payload.adminNote?.trim() ?? "",
    payload.resolvedAt ?? "",
    payload.expectedUpdatedAt,
  ]);
  return runDeduplicatedRequest(key, pendingReportModeration, () =>
    baseAdminModerateReport(canUseAdminAccess, payload),
  );
}

export { adminFetchPendingListings, adminFetchReports, fromDbReportStatus, toDbReportStatus };
