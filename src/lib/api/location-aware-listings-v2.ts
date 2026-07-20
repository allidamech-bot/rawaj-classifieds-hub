import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { fetchPublicListings } from "@/lib/api/listings";

const pendingPublicListingReads = new Map<
  string,
  Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>>
>();

function publicListingReadKey(
  filters: ListingFilters,
  cursor: ListingCursor | null,
  pageSize: number,
): string {
  return JSON.stringify({ filters, cursor, pageSize });
}

/**
 * Compatibility entry point retained for saved-search alerts and older callers.
 * The public listings reader now owns taxonomy, location, visibility, and cursor
 * filtering in one source-side query contract, including its explicit
 * `.select(publicListingSelect)` allowlist, `.eq("status", "approved")`
 * visibility guard, and `.is("archived_at", null)` archive guard.
 *
 * Concurrent identical reads are deduplicated without retaining a stale result.
 * This prevents SSR/hydration or sibling consumers from repeating the database
 * read and Signed URL generation while preserving immediate visibility changes.
 */
export function fetchPublicListingsCanonicalAware(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const key = publicListingReadKey(filters, cursor, pageSize);
  const pending = pendingPublicListingReads.get(key);
  if (pending) return pending;

  const request = fetchPublicListings(filters, cursor, pageSize).finally(() => {
    if (pendingPublicListingReads.get(key) === request) pendingPublicListingReads.delete(key);
  });
  pendingPublicListingReads.set(key, request);
  return request;
}
