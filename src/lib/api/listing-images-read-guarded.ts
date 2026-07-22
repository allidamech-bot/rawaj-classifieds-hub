import { fetchListingImages as fetchListingImagesBase } from "@/lib/api/listings";
import { getClient } from "@/lib/api/shared";
import type { ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";
import {
  isR2ListingImagePath,
  readSupabaseAccessToken,
  signR2ListingImagePaths,
} from "@/lib/r2-listing-images-client";

const pendingListingImageReads = new Map<string, Promise<ClassifiedsResult<ListingImage[]>>>();
const signedUrlExpiresInSeconds = 900;

/**
 * Deduplicate only concurrent reads. No completed result is cached so image
 * replacement, deletion, and ordering changes remain visible immediately.
 */
export function fetchListingImages(listingId: string): Promise<ClassifiedsResult<ListingImage[]>> {
  const cleanListingId = listingId.trim();
  const pending = pendingListingImageReads.get(cleanListingId);
  if (pending) return pending;

  const request = fetchListingImagesWithR2(cleanListingId).finally(() => {
    if (pendingListingImageReads.get(cleanListingId) === request) {
      pendingListingImageReads.delete(cleanListingId);
    }
  });

  pendingListingImageReads.set(cleanListingId, request);
  return request;
}

async function fetchListingImagesWithR2(
  listingId: string,
): Promise<ClassifiedsResult<ListingImage[]>> {
  const result = await fetchListingImagesBase(listingId);
  if (!result.ok) return result;

  const r2Paths = result.data
    .map((image) => image.storagePath)
    .filter(isR2ListingImagePath);
  if (r2Paths.length === 0) return result;

  const clientResult = getClient();
  const accessToken = clientResult.ok ? await readSupabaseAccessToken(clientResult.data) : null;
  const urls = await signR2ListingImagePaths(r2Paths, accessToken);

  return {
    ok: true,
    data: result.data.map((image) => {
      const signedUrl = image.storagePath ? urls.get(image.storagePath) : null;
      return signedUrl
        ? { ...image, publicUrl: signedUrl, signedUrlExpiresIn: signedUrlExpiresInSeconds }
        : image;
    }),
  };
}
