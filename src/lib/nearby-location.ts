export const NEARBY_RADIUS_OPTIONS_KM = [5, 10, 25, 50, 100] as const;

export type NearbyRadiusKm = (typeof NEARBY_RADIUS_OPTIONS_KM)[number];

export interface NearbyPoint {
  latitude: number;
  longitude: number;
}

const COORDINATE_PRECISION = 2;

export function normalizeNearbyRadius(value: number | null | undefined): NearbyRadiusKm {
  return NEARBY_RADIUS_OPTIONS_KM.includes(value as NearbyRadiusKm)
    ? (value as NearbyRadiusKm)
    : 25;
}

export function roundNearbyPoint(point: NearbyPoint): NearbyPoint {
  return {
    latitude: roundCoordinate(point.latitude),
    longitude: roundCoordinate(point.longitude),
  };
}

export function isValidNearbyPoint(point: NearbyPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}
