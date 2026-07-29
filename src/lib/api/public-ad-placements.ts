import type { AdPlacementPage } from "@/lib/api/ad-placements";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { fetchCloudflareAdPlacements } from "@/lib/public-data/cloudflare-client";

export type AdPlacementDevice = "mobile" | "desktop";

export interface PublicAdPlacement {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  priority: number;
}

const ACTIVE_PLACEMENT_CACHE_TTL_MS = 5 * 60_000;
const activePlacementCache = new Map<
  string,
  { expiresAt: number; result: ClassifiedsResult<PublicAdPlacement[]> }
>();
const activePlacementRequests = new Map<string, Promise<ClassifiedsResult<PublicAdPlacement[]>>>();
let activePlacementCacheGeneration = 0;

const AD_PLACEMENT_INVALIDATION_EVENT = "rawaj:ad-placement-invalidation";

type AdPlacementInvalidationListener = () => void;
const adPlacementInvalidationListeners = new Set<AdPlacementInvalidationListener>();

function activePlacementCacheKey(
  placementPage: AdPlacementPage,
  device: AdPlacementDevice,
): string {
  return `${placementPage}:${device}`;
}

const broadcastChannel: BroadcastChannel | null = (() => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(AD_PLACEMENT_INVALIDATION_EVENT);
  } catch {
    return null;
  }
})();

if (broadcastChannel) {
  broadcastChannel.onmessage = () => {
    activePlacementCacheGeneration += 1;
    activePlacementCache.clear();
    activePlacementRequests.clear();
    emitAdPlacementInvalidation();
  };
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (event) => {
    if (
      event.key === `broadcast:${AD_PLACEMENT_INVALIDATION_EVENT}` ||
      event.key === AD_PLACEMENT_INVALIDATION_EVENT
    ) {
      activePlacementCacheGeneration += 1;
      activePlacementCache.clear();
      activePlacementRequests.clear();
      emitAdPlacementInvalidation();
    }
  });
}

function emitAdPlacementInvalidation(): void {
  for (const listener of adPlacementInvalidationListeners) {
    try {
      listener();
    } catch {
      /* listener errors must not break invalidation propagation */
    }
  }
}

export function onAdPlacementInvalidation(listener: AdPlacementInvalidationListener): () => void {
  adPlacementInvalidationListeners.add(listener);
  return () => adPlacementInvalidationListeners.delete(listener);
}

export function invalidateActiveAdPlacementCache(): void {
  activePlacementCacheGeneration += 1;
  activePlacementCache.clear();
  activePlacementRequests.clear();
  emitAdPlacementInvalidation();
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "invalidate" });
    } catch {
      /* cross-tab broadcast is best-effort */
    }
  } else if (typeof window !== "undefined" && typeof window.localStorage === "object") {
    try {
      window.localStorage.setItem(
        `broadcast:${AD_PLACEMENT_INVALIDATION_EVENT}`,
        String(Date.now()),
      );
    } catch {
      /* storage fallback is best-effort */
    }
  }
}

export async function refreshActiveAdPlacements(
  placementPage: AdPlacementPage,
  device: AdPlacementDevice,
): Promise<ClassifiedsResult<PublicAdPlacement[]>> {
  const cacheKey = activePlacementCacheKey(placementPage, device);
  activePlacementCacheGeneration += 1;
  activePlacementCache.delete(cacheKey);
  activePlacementRequests.delete(cacheKey);
  return fetchActiveAdPlacements(placementPage, device);
}

export async function fetchActiveAdPlacements(
  placementPage: AdPlacementPage,
  device: AdPlacementDevice,
): Promise<ClassifiedsResult<PublicAdPlacement[]>> {
  const cacheKey = activePlacementCacheKey(placementPage, device);
  const cached = activePlacementCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = activePlacementRequests.get(cacheKey);
  if (pending) return pending;

  const requestGeneration = activePlacementCacheGeneration;
  const request = fetchCloudflareAdPlacements(placementPage, device).then((result) => {
    activePlacementRequests.delete(cacheKey);
    if (result.ok && requestGeneration === activePlacementCacheGeneration) {
      activePlacementCache.set(cacheKey, {
        expiresAt: Date.now() + ACTIVE_PLACEMENT_CACHE_TTL_MS,
        result,
      });
    }
    return result;
  });

  activePlacementRequests.set(cacheKey, request);
  return request;
}
