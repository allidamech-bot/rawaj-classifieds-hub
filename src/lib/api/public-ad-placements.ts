import { normalizeAdPlacementMediaUrl } from "@/lib/ad-placement-media-url";
import { getClient, mapError, rowNumber, rowString } from "@/lib/api/shared";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export type AdPlacementDevice = "mobile" | "desktop";

export interface PublicAdPlacement {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  priority: number;
}

const ACTIVE_PLACEMENT_CACHE_TTL_MS = 60_000;
const activePlacementCache = new Map<
  string,
  { expiresAt: number; result: ClassifiedsResult<PublicAdPlacement[]> }
>();
const activePlacementRequests = new Map<string, Promise<ClassifiedsResult<PublicAdPlacement[]>>>();
let activePlacementCacheGeneration = 0;

export function invalidateActiveAdPlacementCache(): void {
  activePlacementCacheGeneration += 1;
  activePlacementCache.clear();
  activePlacementRequests.clear();
}

export async function fetchActiveAdPlacements(
  placementPage: AdPlacementPage,
  device: AdPlacementDevice,
): Promise<ClassifiedsResult<PublicAdPlacement[]>> {
  const cacheKey = `${placementPage}:${device}`;
  const cached = activePlacementCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = activePlacementRequests.get(cacheKey);
  if (pending) return pending;

  const requestGeneration = activePlacementCacheGeneration;
  const request = loadActiveAdPlacements(placementPage, device).then((result) => {
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

async function loadActiveAdPlacements(
  placementPage: AdPlacementPage,
  device: AdPlacementDevice,
): Promise<ClassifiedsResult<PublicAdPlacement[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_fetch_active_ad_placements", {
    p_placement_page: placementPage,
    p_device: device,
  });

  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[])
      .map((row) => ({
        id: rowString(row, "id"),
        imageUrl: normalizeAdPlacementMediaUrl(rowString(row, "image_url")),
        destinationUrl: rowString(row, "destination_url"),
        priority: rowNumber(row, "priority"),
      }))
      .filter((placement) => placement.id && placement.imageUrl && placement.destinationUrl),
  };
}
