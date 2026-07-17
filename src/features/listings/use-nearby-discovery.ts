import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNearbyPublicListings, type NearbyListingResult } from "@/lib/api/nearby-listings";
import { requestNearbyPosition, type NearbyGeolocationStatus } from "@/lib/nearby-geolocation";
import type { ListingFilters } from "@/lib/classifieds-types";
import type { NearbyPoint, NearbyRadiusKm } from "@/lib/nearby-location";

export type NearbyDiscoveryError = NearbyGeolocationStatus | "request_failed" | null;

export function useNearbyDiscovery(filters: ListingFilters) {
  const pointRef = useRef<NearbyPoint | null>(null);
  const requestRef = useRef(0);
  const [active, setActive] = useState(false);
  const [radiusKm, setRadiusKmState] = useState<NearbyRadiusKm>(25);
  const [items, setItems] = useState<NearbyListingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NearbyDiscoveryError>(null);

  const load = useCallback(
    async (point: NearbyPoint, radius: NearbyRadiusKm) => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setError(null);
      const result = await fetchNearbyPublicListings({
        point,
        radiusKm: radius,
        limit: 60,
        filters,
      });
      if (requestRef.current !== requestId) return;
      if (!result.ok) {
        setError("request_failed");
        setLoading(false);
        return;
      }
      setItems(result.data);
      setActive(true);
      setLoading(false);
    },
    [filters],
  );

  const activate = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const position = await requestNearbyPosition();
    if (requestRef.current !== requestId) return;
    if (!position.ok) {
      setError(position.status);
      setLoading(false);
      return;
    }
    pointRef.current = position.point;
    await load(position.point, radiusKm);
  }, [load, radiusKm]);

  const setRadiusKm = useCallback((radius: NearbyRadiusKm) => {
    setRadiusKmState(radius);
  }, []);

  const clear = useCallback(() => {
    requestRef.current += 1;
    pointRef.current = null;
    setActive(false);
    setItems([]);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    const point = pointRef.current;
    if (active && point) void load(point, radiusKm);
  }, [active, load, radiusKm]);

  return { active, radiusKm, items, loading, error, activate, setRadiusKm, clear };
}
