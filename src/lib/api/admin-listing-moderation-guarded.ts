import {
  adminApplyListingModerationAction as baseAdminApplyListingModerationAction,
  adminFetchModerationListings,
} from "@/lib/api/admin-listing-moderation";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

export type {
  AdminListingModerationAction,
  AdminListingModerationPayload,
  AdminListingModerationResult,
  AdminModerationListingSummary,
} from "@/lib/api/admin-listing-moderation";

const pendingAdminListingModeration = new Map<
  string,
  ReturnType<typeof baseAdminApplyListingModerationAction>
>();

export function adminApplyListingModerationAction(
  canUseAdminAccess: boolean,
  payload: Parameters<typeof baseAdminApplyListingModerationAction>[1],
) {
  const key = JSON.stringify([
    canUseAdminAccess,
    payload.listingId.trim(),
    payload.action,
    payload.reason.trim(),
    payload.expectedUpdatedAt,
    payload.extendDays ?? null,
  ]);
  return runDeduplicatedRequest(key, pendingAdminListingModeration, () =>
    baseAdminApplyListingModerationAction(canUseAdminAccess, payload),
  );
}

export { adminFetchModerationListings };
