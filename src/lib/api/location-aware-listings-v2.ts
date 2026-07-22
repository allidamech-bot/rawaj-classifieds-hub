import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { fetchPublicListings } from "@/lib/api/listings";
import { fetchCloudflareListings } from "@/lib/public-data/cloudflare-client";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const pendingPublicListingReads = new Map<
  string,
  Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>>
>();

function publicListingReadKey(
  filters: ListingFilters,
  cursor: ListingCursor | null,
  pageSize: number,
): string {
  return JSON.stringify({
    provider: isCloudflarePublicDataProvider() ? "cloudflare" : "supabase",
    filters,
    cursor,
    pageSize,
  });
}

/**
 * Public marketplace listing reads use one explicit provider selected at build
 * time. Concurrent identical reads are deduplicated without retaining stale
 * completed results. There is deliberately no silent cross-provider fallback:
 * a failed Cloudflare read remains visible as a Cloudflare failure instead of
 * returning potentially inconsistent Supabase data from another snapshot.
 */
export function fetchPublicListingsCanonicalAware(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const key = publicListingReadKey(filters, cursor, pageSize);
  const pending = pendingPublicListingReads.get(key);
  if (pending) return pending;

  const request = (isCloudflarePublicDataProvider()
    ? fetchCloudflareListings(filters, cursor, pageSize)
    : fetchPublicListings(filters, cursor, pageSize)
  ).finally(() => {
    if (pendingPublicListingReads.get(key) === request) pendingPublicListingReads.delete(key);
  });
  pendingPublicListingReads.set(key, request);
  return request;
}
