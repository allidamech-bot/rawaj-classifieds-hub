import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { resolveCanonicalLocationIds } from "@/lib/api/canonical-location-filter";
import { fetchDynamicListingSearchPage } from "@/lib/api/dynamic-listing-search";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { publicListingSelect } from "@/lib/api/public-fields";
import { readReferences } from "@/lib/api/references";
import { getClient, mapError } from "@/lib/api/shared";
import { sanitizePublicListing } from "@/lib/public-listing-presentation";

export interface DynamicListingHydrationDependencies {
  mapListing: (
    row: Record<string, unknown>,
    categories: ClassifiedCategory[],
    governorates: ClassifiedGovernorate[],
  ) => ClassifiedListing;
  hydrateListingsWithPrimaryImages: (
    client: SupabaseClient,
    listings: ClassifiedListing[],
  ) => Promise<ClassifiedListing[]>;
}

export async function fetchDynamicFilteredPublicListings(
  filters: ListingFilters,
  cursor: ListingCursor | null,
  pageSize: number,
  dependencies: DynamicListingHydrationDependencies,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;

  const references = await readReferences(client);
  if (!references.ok) return references;

  let locationNodeIds: string[] | undefined;
  if (filters.districtAr?.startsWith("@")) {
    const locationResult = await resolveCanonicalLocationIds(client, filters.districtAr.slice(1));
    if (locationResult.ok) locationNodeIds = locationResult.data;
  }

  const safePageSize = Math.max(1, Math.min(Math.trunc(pageSize), 50));
  const pageResult = await fetchDynamicListingSearchPage({
    filters,
    locationNodeIds,
    cursor,
    pageSize: safePageSize,
  });
  if (!pageResult.ok) return pageResult;

  const page = pageResult.data;
  if (page.listingIds.length === 0) {
    return {
      ok: true,
      data: {
        items: [],
        nextCursor: page.nextCursor,
        pageSize: safePageSize,
        totalCount: page.totalCount,
      },
    };
  }

  const { data, error } = await client
    .from("listings")
    .select(publicListingSelect)
    .in("id", page.listingIds)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter());
  if (error) {
    return {
      ok: false,
      error: mapError(error, "public_dynamic_listing_hydration"),
    };
  }

  const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    sanitizePublicListing(
      dependencies.mapListing(row, references.categories, references.governorates),
    ),
  );
  const hydrated = await dependencies.hydrateListingsWithPrimaryImages(client, mapped);
  const listingById = new Map(hydrated.map((listing) => [listing.id, listing]));

  return {
    ok: true,
    data: {
      items: page.listingIds.flatMap((listingId) => {
        const listing = listingById.get(listingId);
        return listing ? [listing] : [];
      }),
      nextCursor: page.nextCursor,
      pageSize: safePageSize,
      totalCount: page.totalCount,
    },
  };
}
