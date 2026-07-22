import { deleteOwnerListing as deleteOwnerListingBase } from "@/lib/api/listings";
import { getClient } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import {
  deleteListingImageFromR2,
  isR2ListingImagePath,
  readSupabaseAccessToken,
} from "@/lib/r2-listing-images-client";

export async function deleteOwnerListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  const clientResult = getClient();
  let r2Paths: string[] = [];
  let accessToken: string | null = null;

  if (userId && clientResult.ok) {
    const { data } = await clientResult.data
      .from("listing_images")
      .select("storage_path")
      .eq("listing_id", listingId);
    r2Paths = ((data ?? []) as Array<{ storage_path?: unknown }>)
      .map((row) => row.storage_path)
      .filter((path): path is string => typeof path === "string" && isR2ListingImagePath(path));
    accessToken = await readSupabaseAccessToken(clientResult.data);
  }

  const result = await deleteOwnerListingBase(userId, listingId);
  if (!result.ok || r2Paths.length === 0) return result;

  const cleanupResults = await Promise.all(
    r2Paths.map((storagePath) => deleteListingImageFromR2({ listingId, storagePath, accessToken })),
  );
  if (cleanupResults.some((removed) => !removed)) {
    console.error("Failed to clean up one or more R2 images after listing delete", {
      listingId,
      failedObjects: cleanupResults.filter((removed) => !removed).length,
    });
  }

  return result;
}
