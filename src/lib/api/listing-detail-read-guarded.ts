import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";
import { guardPublicListingDetailResult } from "@/lib/api/listing-detail-load-guard";
import { fetchListingDetail as fetchListingDetailBase } from "@/lib/api/listings";
import { isPublicListingVisible } from "@/lib/public-listing-presentation";

const pendingPublicListingDetailReads = new Map<
  string,
  Promise<ClassifiedsResult<ClassifiedListing>>
>();

export function fetchListingDetailGuarded(
  id: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const listingId = id.trim();
  const pending = pendingPublicListingDetailReads.get(listingId);
  if (pending) return pending;

  const request = (async () => {
    const result = guardPublicListingDetailResult(await fetchListingDetailBase(listingId));
    if (result.ok && !isPublicListingVisible(result.data)) {
      return {
        ok: false,
        error: { code: "not_found", message: "هذا الإعلان غير متاح للعرض العام." },
      } satisfies ClassifiedsResult<ClassifiedListing>;
    }
    return result;
  })().finally(() => {
    if (pendingPublicListingDetailReads.get(listingId) === request) {
      pendingPublicListingDetailReads.delete(listingId);
    }
  });

  pendingPublicListingDetailReads.set(listingId, request);
  return request;
}
