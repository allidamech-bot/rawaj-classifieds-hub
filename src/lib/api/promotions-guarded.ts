import {
  adminFetchPromotionRequests,
  adminModeratePromotionRequest as baseAdminModeratePromotionRequest,
  createListingPromotionRequest as baseCreateListingPromotionRequest,
  createPromotionReceiptSignedUrl,
  fetchMyPromotionRequests,
  uploadPromotionReceipt as baseUploadPromotionReceipt,
} from "@/lib/api/promotions";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

const pendingPromotionCreates = new Map<
  string,
  ReturnType<typeof baseCreateListingPromotionRequest>
>();
const pendingPromotionUploads = new Map<string, ReturnType<typeof baseUploadPromotionReceipt>>();
const pendingPromotionModeration = new Map<
  string,
  ReturnType<typeof baseAdminModeratePromotionRequest>
>();

export function createListingPromotionRequest(
  payload: Parameters<typeof baseCreateListingPromotionRequest>[0],
) {
  const key = JSON.stringify([
    payload.requesterUserId ?? "anonymous",
    payload.listingId.trim(),
    payload.promotionType,
    payload.requestedDays,
    payload.paymentMethod?.trim() ?? "",
    payload.paymentReference?.trim() ?? "",
    payload.proofPath?.trim() ?? "",
  ]);
  return runDeduplicatedRequest(key, pendingPromotionCreates, () =>
    baseCreateListingPromotionRequest(payload),
  );
}

export function uploadPromotionReceipt(payload: Parameters<typeof baseUploadPromotionReceipt>[0]) {
  const key = JSON.stringify([
    payload.userId ?? "anonymous",
    payload.requestId.trim(),
    payload.file.name,
    payload.file.size,
    payload.file.type,
    payload.file.lastModified,
  ]);
  return runDeduplicatedRequest(key, pendingPromotionUploads, () =>
    baseUploadPromotionReceipt(payload),
  );
}

export function adminModeratePromotionRequest(
  canUseAdminAccess: boolean,
  payload: Parameters<typeof baseAdminModeratePromotionRequest>[1],
) {
  const key = JSON.stringify([
    canUseAdminAccess,
    payload.requestId.trim(),
    payload.status,
    payload.adminNote?.trim() ?? "",
    payload.expectedUpdatedAt,
  ]);
  return runDeduplicatedRequest(key, pendingPromotionModeration, () =>
    baseAdminModeratePromotionRequest(canUseAdminAccess, payload),
  );
}

export { adminFetchPromotionRequests, createPromotionReceiptSignedUrl, fetchMyPromotionRequests };
