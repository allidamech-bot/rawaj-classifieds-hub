import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";
import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { getClient, mapError } from "@/lib/api/shared";

export type OwnerCloseListingStatus = "sold" | "rented" | "unavailable";

async function updateOwnerLifecycleStatus(
  userId: string | null,
  listingId: string,
  currentStatuses: readonly string[],
  targetStatus: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث حالة الإعلان." },
    };
  }

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listings")
    .update({ status: targetStatus })
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", [...currentStatuses])
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

export async function closeOwnerListing(
  userId: string | null,
  listingId: string,
  targetStatus: OwnerCloseListingStatus,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return updateOwnerLifecycleStatus(userId, listingId, ["approved"], targetStatus);
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

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listings")
    .update({
      status: "pending_review",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    })
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["sold", "rented", "unavailable", "expired"])
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "تعذر إعادة تفعيل الإعلان. ربما تغيرت حالته أو لم تعد العملية متاحة.",
      },
    };
  }

  return fetchOwnerListingDetail(userId, listingId);
}

export async function renewOwnerListing(
  userId: string | null,
  listingId: string,
  extensionDays = 30,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتجديد الإعلان." },
    };
  }

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const safeDays = Math.max(1, Math.min(Math.trunc(extensionDays) || 30, 90));
  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("id, status, expires_at")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["approved", "expired"])
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "يمكن تجديد الإعلانات النشطة أو المنتهية فقط.",
      },
    };
  }

  const now = new Date();
  const existingExpiry = existing.expires_at ? new Date(String(existing.expires_at)) : now;
  const base = Number.isFinite(existingExpiry.getTime()) && existingExpiry > now ? existingExpiry : now;
  const nextExpiry = new Date(base.getTime() + safeDays * 24 * 60 * 60 * 1000).toISOString();
  const wasExpired = existing.status === "expired";

  const { data, error } = await clientResult.data
    .from("listings")
    .update({
      expires_at: nextExpiry,
      renewed_at: now.toISOString(),
      ...(wasExpired
        ? {
            status: "pending_review",
            reviewed_by: null,
            reviewed_at: null,
            rejection_reason: null,
          }
        : {}),
    })
    .eq("id", listingId)
    .eq("owner_id", userId)
    .eq("status", existing.status)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "تعذر تجديد الإعلان لأن حالته تغيرت. حدّث الصفحة وحاول مجددًا.",
      },
    };
  }

  return fetchOwnerListingDetail(userId, listingId);
}
