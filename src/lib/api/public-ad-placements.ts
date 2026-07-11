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

export async function fetchActiveAdPlacements(
  placementPage: AdPlacementPage,
  device: AdPlacementDevice,
): Promise<ClassifiedsResult<PublicAdPlacement[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_fetch_active_ad_placements",
    {
      p_placement_page: placementPage,
      p_device: device,
    },
  );

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
      .filter(
        (placement) =>
          placement.id && placement.imageUrl && placement.destinationUrl,
      ),
  };
}
