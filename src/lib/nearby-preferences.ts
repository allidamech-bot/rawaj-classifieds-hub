import type { NearbyRadiusKm } from "@/lib/nearby-location";

const STORAGE_KEY = "rawaj.nearby-discovery.v1";
const VALID_RADII: NearbyRadiusKm[] = [5, 10, 25, 50, 100];

export interface NearbyDiscoveryPreference {
  enabled: boolean;
  radiusKm: NearbyRadiusKm;
}

const DEFAULT_PREFERENCE: NearbyDiscoveryPreference = {
  enabled: false,
  radiusKm: 25,
};

export function readNearbyDiscoveryPreference(): NearbyDiscoveryPreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<NearbyDiscoveryPreference>;
    const radiusKm = VALID_RADII.includes(parsed.radiusKm as NearbyRadiusKm)
      ? (parsed.radiusKm as NearbyRadiusKm)
      : DEFAULT_PREFERENCE.radiusKm;
    return { enabled: parsed.enabled === true, radiusKm };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function writeNearbyDiscoveryPreference(preference: NearbyDiscoveryPreference) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ enabled: preference.enabled, radiusKm: preference.radiusKm }),
  );
}

export function clearNearbyDiscoveryPreference() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
