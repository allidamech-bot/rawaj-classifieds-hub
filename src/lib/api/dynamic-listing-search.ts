import type { ClassifiedsResult, ListingCursor, ListingFilters } from "@/lib/classifieds-types";
import { fetchCloudflareListings } from "@/lib/public-data/cloudflare-client";

export interface DynamicListingSearchPage {
  taxonomyVersionId: string | null;
  totalCount: number;
  listingIds: string[];
  nextCursor: ListingCursor | null;
}
export interface DynamicListingSearchQuery {
  filters: ListingFilters;
  locationNodeIds?: string[];
  cursor: ListingCursor | null;
  pageSize: number;
}

export async function fetchDynamicListingSearchPage(
  query: DynamicListingSearchQuery,
): Promise<ClassifiedsResult<DynamicListingSearchPage>> {
  const filters: ListingFilters = {
    ...query.filters,
    ...(query.locationNodeIds?.length === 1 ? { districtAr: `@${query.locationNodeIds[0]}` } : {}),
  };
  const result = await fetchCloudflareListings(filters, query.cursor, query.pageSize);
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      taxonomyVersionId: null,
      totalCount: result.data.totalCount ?? result.data.items.length,
      listingIds: result.data.items.map((listing) => listing.id),
      nextCursor: result.data.nextCursor,
    },
  };
}

export function hasDynamicListingFilters(filters: ListingFilters): boolean {
  return Boolean(filters.attributeFilters && Object.keys(filters.attributeFilters).length > 0);
}
