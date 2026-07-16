import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { fetchPublicListings } from "@/lib/api/listings";

/**
 * Compatibility entry point retained for saved-search alerts and older callers.
 * The public listings reader now owns taxonomy, location, visibility, and cursor
 * filtering in one source-side query contract, including its explicit
 * `.select(publicListingSelect)` allowlist, `.eq("status", "approved")`
 * visibility guard, and `.is("archived_at", null)` archive guard.
 */
export function fetchPublicListingsCanonicalAware(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  return fetchPublicListings(filters, cursor, pageSize);
}
