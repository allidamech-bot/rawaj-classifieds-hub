import { uploadListingImage as uploadListingImageCloudflare } from "@/lib/api/listings";
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
export function uploadListingImage(
  payload: ListingImageUploadPayload,
): Promise<ClassifiedsResult<ListingImage>> {
  return uploadListingImageCloudflare(payload);
}
