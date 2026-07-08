import { fetchListingDetail } from "@/lib/api/listings";
import { getClient, mapError, rowNullableNumber } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export interface ListingPriceChangeContext {
  previousPrice: number;
  currentPrice: number;
  currency: "SYP";
  direction: "increased" | "decreased";
}

export async function fetchListingPriceChangeContext(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ListingPriceChangeContext | null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض سياق السعر." },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("favorite_listing_snapshots")
    .select("price_snapshot")
    .eq("user_id", userId)
    .eq("listing_id", cleanListingId)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) return { ok: true, data: null };

  const previousPrice = rowNullableNumber(data as Record<string, unknown>, "price_snapshot");
  if (previousPrice === null) return { ok: true, data: null };

  const listingResult = await fetchListingDetail(cleanListingId);
  if (!listingResult.ok) {
    if (listingResult.error.code === "not_found") return { ok: true, data: null };
    return listingResult;
  }

  const currentPrice = listingResult.data.price;
  if (currentPrice === null || currentPrice === previousPrice) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: {
      previousPrice,
      currentPrice,
      currency: "SYP",
      direction: currentPrice > previousPrice ? "increased" : "decreased",
    },
  };
}
