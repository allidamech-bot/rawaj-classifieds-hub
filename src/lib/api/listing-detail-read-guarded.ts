import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";
import { guardPublicListingDetailResult } from "@/lib/api/listing-detail-load-guard";
import { fetchListingDetail as fetchListingDetailBase } from "@/lib/api/listings";
import { isPublicListingVisible } from "@/lib/public-listing-presentation";

export async function fetchListingDetailGuarded(
  id: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const result = guardPublicListingDetailResult(await fetchListingDetailBase(id));
  if (result.ok && !isPublicListingVisible(result.data)) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان غير متاح للعرض العام." },
    };
  }
  return result;
}
