import type { ClassifiedsResult, ListingStatus } from "@/lib/classifieds-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export type AdminListingModerationAction =
  | "approve"
  | "reject"
  | "request_changes"
  | "suspend"
  | "unpublish"
  | "archive"
  | "expire_now"
  | "extend_expiry";

export interface AdminModerationListingSummary {
  id: string;
  ownerId: string;
  title: string;
  status: ListingStatus;
  categoryId: string;
  governorateId: string;
  rejectionReason: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminListingModerationPayload {
  listingId: string;
  action: AdminListingModerationAction;
  reason: string;
  expectedUpdatedAt: string;
  extendDays?: number | null;
}

export interface AdminListingModerationResult {
  listingId: string;
  previousStatus: ListingStatus;
  nextStatus: ListingStatus;
  updatedAt: string;
}

export async function adminFetchModerationListings(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<AdminModerationListingSummary[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة الإعلانات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result =
      await cloudflareApiRequest<AdminModerationListingSummary[]>("/v1/admin/listings");
    return result.ok
      ? { ok: true, data: result.data }
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
      message: "إدارة الإعلانات متاحة فقط في وضع Cloudflare.",
    },
  };
}

export async function adminApplyListingModerationAction(
  canUseAdminAccess: boolean,
  payload: AdminListingModerationPayload,
): Promise<ClassifiedsResult<AdminListingModerationResult>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة الإعلانات متاحة لحساب إداري مخول فقط." },
    };
  }

  const reason = payload.reason.trim();
  if (!payload.listingId.trim() || !payload.expectedUpdatedAt || reason.length < 3) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "حدد الإعلان وأدخل سبباً واضحاً لا يقل عن 3 أحرف.",
      },
    };
  }

  if (
    payload.action === "extend_expiry" &&
    (!Number.isInteger(payload.extendDays) ||
      (payload.extendDays ?? 0) < 1 ||
      (payload.extendDays ?? 0) > 365)
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "مدة التمديد يجب أن تكون بين 1 و365 يوماً." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<AdminListingModerationResult>(
      "/v1/admin/listings/moderate",
      {
        method: "POST",
        body: {
          listingId: payload.listingId,
          action: payload.action,
          reason,
          expectedUpdatedAt: payload.expectedUpdatedAt,
          extendDays: payload.extendDays,
        },
      },
    );
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.code === "stale_review" ? "stale_review" : "unknown",
          message: result.error,
        },
      };
    }
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "إجراءات الإعلانات متاحة فقط في وضع Cloudflare.",
    },
  };
}
