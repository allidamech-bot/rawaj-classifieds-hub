import {
  SELLER_REVIEW_TRAITS,
  adminFetchSellerReviews,
  adminModerateSellerReview,
  buildRatingSummary,
  createSellerReview as baseCreateSellerReview,
  fetchSellerReviewEligibility,
  mapReview,
  readSellerReviewResponse,
  sellerReviewTraitLabel,
  setSellerReviewResponse as baseSetSellerReviewResponse,
} from "@/lib/api/reviews";

export type {
  SellerReviewEligibility,
  SellerReviewEligibilityReason,
  SellerReviewResponseFields,
  SellerReviewWithResponse,
} from "@/lib/api/reviews";

const pendingReviewCreates = new Map<string, ReturnType<typeof baseCreateSellerReview>>();
const pendingReviewResponses = new Map<string, ReturnType<typeof baseSetSellerReviewResponse>>();

function runOnce<T>(key: string, requests: Map<string, Promise<T>>, operation: () => Promise<T>) {
  const pending = requests.get(key);
  if (pending) return pending;

  const request = operation().finally(() => {
    if (requests.get(key) === request) requests.delete(key);
  });
  requests.set(key, request);
  return request;
}

export function createSellerReview(payload: Parameters<typeof baseCreateSellerReview>[0]) {
  const key = JSON.stringify([
    payload.sellerUserId.trim(),
    payload.relatedListingId?.trim() ?? "",
    payload.rating,
    payload.comment?.trim() ?? "",
    [...(payload.traits ?? [])].sort(),
  ]);
  return runOnce(key, pendingReviewCreates, () => baseCreateSellerReview(payload));
}

export function setSellerReviewResponse(reviewId: string, response: string) {
  const cleanReviewId = reviewId.trim();
  const cleanResponse = response.trim();
  const key = JSON.stringify([cleanReviewId, cleanResponse]);
  return runOnce(key, pendingReviewResponses, () =>
    baseSetSellerReviewResponse(cleanReviewId, cleanResponse),
  );
}

export {
  SELLER_REVIEW_TRAITS,
  adminFetchSellerReviews,
  adminModerateSellerReview,
  buildRatingSummary,
  fetchSellerReviewEligibility,
  mapReview,
  readSellerReviewResponse,
  sellerReviewTraitLabel,
};
