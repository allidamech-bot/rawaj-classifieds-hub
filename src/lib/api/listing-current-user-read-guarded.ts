import { fetchCurrentUserListings as fetchCurrentUserListingsBase } from "@/lib/api/listings";
import { resolveAuthenticatedMediaUrl } from "@/lib/authenticated-media-url";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";

export async function fetchCurrentUserListings(
  userId: string | null,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  const result = await fetchCurrentUserListingsBase(userId);
  if (!result.ok) return result;

  const listings = await Promise.all(
    result.data.map(async (listing) => ({
      ...listing,
      primaryImageUrl: await resolveAuthenticatedMediaUrl(listing.primaryImageUrl),
    })),
  );
  return { ok: true, data: listings };
}
