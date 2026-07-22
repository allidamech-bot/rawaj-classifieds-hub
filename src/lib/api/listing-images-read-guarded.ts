import { fetchListingImages as fetchListingImagesBase } from "@/lib/api/listings";
import type { ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";
import { fetchCloudflareListingDetail } from "@/lib/public-data/cloudflare-client";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const pendingListingImageReads = new Map<string, Promise<ClassifiedsResult<ListingImage[]>>>();

/**
 * Deduplicate only concurrent reads. No completed result is cached so image
 * replacement, deletion, and ordering changes remain visible immediately.
 */
export function fetchListingImages(listingId: string): Promise<ClassifiedsResult<ListingImage[]>> {
  const cleanListingId = listingId.trim();
  const pending = pendingListingImageReads.get(cleanListingId);
  if (pending) return pending;

  const request = (isCloudflarePublicDataProvider()
    ? fetchCloudflareListingDetail(cleanListingId).then((result) =>
        result.ok ? { ok: true as const, data: result.data.images } : result,
      )
    : fetchListingImagesBase(cleanListingId)
  ).finally(() => {
    if (pendingListingImageReads.get(cleanListingId) === request) {
      pendingListingImageReads.delete(cleanListingId);
    }
  });

  pendingListingImageReads.set(cleanListingId, request);
  return request;
}
