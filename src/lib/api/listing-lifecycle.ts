import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { getClient, mapError } from "@/lib/api/shared";
import type {
  ClassifiedListing,
  ClassifiedsResult,
} from "@/lib/classifieds-types";

export type OwnerCloseListingStatus = "sold" | "rented" | "unavailable";

async function transitionOwnerListing(
  userId: string | null,
  listingId: string,
  currentStatuses: string[],
  targetStatus: OwnerCloseListingStatus | "pending_review",
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لتحديث حالة الإعلان.",
      },
    };
  }

  if (!listingId.trim()) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد الإعلان المطلوب.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const reviewReset =
    targetStatus === "pending_review"
      ? {
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
        }
      : {};

  const { data, error } = await clientResult.data
    .from("listings")
    .update({ status: targetStatus, ...reviewReset })
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", currentStatuses)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "تعذر تغيير حالة الإعلان. ربما تغيرت حالته أو لم تعد العملية متاحة.",
      },
    };
  }

  return fetchOwnerListingDetail(userId, listingId);
}

export function closeOwnerListing(
  userId: string | null,
  listingId: string,
  targetStatus: OwnerCloseListingStatus,
) {
  return transitionOwnerListing(
    userId,
    listingId,
    ["approved"],
    targetStatus,
  );
}

export function reactivateOwnerListing(
  userId: string | null,
  listingId: string,
) {
  return transitionOwnerListing(
    userId,
    listingId,
    ["sold", "rented", "unavailable", "expired"],
    "pending_review",
  );
}
