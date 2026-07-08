import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { getClient, mapError } from "@/lib/api/shared";
import {
  publicListingExpiryFilter,
  resolveListingExpiryDate,
  type ListingExpiryOption,
} from "@/lib/api/listing-expiry";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";

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
  return transitionOwnerListing(userId, listingId, ["approved"], targetStatus);
}

export async function reactivateOwnerListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإعادة تفعيل الإعلان." },
    };
  }
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const payload = {
    status: "pending_review",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    expires_at: null,
  };

  let result = await clientResult.data
    .from("listings")
    .update(payload)
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .in("status", ["sold", "rented", "unavailable", "expired"])
    .select("id")
    .maybeSingle();

  if (!result.error && !result.data) {
    result = await clientResult.data
      .from("listings")
      .update(payload)
      .eq("id", cleanListingId)
      .eq("owner_id", userId)
      .eq("status", "approved")
      .lte("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
  }

  if (result.error) return { ok: false, error: mapError(result.error) };
  if (!result.data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "تعذر إعادة تفعيل الإعلان. ربما تغيرت حالته أو لم تعد العملية متاحة.",
      },
    };
  }
  return fetchOwnerListingDetail(userId, cleanListingId);
}

export async function setOwnerListingExpiry(
  userId: string | null,
  listingId: string,
  option: ListingExpiryOption,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث مدة الإعلان." },
    };
  }
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const now = new Date();
  const { data, error } = await clientResult.data
    .from("listings")
    .update({
      expiry_days: option === "never" ? null : option,
      expires_at: resolveListingExpiryDate(option, now),
      renewed_at: now.toISOString(),
    })
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .eq("status", "approved")
    .or(publicListingExpiryFilter(now.toISOString()))
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن تحديث مدة هذا الإعلان حالياً. إذا انتهت مدته فأعد تفعيله للمراجعة أولاً.",
      },
    };
  }
  return fetchOwnerListingDetail(userId, cleanListingId);
}

export async function confirmOwnerListingAvailability(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لتأكيد توفر الإعلان.",
      },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
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

  const { data, error } = await clientResult.data
    .from("listings")
    .update({ renewed_at: new Date().toISOString() })
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .eq("status", "approved")
    .or(publicListingExpiryFilter())
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن تأكيد توفر هذا الإعلان حالياً. ربما تغيرت حالته.",
      },
    };
  }

  return fetchOwnerListingDetail(userId, cleanListingId);
}
