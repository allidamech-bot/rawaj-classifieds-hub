import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNearbyPublicListings, type NearbyListingResult } from "@/lib/api/nearby-listings";
import { requestNearbyPosition, type NearbyGeolocationStatus } from "@/lib/nearby-geolocation";
import {
  clearNearbyDiscoveryPreference,
  readNearbyDiscoveryPreference,
  writeNearbyDiscoveryPreference,
} from "@/lib/nearby-preferences";
import type { ListingFilters } from "@/lib/classifieds-types";
import type { NearbyPoint, NearbyRadiusKm } from "@/lib/nearby-location";

export type NearbyDiscoveryError = NearbyGeolocationStatus | "request_failed" | null;

export function useNearbyDiscovery(filters: ListingFilters) {
  const pointRef = useRef<NearbyPoint | null>(null);
  const requestRef = useRef(0);
  const restoredRef = useRef(false);
  const enabledRef = useRef(false);
  const [active, setActive] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [radiusKm, setRadiusKmState] = useState<NearbyRadiusKm>(25);
  const [items, setItems] = useState<NearbyListingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NearbyDiscoveryError>(null);

  const updateEnabled = useCallback((next: boolean) => {
    enabledRef.current = next;
    setEnabled(next);
  }, []);

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

  const locateAndLoad = useCallback(
    async (persistEnabled: boolean, radiusOverride?: NearbyRadiusKm) => {
      const effectiveRadius = radiusOverride ?? radiusKm;
      const requestId = ++requestRef.current;
      setLoading(true);
      setError(null);
      const position = await requestNearbyPosition();
      if (requestRef.current !== requestId) return;
      if (!position.ok) {
        setError(position.status);
        setLoading(false);
        setActive(false);
        if (position.status === "permission_denied") {
          updateEnabled(false);
          clearNearbyDiscoveryPreference();
        }
        return;
      }
      pointRef.current = position.point;
      updateEnabled(true);
      if (persistEnabled) {
        writeNearbyDiscoveryPreference({ enabled: true, radiusKm: effectiveRadius });
      }
      await load(position.point, effectiveRadius);
    },
    [load, radiusKm, updateEnabled],
  );

  const activate = useCallback(() => locateAndLoad(true), [locateAndLoad]);
  const refresh = useCallback(() => locateAndLoad(false), [locateAndLoad]);

  const setRadiusKm = useCallback((radius: NearbyRadiusKm) => {
    setRadiusKmState(radius);
    if (enabledRef.current) {
      writeNearbyDiscoveryPreference({ enabled: true, radiusKm: radius });
    }
  }, []);

  const clear = useCallback(() => {
    requestRef.current += 1;
    pointRef.current = null;
    setActive(false);
    updateEnabled(false);
    setItems([]);
    setLoading(false);
    setError(null);
    clearNearbyDiscoveryPreference();
  }, [updateEnabled]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const preference = readNearbyDiscoveryPreference();
    setRadiusKmState(preference.radiusKm);
    updateEnabled(preference.enabled);
    if (preference.enabled) void locateAndLoad(false, preference.radiusKm);
  }, [locateAndLoad, updateEnabled]);

  useEffect(() => {
    const point = pointRef.current;
    if (active && point) void load(point, radiusKm);
  }, [active, load, radiusKm]);

  return {
    active,
    enabled,
    radiusKm,
    items,
    loading,
    error,
    activate,
    refresh,
    setRadiusKm,
    clear,
  };
}
