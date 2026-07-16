import type { ClassifiedsResult } from "@/lib/classifieds-types";
import type { CanonicalLocationNode } from "@/lib/api/location-taxonomy";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { fetchLocationPath } from "@/lib/api/location-taxonomy";
import { getClient, mapError, rowNullableString } from "@/lib/api/shared";

export async function fetchPublicListingLocationPath(
  listingId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  const normalizedListingId = listingId.trim();
  if (!normalizedListingId) {
    return { ok: false, error: { code: "validation_error", message: "Listing unavailable." } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data
    .from("listings")
    .select("location_node_id,district_ar")
    .eq("id", normalizedListingId)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter())
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error, "public_listing_location_read") };
  if (!data) return { ok: false, error: { code: "not_found", message: "Listing unavailable." } };

  const row = data as Record<string, unknown>;
  const legacyDistrict = rowNullableString(row, "district_ar")?.trim() ?? "";
  const locationNodeId =
    rowNullableString(row, "location_node_id") ??
    (legacyDistrict.startsWith("@") ? legacyDistrict.slice(1) : null);
  if (!locationNodeId) return { ok: true, data: [] };
  return fetchLocationPath(locationNodeId);
}

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
