import {
  fetchListingImages as fetchListingImagesBase,
  mapImage,
} from "@/lib/api/listings";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { resolveAuthenticatedMediaUrl } from "@/lib/authenticated-media-url";
import type { ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";

const pendingListingImageReads = new Map<string, Promise<ClassifiedsResult<ListingImage[]>>>();

/**
 * Deduplicate only concurrent reads. No completed result is cached so image
 * replacement, deletion, and ordering changes remain visible immediately.
 *
 * Owner/private images are hydrated through an authenticated binary request so
 * they can be rendered by normal <img> elements without exposing draft media.
 * Moderators fall back to the dedicated admin image endpoint when the owner
 * detail endpoint intentionally hides a pending listing from non-owners.
 */
export function fetchListingImages(listingId: string): Promise<ClassifiedsResult<ListingImage[]>> {
  const cleanListingId = listingId.trim();
  const pending = pendingListingImageReads.get(cleanListingId);
  if (pending) return pending;

  const request = fetchListingImagesResolved(cleanListingId).finally(() => {
    if (pendingListingImageReads.get(cleanListingId) === request) {
      pendingListingImageReads.delete(cleanListingId);
    }
  });

  pendingListingImageReads.set(cleanListingId, request);
  return request;
}

async function fetchListingImagesResolved(
  listingId: string,
): Promise<ClassifiedsResult<ListingImage[]>> {
  let result = await fetchListingImagesBase(listingId);

  if (!result.ok) {
    const adminResult = await cloudflareApiRequest<Record<string, unknown>[]>(
      `/v1/admin/listings/${encodeURIComponent(listingId)}/images`,
    );
    if (adminResult.ok) {
      result = { ok: true, data: adminResult.data.map(mapImage) };
    }
  }

  if (!result.ok) return result;

  const images = await Promise.all(
    result.data.map(async (image) => ({
      ...image,
      publicUrl: await resolveAuthenticatedMediaUrl(image.publicUrl),
    })),
  );
  return { ok: true, data: images };
}
