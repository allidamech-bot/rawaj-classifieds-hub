import type { ClassifiedListing } from "@/lib/classifieds-types";

const ownerListingVersions = new Map<string, string>();

export function rememberOwnerListingVersion(
  userId: string | null,
  listing: ClassifiedListing,
): void {
  if (!userId || !listing.id || !listing.updatedAt) return;
  ownerListingVersions.set(versionKey(userId, listing.id), listing.updatedAt);
}

export function readOwnerListingVersion(
  userId: string | null,
  listingId: string,
): string | null {
  if (!userId || !listingId.trim()) return null;
  return ownerListingVersions.get(versionKey(userId, listingId)) ?? null;
}

export function forgetOwnerListingVersion(userId: string | null, listingId: string): void {
  if (!userId || !listingId.trim()) return;
  ownerListingVersions.delete(versionKey(userId, listingId));
}

function versionKey(userId: string, listingId: string): string {
  return `${userId}:${listingId.trim()}`;
}
