import type { ClassifiedListing, ClassifiedsErrorCode, ClassifiedsResult, ListingFilters } from "@/lib/classifieds-types";
import { fetchCloudflareNearbyListings } from "@/lib/public-data/cloudflare-client";
import {
  isValidNearbyPoint,
  normalizeNearbyRadius,
  roundNearbyPoint,
  type NearbyPoint,
  type NearbyRadiusKm,
} from "@/lib/nearby-location";

export interface NearbyListingMatch { listingId: string; distanceKm: number }
export interface NearbyListingResult { listing: ClassifiedListing; distanceKm: number }
export interface NearbyListingsRequest {
  point: NearbyPoint; radiusKm?: NearbyRadiusKm; limit?: number; filters?: ListingFilters;
}

export async function fetchNearbyListingMatches(
  request: NearbyListingsRequest,
): Promise<ClassifiedsResult<NearbyListingMatch[]>> {
  const result = await fetchNearbyPublicListings(request);
  return result.ok
    ? { ok: true, data: result.data.map((item) => ({ listingId: item.listing.id, distanceKm: item.distanceKm })) }
    : result;
}

export async function fetchNearbyPublicListings(
  request: NearbyListingsRequest,
): Promise<ClassifiedsResult<NearbyListingResult[]>> {
  if (!isValidNearbyPoint(request.point)) return invalidPointResult();
  const point = roundNearbyPoint(request.point);
  const filters = request.filters ?? {};
  const result = await fetchCloudflareNearbyListings<NearbyListingResult[]>({
    latitude: point.latitude,
    longitude: point.longitude,
    radiusKm: normalizeNearbyRadius(request.radiusKm),
    limit: Math.max(1, Math.min(request.limit ?? 60, 100)),
    categoryId: filters.categoryId,
    subcategoryId: filters.subcategoryId,
    governorateId: filters.governorateId,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    priceType: filters.priceType,
    condition: filters.condition,
  });
  return result.ok
    ? result
    : { ok: false, error: { code: result.error.code as ClassifiedsErrorCode, message: result.error.message, operation: "public_nearby_listing_matches" } };
}

function invalidPointResult<T>(): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message: "إحداثيات الموقع غير صالحة.", operation: "public_nearby_listing_matches" } };
}
