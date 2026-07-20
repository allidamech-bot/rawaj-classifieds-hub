import { fetchListingImages as fetchListingImagesBase } from "@/lib/api/listings";
import type { ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";

const pendingListingImageReads = new Map<string, Promise<ClassifiedsResult<ListingImage[]>>>();

/**
 * Deduplicate only concurrent reads. No completed result is cached so image
 * replacement, deletion, and ordering changes remain visible immediately.
 */
export function fetchListingImages(listingId: string): Promise<ClassifiedsResult<ListingImage[]>> {
  const cleanListingId = listingId.trim();
  const pending = pendingListingImageReads.get(cleanListingId);
  if (pending) return pending;

  const request = fetchListingImagesBase(cleanListingId).finally(() => {
    if (pendingListingImageReads.get(cleanListingId) === request) {
      pendingListingImageReads.delete(cleanListingId);
    }
  });

  pendingListingImageReads.set(cleanListingId, request);
  return request;
}
