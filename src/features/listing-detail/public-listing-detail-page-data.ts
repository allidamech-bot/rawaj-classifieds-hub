import {
  fetchListingDetail,
  fetchListingImages,
  fetchPublicListings,
  fetchPublicSellerProfile,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingImage,
  PublicSellerProfile,
} from "@/lib/classifieds-types";

export interface PublicListingDetailPageData {
  listing: ClassifiedListing;
  images: ListingImage[];
  seller: PublicSellerProfile | null;
  similarListings: ClassifiedListing[];
  imageError: ClassifiedsError | null;
}

export async function loadPublicListingDetailPageData(
  listingId: string,
): Promise<PublicListingDetailPageData | null> {
  const listingResult = await fetchListingDetail(listingId);
  if (!listingResult.ok) return null;

  const listing = listingResult.data;
  const [imagesResult, sellerResult, similarResult] = await Promise.all([
    fetchListingImages(listing.id),
    fetchPublicSellerProfile(listing.ownerId),
    fetchPublicListings(
      {
        categoryId: listing.categoryId,
        governorateId: listing.governorateId,
        sort: "latest",
      },
      null,
      12,
    ),
  ]);

  return {
    listing,
    images: imagesResult.ok ? imagesResult.data : [],
    seller: sellerResult.ok ? sellerResult.data : null,
    similarListings: similarResult.ok
      ? similarResult.data.items.filter((item) => item.id !== listing.id).slice(0, 8)
      : [],
    imageError: imagesResult.ok ? null : imagesResult.error,
  };
}
