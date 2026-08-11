import { fetchOwnerListingDetail as fetchOwnerListingDetailBase } from "@/lib/api/listings";
import { rememberOwnerListingVersion } from "@/lib/api/listing-owner-version";
import { resolveAuthenticatedMediaUrl } from "@/lib/authenticated-media-url";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";

export async function fetchOwnerListingDetail(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const result = await fetchOwnerListingDetailBase(userId, listingId);
  if (!result.ok) return result;

  rememberOwnerListingVersion(userId, result.data);
  return {
    ok: true,
    data: {
      ...result.data,
      primaryImageUrl: await resolveAuthenticatedMediaUrl(result.data.primaryImageUrl),
    },
  };
}
