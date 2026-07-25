import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { fetchCloudflareListings } from "@/lib/public-data/cloudflare-client";

const pendingPublicListingReads = new Map<
  string,
  Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>>
>();

function publicListingReadKey(
  filters: ListingFilters,
  cursor: ListingCursor | null,
  pageSize: number,
): string {
  return JSON.stringify({ provider: "cloudflare", filters, cursor, pageSize });
}

export function fetchPublicListingsCanonicalAware(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const key = publicListingReadKey(filters, cursor, pageSize);
  const pending = pendingPublicListingReads.get(key);
  if (pending) return pending;

  const request = fetchCloudflareListings(filters, cursor, pageSize).finally(() => {
    if (pendingPublicListingReads.get(key) === request) pendingPublicListingReads.delete(key);
  });
  pendingPublicListingReads.set(key, request);
  return request;
}
