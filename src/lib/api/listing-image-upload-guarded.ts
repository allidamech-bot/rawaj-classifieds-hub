import { uploadListingImage as uploadListingImageCloudflare } from "@/lib/api/listings";
import { resolveAuthenticatedMediaUrl } from "@/lib/authenticated-media-url";
import type {
  ClassifiedsResult,
  ListingImage,
  ListingImageUploadPayload,
} from "@/lib/classifieds-types";

/**
 * The Worker performs ownership validation and commits R2 metadata with the D1
 * image row. Keeping one upload implementation avoids dual-storage retries and
 * the orphan-object race that existed in the retired browser storage flow.
 */
export async function uploadListingImage(
  payload: ListingImageUploadPayload,
): Promise<ClassifiedsResult<ListingImage>> {
  const result = await uploadListingImageCloudflare(payload);
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      ...result.data,
      publicUrl: await resolveAuthenticatedMediaUrl(result.data.publicUrl),
    },
  };
}
