import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { fetchCloudflareListings } from "@/lib/public-data/cloudflare-client";

export interface DynamicListingHydrationDependencies {
  mapListing: (
    row: Record<string, unknown>,
    categories: ClassifiedCategory[],
    governorates: ClassifiedGovernorate[],
  ) => ClassifiedListing;
  hydrateListingsWithPrimaryImages: (
    retiredClient: unknown,
    listings: ClassifiedListing[],
  ) => Promise<ClassifiedListing[]>;
}

export function fetchDynamicFilteredPublicListings(
  filters: ListingFilters,
  cursor: ListingCursor | null,
  pageSize: number,
  _dependencies: DynamicListingHydrationDependencies,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  return fetchCloudflareListings(filters, cursor, pageSize);
}
