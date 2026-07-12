import type { ListingImage } from "@/lib/classifieds-types";

function comparePrimaryImagePriority(left: ListingImage, right: ListingImage) {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  if (left.createdAt !== right.createdAt) return left.createdAt.localeCompare(right.createdAt);
  return left.id.localeCompare(right.id);
}

export function selectPrimaryListingImages(images: ListingImage[]): ListingImage[] {
  const primaryByListing = new Map<string, ListingImage>();

  for (const image of images) {
    const current = primaryByListing.get(image.listingId);
    if (!current || comparePrimaryImagePriority(image, current) < 0) {
      primaryByListing.set(image.listingId, image);
    }
  }

  return [...primaryByListing.values()];
}
