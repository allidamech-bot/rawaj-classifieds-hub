import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import type { CanonicalLocationNode } from "@/lib/api/location-taxonomy";
import { fetchLocationPath } from "@/lib/api/location-taxonomy";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { fetchCloudflareListingDetail } from "@/lib/public-data/cloudflare-client";

export async function fetchPublicListingLocationPath(
  listingId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  try {
    const cleanId = listingId.trim();
    if (!cleanId) return unavailable();
    const result = await fetchCloudflareListingDetail(cleanId);
    if (!result.ok) return result;
    const listing = result.data.listing;
    const locationNodeId =
      listing.locationNodeId ??
      (listing.districtAr?.startsWith("@") ? listing.districtAr.slice(1).trim() : null);
    return locationNodeId ? await fetchLocationPath(locationNodeId) : { ok: true, data: [] };
  } catch (error) {
    return unexpectedFailure(error, "public_listing_location");
  }
}

export async function fetchListingLocationNodeId(
  userId: string,
  listingId: string,
): Promise<ClassifiedsResult<string | null>> {
  try {
    if (!userId)
      return { ok: false, error: { code: "auth_required", message: "تسجيل الدخول مطلوب." } };
    const cleanId = listingId.trim();
    if (!cleanId) return unavailable();
    const result = await cloudflareApiRequest<{ listing: Record<string, unknown> }>(
      `/api/listings/${encodeURIComponent(cleanId)}`,
    );
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.code as ClassifiedsErrorCode, message: result.error },
      };
    }
    const raw = result.data.listing?.locationNodeId ?? result.data.listing?.location_node_id;
    return { ok: true, data: typeof raw === "string" && raw.trim() ? raw.trim() : null };
  } catch (error) {
    return unexpectedFailure(error, "owner_listing_location");
  }
}

function unavailable<T>(): ClassifiedsResult<T> {
  return { ok: false, error: { code: "not_found", message: "Listing unavailable." } };
}

function unexpectedFailure<T>(error: unknown, operation: string): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "unknown",
      message: "تعذر تحميل موقع الإعلان. حاول مرة أخرى.",
      details: error instanceof Error ? error.message : String(error),
      operation,
    },
  };
}
