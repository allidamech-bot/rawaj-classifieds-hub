import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  CreateSellerReviewPayload,
  ModerateSellerReviewPayload,
  SellerReview,
  SellerReviewStatus,
  SellerRatingSummary,
} from "@/lib/classifieds-types";
import { getClient, mapError, rowNullableString, rowNumber, rowString } from "@/lib/api/shared";

export async function createSellerReview(
  payload: CreateSellerReviewPayload,
): Promise<ClassifiedsResult<SellerReview>> {
  if (!payload.reviewerUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال تقييم." },
    };
  }

  const sellerUserId = payload.sellerUserId.trim();
  const reviewerUserId = payload.reviewerUserId.trim();
  const comment = payload.comment.trim();

  if (!sellerUserId || sellerUserId === reviewerUserId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "لا يمكن للمستخدم تقييم نفسه." },
    };
  }

  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر تقييما من 1 إلى 5." },
    };
  }

  if (comment.length < 10 || comment.length > 1200) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب مراجعة بين 10 و1200 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_reviews")
    .insert({
      seller_user_id: sellerUserId,
      reviewer_user_id: reviewerUserId,
      related_listing_id: payload.relatedListingId?.trim() || null,
      rating: payload.rating,
      comment,
      status: "pending_review",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapReview(data as Record<string, unknown>) };
}

export async function adminFetchSellerReviews(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<SellerReview[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التقييمات متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_reviews")
    .select(
      "id,seller_user_id,reviewer_user_id,related_listing_id,rating,comment,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapReview) };
}

export async function adminModerateSellerReview(
  canUseAdminAccess: boolean,
  payload: ModerateSellerReviewPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التقييمات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.reviewId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد التقييم أو نسخته الحالية." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_seller_review", {
    p_review_id: payload.reviewId,
    p_status: payload.status,
    p_admin_note: payload.adminNote?.trim() || null,
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    if (error.message?.includes("stale_seller_review")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر التقييم منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  return { ok: true, data: null };
}

export function buildRatingSummary(reviews: SellerReview[]): SellerRatingSummary {
  const approved = reviews.filter((review) => review.status === "approved");
  if (approved.length === 0) {
    return { average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  const distribution: SellerRatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const review of approved) {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[rating] += 1;
    total += rating;
  }

  return {
    average: Number((total / approved.length).toFixed(1)),
    count: approved.length,
    distribution,
  };
}

export function mapReview(row: Record<string, unknown>): SellerReview {
  return {
    id: rowString(row, "id"),
    sellerUserId: rowString(row, "seller_user_id"),
    reviewerUserId: rowString(row, "reviewer_user_id"),
    relatedListingId: rowNullableString(row, "related_listing_id"),
    rating: rowNumber(row, "rating"),
    comment: rowString(row, "comment"),
    status: rowString(row, "status", "pending_review") as SellerReviewStatus,
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
