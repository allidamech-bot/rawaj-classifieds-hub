import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";
import { guardPublicListingDetailResult } from "@/lib/api/listing-detail-load-guard";
import { fetchListingDetail as fetchListingDetailBase } from "@/lib/api/listings";
import { isPublicListingVisible } from "@/lib/public-listing-presentation";
import { fetchCloudflareListingDetail } from "@/lib/public-data/cloudflare-client";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

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
    const sourceResult = isCloudflarePublicDataProvider()
      ? await fetchCloudflareListingDetail(listingId).then((result) =>
          result.ok ? { ok: true as const, data: result.data.listing } : result,
        )
      : await fetchListingDetailBase(listingId);
    const result = guardPublicListingDetailResult(sourceResult);
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
