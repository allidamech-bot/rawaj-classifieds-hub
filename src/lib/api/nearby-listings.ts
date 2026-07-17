import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError, rowNumber, rowString } from "@/lib/api/shared";
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

export interface NearbyListingsRequest {
  point: NearbyPoint;
  radiusKm?: NearbyRadiusKm;
  limit?: number;
}

export async function fetchNearbyListingMatches(
  request: NearbyListingsRequest,
): Promise<ClassifiedsResult<NearbyListingMatch[]>> {
  if (!isValidNearbyPoint(request.point)) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "إحداثيات الموقع غير صالحة.",
        operation: "public_nearby_listing_matches",
      },
    };
  }

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
