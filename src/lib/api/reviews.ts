import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateSellerReviewPayload,
  ModerateSellerReviewPayload,
  PublicSellerReview,
  SellerReview,
  SellerReviewStatus,
  SellerReviewTrait,
  SellerRatingSummary,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export type SellerReviewEligibilityReason =
  | "eligible"
  | "auth_required"
  | "invalid_seller"
  | "existing_review"
  | "no_qualifying_interaction";

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
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد البائع." } };
  }
  const params = new URLSearchParams();
  if (relatedListingId?.trim()) params.set("listingId", relatedListingId.trim());
  const suffix = params.size ? `?${params.toString()}` : "";
  return fromApi(
    await cloudflareApiRequest<SellerReviewEligibility>(
      `/v1/sellers/${encodeURIComponent(sellerId)}/review-eligibility${suffix}`,
    ),
  );
}

export async function createSellerReview(
  payload: CreateSellerReviewPayload,
): Promise<ClassifiedsResult<SellerReview>> {
  const sellerUserId = payload.sellerUserId.trim();
  const comment = payload.comment?.trim() ?? "";
  const requestedTraitCount = payload.traits?.length ?? 0;
  const traits = Array.from(new Set(payload.traits ?? []));
  if (!sellerUserId) {
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد البائع." } };
  }
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    return { ok: false, error: { code: "validation_error", message: "اختر تقييما من 1 إلى 5." } };
  }
  if (comment && (comment.length < 10 || comment.length > 1200)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب مراجعة بين 10 و1200 حرف." },
    };
  }
  if (
    traits.length > 3 ||
    traits.length !== requestedTraitCount ||
    !traits.every((trait) => sellerReviewTraitSet.has(trait))
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر حتى 3 صفات معتمدة بدون تكرار." },
    };
  }
  const result = await cloudflareApiRequest<Record<string, unknown>>(
    `/v1/sellers/${encodeURIComponent(sellerUserId)}/reviews`,
    {
      method: "POST",
      body: {
        relatedListingId: payload.relatedListingId?.trim() || null,
        rating: payload.rating,
        comment: comment || null,
        traits,
      },
    },
  );
  return result.ok
    ? { ok: true, data: mapReview(result.data) }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

export async function setSellerReviewResponse(
  reviewId: string,
  response: string,
): Promise<ClassifiedsResult<SellerReviewWithResponse>> {
  const cleanReviewId = reviewId.trim();
  const cleanResponse = response.trim();
  if (!cleanReviewId) {
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد التقييم." } };
  }
  if (cleanResponse && (cleanResponse.length < 3 || cleanResponse.length > 800)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب ردا بين 3 و800 حرف." },
    };
  }
  const result = await cloudflareApiRequest<Record<string, unknown>>(
    `/v1/reviews/${encodeURIComponent(cleanReviewId)}/response`,
    { method: "PATCH", body: { response: cleanResponse || null } },
  );
  return result.ok
    ? { ok: true, data: mapReview(result.data) }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
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
  const result = await cloudflareApiRequest<Array<Record<string, unknown>>>(
    "/v1/admin/seller-reviews?limit=100",
  );
  return result.ok
    ? { ok: true, data: result.data.map(mapReview) }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
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
  const reviewId = payload.reviewId.trim();
  if (!reviewId || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد التقييم أو نسخته الحالية." },
    };
  }
  const result = await cloudflareApiRequest<{ success: boolean; updatedAt: string }>(
    `/v1/admin/seller-reviews/${encodeURIComponent(reviewId)}`,
    {
      method: "PATCH",
      body: {
        status: payload.status,
        adminNote: payload.adminNote?.trim() || null,
        expectedUpdatedAt: payload.expectedUpdatedAt,
      },
    },
  );
  return result.ok
    ? { ok: true, data: null }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
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
  return { average: Number((total / approved.length).toFixed(1)), count: approved.length, distribution };
}

export function mapReview(row: Record<string, unknown>): SellerReviewWithResponse {
  return {
    id: stringValue(row.id),
    sellerUserId: stringValue(row.sellerUserId ?? row.seller_id),
    reviewerUserId: stringValue(row.reviewerUserId ?? row.reviewer_id),
    relatedListingId: nullableString(row.relatedListingId ?? row.listing_id ?? row.related_listing_id),
    rating: numberValue(row.rating),
    comment: nullableString(row.comment),
    traits: arrayValue(row.traits).filter((trait): trait is SellerReviewTrait =>
      sellerReviewTraitSet.has(trait),
    ),
    status: stringValue(row.status, "pending_review") as SellerReviewStatus,
    adminNote: nullableString(row.adminNote ?? row.admin_note),
    reviewedBy: nullableString(row.reviewedBy ?? row.reviewed_by),
    reviewedAt: nullableString(row.reviewedAt ?? row.reviewed_at),
    sellerResponse: nullableString(row.sellerResponse ?? row.seller_response),
    sellerResponseUpdatedAt: nullableString(
      row.sellerResponseUpdatedAt ?? row.seller_response_updated_at,
    ),
    createdAt: stringValue(row.createdAt ?? row.created_at),
    updatedAt: stringValue(row.updatedAt ?? row.updated_at),
  };
}

function fromApi<T>(
  result: { ok: true; data: T } | { ok: false; error: string; code: string },
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}
function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}
function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
