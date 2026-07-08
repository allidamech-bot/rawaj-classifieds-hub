import type { ClassifiedsResult, ListingStatus } from "@/lib/classifieds-types";
import { getClient, mapError, rowNullableString, rowString } from "@/lib/api/shared";

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listings")
    .select(
      "id, owner_id, title, status, category_id, governorate_id, rejection_reason, expires_at, reviewed_at, published_at, archived_at, created_at, updated_at",
    )
    .in("status", ["pending_review", "approved", "rejected", "archived", "expired"])
    .order("updated_at", { ascending: false })
    .limit(250);

  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: rowString(row, "id"),
      ownerId: rowString(row, "owner_id"),
      title: rowString(row, "title"),
      status: rowString(row, "status", "pending_review") as ListingStatus,
      categoryId: rowString(row, "category_id"),
      governorateId: rowString(row, "governorate_id"),
      rejectionReason: rowNullableString(row, "rejection_reason"),
      expiresAt: rowNullableString(row, "expires_at"),
      reviewedAt: rowNullableString(row, "reviewed_at"),
      publishedAt: rowNullableString(row, "published_at"),
      archivedAt: rowNullableString(row, "archived_at"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
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
      error: { code: "validation_error", message: "حدد الإعلان وأدخل سبباً واضحاً لا يقل عن 3 أحرف." },
    };
  }

  if (
    payload.action === "extend_expiry" &&
    (!Number.isInteger(payload.extendDays) || (payload.extendDays ?? 0) < 1 || (payload.extendDays ?? 0) > 365)
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "مدة التمديد يجب أن تكون بين 1 و365 يوماً." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_admin_moderate_listing", {
    p_listing_id: payload.listingId,
    p_action: payload.action,
    p_reason: reason,
    p_expected_updated_at: payload.expectedUpdatedAt,
    p_extend_days: payload.action === "extend_expiry" ? (payload.extendDays ?? null) : null,
  });

  if (error) {
    const mapped = mapError(error);
    if (error.message?.includes("stale_review")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر الإعلان منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.",
        },
      };
    }
    return { ok: false, error: mapped };
  }

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تم تنفيذ الطلب دون نتيجة قابلة للتحقق." },
    };
  }

  return {
    ok: true,
    data: {
      listingId: rowString(row, "listing_id"),
      previousStatus: rowString(row, "previous_status", "pending_review") as ListingStatus,
      nextStatus: rowString(row, "next_status", "pending_review") as ListingStatus,
      updatedAt: rowString(row, "updated_at"),
    },
  };
}
