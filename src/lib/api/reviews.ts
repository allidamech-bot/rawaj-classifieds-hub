import type {
  ClassifiedsResult,
  CreateSellerReviewPayload,
  ModerateSellerReviewPayload,
  PublicSellerReview,
  SellerReview,
  SellerReviewStatus,
  SellerReviewTrait,
  SellerRatingSummary,
} from "@/lib/classifieds-types";
import {
  getClient,
  mapError,
  rowArray,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";

export type SellerReviewEligibilityReason =
  "eligible" | "auth_required" | "invalid_seller" | "existing_review" | "no_qualifying_interaction";

export interface SellerReviewEligibility {
  eligible: boolean;
  relatedListingId: string | null;
  conversationId: string | null;
  reason: SellerReviewEligibilityReason;
}

export interface SellerReviewResponseFields {
  sellerResponse: string | null;
  sellerResponseUpdatedAt: string | null;
}

export type SellerReviewWithResponse = SellerReview & SellerReviewResponseFields;

export const SELLER_REVIEW_TRAITS = [
  "accurate_description",
  "good_communication",
  "fast_response",
  "fair_deal",
  "punctual",
  "trustworthy",
] as const satisfies readonly SellerReviewTrait[];

const sellerReviewTraitSet = new Set<string>(SELLER_REVIEW_TRAITS);

export function sellerReviewTraitLabel(trait: SellerReviewTrait, language: string): string {
  const labels: Record<SellerReviewTrait, [string, string]> = {
    accurate_description: ["الوصف دقيق", "Accurate description"],
    good_communication: ["تواصل جيد", "Good communication"],
    fast_response: ["سريع الرد", "Fast response"],
    fair_deal: ["تعامل منصف", "Fair deal"],
    punctual: ["ملتزم بالموعد", "Punctual"],
    trustworthy: ["جدير بالثقة", "Trustworthy"],
  };
  return labels[trait][language === "ar" ? 0 : 1];
}

export async function fetchSellerReviewEligibility(
  sellerUserId: string,
  relatedListingId?: string | null,
): Promise<ClassifiedsResult<SellerReviewEligibility>> {
  const sellerId = sellerUserId.trim();
  if (!sellerId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البائع." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_get_seller_review_eligibility", {
    p_seller_user_id: sellerId,
    p_related_listing_id: relatedListingId?.trim() || null,
  });

  if (error) return { ok: false, error: mapError(error) };

  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: { code: "unknown", message: "تعذر التحقق من أهلية التقييم." },
    };
  }

  const row = raw as Record<string, unknown>;
  return {
    ok: true,
    data: {
      eligible: row.eligible === true,
      relatedListingId: rowNullableString(row, "related_listing_id"),
      conversationId: rowNullableString(row, "conversation_id"),
      reason: rowString(
        row,
        "reason",
        "no_qualifying_interaction",
      ) as SellerReviewEligibilityReason,
    },
  };
}

export async function createSellerReview(
  payload: CreateSellerReviewPayload,
): Promise<ClassifiedsResult<SellerReview>> {
  const sellerUserId = payload.sellerUserId.trim();
  if (!sellerUserId) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد البائع.",
      },
    };
  }

  const comment = payload.comment?.trim() ?? "";
  const requestedTraitCount = payload.traits?.length ?? 0;
  const traits = Array.from(new Set(payload.traits ?? []));

  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر تقييما من 1 إلى 5." },
    };
  }

  if (comment && (comment.length < 10 || comment.length > 1200)) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "اكتب مراجعة بين 10 و1200 حرف.",
      },
    };
  }

  if (
    traits.length > 3 ||
    traits.length !== requestedTraitCount ||
    !traits.every((trait) => sellerReviewTraitSet.has(trait))
  ) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "اختر حتى 3 صفات معتمدة بدون تكرار.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_create_eligible_seller_review", {
    p_seller_user_id: sellerUserId,
    p_rating: payload.rating,
    p_comment: comment,
    p_related_listing_id: payload.relatedListingId?.trim() || null,
    p_traits: traits,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("seller_review_invalid_seller")) {
      return {
        ok: false,
        error: {
          code: "validation_error",
          message: "لا يمكنك تقييم حسابك أو بائع غير صالح.",
        },
      };
    }
    if (message.includes("seller_review_not_eligible")) {
      return {
        ok: false,
        error: {
          code: "permission_denied",
          message: "يمكنك تقييم البائع فقط بعد محادثة فعلية متبادلة معه.",
        },
      };
    }
    if (message.includes("seller_review_already_exists")) {
      return {
        ok: false,
        error: {
          code: "status_mismatch",
          message: "لديك بالفعل تقييم قيد المراجعة أو معتمد لهذا البائع.",
        },
      };
    }
    if (message.includes("seller_review_auth_required")) {
      return {
        ok: false,
        error: {
          code: "auth_required",
          message: "يجب تسجيل الدخول لإرسال تقييم.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تم تنفيذ الطلب دون إعادة التقييم المنشأ.",
      },
    };
  }

  return { ok: true, data: mapReview(raw as Record<string, unknown>) };
}

export async function setSellerReviewResponse(
  reviewId: string,
  response: string,
): Promise<ClassifiedsResult<SellerReviewWithResponse>> {
  const cleanReviewId = reviewId.trim();
  const cleanResponse = response.trim();

  if (!cleanReviewId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد التقييم." },
    };
  }

  if (cleanResponse && (cleanResponse.length < 3 || cleanResponse.length > 800)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب ردا بين 3 و800 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_set_seller_review_response", {
    p_review_id: cleanReviewId,
    p_response: cleanResponse,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("seller_review_response_auth_required")) {
      return {
        ok: false,
        error: { code: "auth_required", message: "يجب تسجيل الدخول للرد على التقييم." },
      };
    }
    if (message.includes("seller_review_response_permission_denied")) {
      return {
        ok: false,
        error: { code: "permission_denied", message: "لا يمكنك الرد على تقييم بائع آخر." },
      };
    }
    if (message.includes("seller_review_response_requires_approved_review")) {
      return {
        ok: false,
        error: { code: "status_mismatch", message: "يمكن الرد على التقييمات المعتمدة فقط." },
      };
    }
    if (message.includes("seller_review_response_not_found")) {
      return {
        ok: false,
        error: { code: "not_found", message: "التقييم غير موجود أو لم يعد متاحا." },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      error: { code: "unknown", message: "تم حفظ الرد دون إعادة التقييم المحدث." },
    };
  }

  return { ok: true, data: mapReview(raw as Record<string, unknown>) };
}

export function readSellerReviewResponse(
  review: SellerReview | PublicSellerReview,
): SellerReviewResponseFields {
  const extended = review as SellerReviewWithResponse;
  return {
    sellerResponse: extended.sellerResponse ?? null,
    sellerResponseUpdatedAt: extended.sellerResponseUpdatedAt ?? null,
  };
}

export async function adminFetchSellerReviews(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<SellerReview[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة التقييمات متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_reviews")
    .select(
      "id,seller_user_id,reviewer_user_id,related_listing_id,rating,comment,traits,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapReview),
  };
}

export async function adminModerateSellerReview(
  canUseAdminAccess: boolean,
  payload: ModerateSellerReviewPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة التقييمات متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  if (!payload.reviewId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد التقييم أو نسخته الحالية.",
      },
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
    return {
      average: null,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const distribution: SellerRatingSummary["distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
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

export function mapReview(row: Record<string, unknown>): SellerReviewWithResponse {
  return {
    id: rowString(row, "id"),
    sellerUserId: rowString(row, "seller_user_id"),
    reviewerUserId: rowString(row, "reviewer_user_id"),
    relatedListingId: rowNullableString(row, "related_listing_id"),
    rating: rowNumber(row, "rating"),
    comment: rowNullableString(row, "comment"),
    traits: rowArray(row, "traits").filter((trait): trait is SellerReviewTrait =>
      sellerReviewTraitSet.has(trait),
    ),
    status: rowString(row, "status", "pending_review") as SellerReviewStatus,
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    sellerResponse: rowNullableString(row, "seller_response"),
    sellerResponseUpdatedAt: rowNullableString(row, "seller_response_updated_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
