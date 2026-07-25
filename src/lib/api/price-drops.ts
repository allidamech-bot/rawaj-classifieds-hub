import { fetchOwnerListingDetail, mapListing } from "@/lib/api/listings";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type { ClassifiedListing, ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";

export interface ListingPriceDropOffer {
  listing: ClassifiedListing;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  droppedAt: string;
}

export async function reduceOwnerListingPrice(
  userId: string | null,
  listingId: string,
  newPrice: number,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) return failure("auth_required", "يجب تسجيل الدخول لتخفيض سعر الإعلان.");
  const cleanId = listingId.trim();
  if (!cleanId || !Number.isFinite(newPrice) || newPrice <= 0) {
    return failure("validation_error", "أدخل سعراً جديداً صالحاً.");
  }
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanId)}/lifecycle`,
    { method: "PATCH", body: { action: "reduce_price", newPrice } },
  );
  if (!result.ok) return failure(result.code as ClassifiedsErrorCode, result.error);
  return fetchOwnerListingDetail(userId, cleanId);
}

export async function fetchActivePriceDropOffers(
  limit = 30,
): Promise<ClassifiedsResult<ListingPriceDropOffer[]>> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 30, 50));
  const result = await cloudflareApiRequest<Array<{
    listing: Record<string, unknown>;
    oldPrice: number;
    newPrice: number;
    discountPercent: number;
    droppedAt: string;
  }>>(`/v1/offers/price-drops?limit=${safeLimit}`);
  return result.ok
    ? { ok: true, data: result.data.map((item) => ({ ...item, listing: mapListing(item.listing) })) }
    : failure(result.code as ClassifiedsErrorCode, result.error);
}

function failure<T>(code: ClassifiedsErrorCode, message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code, message } };
}
