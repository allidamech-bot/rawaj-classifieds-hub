import type { ClassifiedsResult, ModerateListingPayload } from "@/lib/classifieds-types";
import { getClient, mapError } from "@/lib/api/shared";

export async function adminModerateListing(
  canUseAdminAccess: boolean,
  payload: ModerateListingPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة الإعلانات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.listingId.trim() || !payload.reviewerId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان أو حساب المراجع." },
    };
  }

  if (payload.status === "rejected" && !payload.rejectionReason?.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبب الرفض قبل تحديث الإعلان." },
    };
  }

  if (!payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "حدّث الإعلان قبل اتخاذ قرار المراجعة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const rpcResult = await clientResult.data.rpc("rawaj_review_listing_decision", {
    p_listing_id: payload.listingId.trim(),
    p_decision: payload.status,
    p_reason:
      payload.status === "rejected"
        ? payload.rejectionReason?.trim()
        : "Approved after complete listing review",
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  const error = rpcResult.error;
  if (error) {
    if (error.message?.includes("stale_review")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر الإعلان منذ فتحه للمراجعة. حدّث الصفحة وراجعه من جديد.",
        },
      };
    }
    return { ok: false, error: mapError(error, "admin_moderate_listing") };
  }

  return { ok: true, data: null };
}
