import type { ClassifiedsResult, ModerateListingPayload } from "@/lib/classifieds-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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

  if (isCloudflarePublicDataProvider()) {
    const action = payload.status === "approved" ? "approve" : "reject";
    const result = await cloudflareApiRequest<null>("/v1/admin/listings/moderate", {
      method: "POST",
      body: {
        listingId: payload.listingId,
        action,
        reason:
          payload.status === "rejected"
            ? payload.rejectionReason
            : "Approved after complete listing review",
        expectedUpdatedAt: payload.expectedUpdatedAt,
      },
    });
    return result.ok
      ? { ok: true, data: null }
      : {
          ok: false,
          error: {
            code: result.code as import("@/lib/classifieds-types").ClassifiedsErrorCode,
            message: result.error,
          },
        };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "مراجعة الإعلانات متاحة فقط في وضع Cloudflare.",
    },
  };
}
