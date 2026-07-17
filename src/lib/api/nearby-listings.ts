import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingFilters,
} from "@/lib/classifieds-types";
import { getClient, mapError, rowNumber, rowString } from "@/lib/api/shared";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { publicListingSelect } from "@/lib/api/public-fields";
import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";
import { readReferences } from "@/lib/api/references";
import {
  isValidNearbyPoint,
  normalizeNearbyRadius,
  roundNearbyPoint,
  type NearbyPoint,
  type NearbyRadiusKm,
} from "@/lib/nearby-location";

export interface NearbyListingMatch {
  listingId: string;
  distanceKm: number;
}

export interface NearbyListingResult {
  listing: ClassifiedListing;
  distanceKm: number;
}

export interface NearbyListingsRequest {
  point: NearbyPoint;
  radiusKm?: NearbyRadiusKm;
  limit?: number;
  filters?: ListingFilters;
}

export async function fetchNearbyListingMatches(
  request: NearbyListingsRequest,
): Promise<ClassifiedsResult<NearbyListingMatch[]>> {
  if (!isValidNearbyPoint(request.point)) return invalidPointResult();

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const point = roundNearbyPoint(request.point);
  const radiusKm = normalizeNearbyRadius(request.radiusKm);
  const limit = Math.max(1, Math.min(request.limit ?? 60, 100));

  const { data, error } = await clientResult.data.rpc("rawaj_public_nearby_listing_matches", {
    user_latitude: point.latitude,
    user_longitude: point.longitude,
    radius_km: radiusKm,
    result_limit: limit,
  });

  if (error) {
    return {
      ok: false,
      error: {
        ...mapError(error),
        operation: "public_nearby_listing_matches",
      },
    };
  }

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      listingId: rowString(row, "listing_id"),
      distanceKm: rowNumber(row, "distance_km"),
    })),
  };
}

export async function fetchNearbyPublicListings(
  request: NearbyListingsRequest,
): Promise<ClassifiedsResult<NearbyListingResult[]>> {
  const matchesResult = await fetchNearbyListingMatches(request);
  if (!matchesResult.ok) return matchesResult;
  if (matchesResult.data.length === 0) return { ok: true, data: [] };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const references = await readReferences(client);
  if (!references.ok) return references;

  const ids = matchesResult.data.map((match) => match.listingId);
  const filters = request.filters ?? {};
  let query = client
    .from("listings")
    .select(publicListingSelect)
    .in("id", ids)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter());

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.subcategoryId) query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.governorateId) query = query.eq("governorate_id", filters.governorateId);
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  if (filters.priceType) query = query.eq("price_type", filters.priceType);
  if (filters.condition) query = query.eq("condition", filters.condition);

  const { data, error } = await query;
  if (error) return { ok: false, error: mapError(error) };

  const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapListing(row, references.data.categories, references.data.governorates),
  );
  const hydrated = await hydrateListingsWithPrimaryImages(client, mapped);
  const listingById = new Map(hydrated.map((listing) => [listing.id, listing]));

  return {
    ok: true,
    data: matchesResult.data.flatMap((match) => {
      const listing = listingById.get(match.listingId);
      return listing ? [{ listing, distanceKm: match.distanceKm }] : [];
    }),
  };
}

function invalidPointResult(): ClassifiedsResult<never> {
  return {
    ok: false,
    error: {
      code: "validation_error",
      message: "إحداثيات الموقع غير صالحة.",
      operation: "public_nearby_listing_matches",
    },
  };
}
