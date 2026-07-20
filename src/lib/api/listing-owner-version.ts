import type { ClassifiedListing } from "@/lib/classifieds-types";

const ownerListingVersions = new Map<string, string>();

export function rememberOwnerListingVersion(
  userId: string | null,
  listing: ClassifiedListing,
): void {
  rememberOwnerListingUpdatedAt(userId, listing.id, listing.updatedAt);
}

export function rememberOwnerListingUpdatedAt(
  userId: string | null,
  listingId: string,
  updatedAt: string,
): void {
  const cleanListingId = listingId.trim();
  const cleanUpdatedAt = updatedAt.trim();
  if (!userId || !cleanListingId || !cleanUpdatedAt) return;
  ownerListingVersions.set(versionKey(userId, cleanListingId), cleanUpdatedAt);
}

export function readOwnerListingVersion(userId: string | null, listingId: string): string | null {
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
