import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";

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
  if (!userId) return { ok: false, error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض سياق السعر." } };
  const cleanId = listingId.trim();
  if (!cleanId) return { ok: false, error: { code: "validation_error", message: "تعذر تحديد الإعلان." } };
  const result = await cloudflareApiRequest<ListingPriceChangeContext | null>(
    `/v1/listings/${encodeURIComponent(cleanId)}/price-context`,
  );
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}
