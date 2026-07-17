import type {
  PublicSellerReview,
  SellerRatingSummary,
  SellerReviewTrait,
} from "@/lib/classifieds-types";

function readString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function readNullableString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readArray(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return Array.isArray(value) ? value : [];
}

const publicSellerReviewTraits = new Set<SellerReviewTrait>([
  "accurate_description",
  "good_communication",
  "fast_response",
  "fair_deal",
  "punctual",
  "trustworthy",
]);

export const PUBLIC_SELLER_LISTING_LIMIT = 24;
export const PUBLIC_SELLER_REVIEW_DISPLAY_LIMIT = 6;
export const PUBLIC_SELLER_REVIEW_SUMMARY_LIMIT = 500;

export function mapPublicSellerReview(row: Record<string, unknown>): PublicSellerReview {
  return {
    id: readString(row, "id"),
    rating: Math.min(5, Math.max(1, Math.round(readNumber(row, "rating")))),
    comment: cleanPublicSellerText(readNullableString(row, "comment"), 1200),
    traits: readArray(row, "traits").filter((trait): trait is SellerReviewTrait =>
      publicSellerReviewTraits.has(trait as SellerReviewTrait),
    ),
    sellerResponse: cleanPublicSellerText(readNullableString(row, "seller_response"), 800),
    sellerResponseUpdatedAt: readNullableString(row, "seller_response_updated_at"),
    createdAt: readString(row, "created_at"),
  };
}

export function buildPublicSellerRatingSummary(reviews: PublicSellerReview[]): SellerRatingSummary {
  const distribution: SellerRatingSummary["distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let total = 0;
  for (const review of reviews) {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[rating] += 1;
    total += rating;
  }
  return {
    average: reviews.length > 0 ? Number((total / reviews.length).toFixed(1)) : null,
    count: reviews.length,
    distribution,
  };
}

export function cleanPublicSellerText(value: string | null | undefined, maxLength: number) {
  const clean = [...(value ?? "")]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("")
    .trim();
  if (!clean) return null;
  return clean.length <= maxLength ? clean : clean.slice(0, maxLength).trim();
}

export function safePublicSellerMediaUrl(value: string | null | undefined) {
  const clean = value?.trim() ?? "";
  return /^https?:\/\//i.test(clean) || clean.startsWith("/") ? clean : null;
}
