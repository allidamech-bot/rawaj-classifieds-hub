import { deleteListingImage as deleteListingImageBase } from "@/lib/api/listings";
import { getClient } from "@/lib/api/shared";
import type { ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";
import {
  deleteListingImageFromR2,
  isR2ListingImagePath,
  readSupabaseAccessToken,
} from "@/lib/r2-listing-images-client";

export async function deleteListingImage(
  userId: string | null,
  listingId: string,
  image: ListingImage,
): Promise<ClassifiedsResult<null>> {
  const result = await deleteListingImageBase(userId, listingId, image);
  if (!result.ok || !isR2ListingImagePath(image.storagePath)) return result;

  const clientResult = getClient();
  const accessToken = clientResult.ok ? await readSupabaseAccessToken(clientResult.data) : null;
  const removed = await deleteListingImageFromR2({
    listingId,
    storagePath: image.storagePath,
    accessToken,
  });
  if (!removed) {
    console.error("Failed to clean up R2 image after listing image delete", {
      listingId,
      imageId: image.id,
    });
  }
  return result;
}
