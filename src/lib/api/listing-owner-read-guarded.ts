import { fetchOwnerListingDetail as fetchOwnerListingDetailBase } from "@/lib/api/listings";
import { rememberOwnerListingVersion } from "@/lib/api/listing-owner-version";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";

export async function fetchOwnerListingDetail(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const result = await fetchOwnerListingDetailBase(userId, listingId);
  if (result.ok) rememberOwnerListingVersion(userId, result.data);
  return result;
}
