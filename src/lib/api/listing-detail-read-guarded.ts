import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";
import { guardPublicListingDetailResult } from "@/lib/api/listing-detail-load-guard";
import { fetchListingDetail as fetchListingDetailBase } from "@/lib/api/listings";

export async function fetchListingDetailGuarded(
  id: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return guardPublicListingDetailResult(await fetchListingDetailBase(id));
}
