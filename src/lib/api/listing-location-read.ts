import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError, rowNullableString } from "@/lib/api/shared";

export async function fetchListingLocationNodeId(
  userId: string,
  listingId: string,
): Promise<ClassifiedsResult<string | null>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listings")
    .select("location_node_id")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return { ok: false, error: { code: "not_found", message: "Listing unavailable." } };
  }

  return {
    ok: true,
    data: rowNullableString(data as Record<string, unknown>, "location_node_id"),
  };
}
