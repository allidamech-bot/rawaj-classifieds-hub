import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";

export async function setOwnerListingReserved(
  userId: string | null,
  listingId: string,
  reserved: boolean,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإدارة حجز الإعلان." },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_owner_set_listing_reserved", {
    p_listing_id: cleanListingId,
    p_reserved: reserved,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("listing_reservation_requires_public_listing")) {
      return {
        ok: false,
        error: {
          code: "status_mismatch",
          message: "يمكن حجز إعلان معتمد ومتوافر فقط.",
        },
      };
    }
    if (message.includes("listing_reservation_not_found")) {
      return {
        ok: false,
        error: { code: "not_found", message: "الإعلان غير موجود أو لا تملكه." },
      };
    }
    if (message.includes("listing_reservation_account_restricted")) {
      return {
        ok: false,
        error: { code: "permission_denied", message: "الحساب غير مسموح له بإدارة الإعلانات." },
      };
    }
    return { ok: false, error: mapError(error, "owner_listing_reservation") };
  }

  return fetchOwnerListingDetail(userId, cleanListingId);
}
