import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { fetchCloudflareListings } from "@/lib/public-data/cloudflare-client";

/**
 * Historical entry point retained for callers and tests. Canonical location scopes,
 * legacy districts, cursors, taxonomy and attribute filters are all resolved by D1.
 */
export function fetchPublicListingsLocationAware(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  return fetchCloudflareListings(filters, cursor, pageSize);
}
