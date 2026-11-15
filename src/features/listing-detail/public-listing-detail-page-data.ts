import {
  fetchPublicCategories,
  fetchPublicListingTaxonomyAssignment,
  fetchPublicListings,
  fetchPublicSellerProfile,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedListing,
  ListingImage,
  PublicSellerProfile,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import type { CanonicalLocationNode } from "@/lib/api/location-taxonomy";
import { fetchCloudflareListingDetail } from "@/lib/public-data/cloudflare-client";
import { fetchPublicListingLocationPath } from "@/lib/api/listing-location-read";
import { resolveListingTaxonomyContext } from "@/lib/listing-taxonomy-context";
import {
  isPublicListingVisible,
  normalizePublicListingImages,
} from "@/lib/public-listing-presentation";

export interface PublicListingDetailPageData {
  listing: ClassifiedListing;
  images: ListingImage[];
  seller: PublicSellerProfile | null;
  similarListings: ClassifiedListing[];
  category: ClassifiedCategory | null;
  taxonomyNode: TaxonomyNode | null;
  taxonomyPath: TaxonomyNode[];
  legacySubcategory: { nameAr: string; nameEn: string | null } | null;
  locationPath: CanonicalLocationNode[];
  imagesUnavailable: boolean;
}

export async function loadPublicListingDetailPageData(
  listingId: string,
): Promise<PublicListingDetailPageData | null> {
  // One Worker request returns the public listing and all its media. Avoid
  // re-fetching /v1/listings/:id for the image and location sub-sections.
  const listingResult = await fetchCloudflareListingDetail(listingId);
  if (!listingResult.ok) return null;

  const listing = listingResult.data.listing;
  if (!isPublicListingVisible(listing)) return null;
  const [
    sellerResult,
    similarResult,
    categoriesResult,
    subcategoriesResult,
    taxonomyNodesResult,
    taxonomyAssignmentResult,
    locationPathResult,
  ] = await Promise.all([
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
    fetchPublicCategories(),
    fetchPublicSubcategories(),
    fetchPublicTaxonomyNodes(),
    fetchPublicListingTaxonomyAssignment(listing.id),
    fetchPublicListingLocationPath(listing.id, listing),
  ]);
  const taxonomyContext = resolveListingTaxonomyContext({
    taxonomyNodes: taxonomyNodesResult.ok ? taxonomyNodesResult.data : [],
    canonicalTaxonomyNodeId: taxonomyAssignmentResult.ok
      ? taxonomyAssignmentResult.data?.taxonomyNodeId
      : null,
    detailsTaxonomyNodeId:
      typeof listing.details._taxonomy_node_id === "string"
        ? listing.details._taxonomy_node_id
        : null,
    categoryId: listing.categoryId,
    subcategoryId: listing.subcategoryId,
  });

  return {
    listing,
    images: normalizePublicListingImages(listingResult.data.images, listing),
    seller: sellerResult.ok ? sellerResult.data : null,
    similarListings: similarResult.ok
      ? similarResult.data.items.filter((item) => item.id !== listing.id).slice(0, 8)
      : [],
    category: categoriesResult.ok
      ? (categoriesResult.data.find((item) => item.id === listing.categoryId) ?? null)
      : null,
    taxonomyNode: taxonomyContext.selectedNode,
    taxonomyPath: taxonomyContext.path,
    legacySubcategory: subcategoriesResult.ok
      ? (() => {
          const subcategory = subcategoriesResult.data.find(
            (item) => item.id === listing.subcategoryId,
          );
          return subcategory ? { nameAr: subcategory.nameAr, nameEn: subcategory.nameEn } : null;
        })()
      : null,
    locationPath: locationPathResult.ok ? locationPathResult.data : [],
    imagesUnavailable: false,
  };
}
