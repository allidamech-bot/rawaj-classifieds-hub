import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { getClient, mapError } from "@/lib/api/shared";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

export interface ListingTaxonomyAssignment {
  listingId: string;
  taxonomyNodeId: string;
  assignmentSource: "legacy_derived" | "explicit";
  updatedAt: string;
}

function mapAssignment(row: Record<string, unknown>): ListingTaxonomyAssignment {
  return {
    listingId: String(row.listing_id ?? row.listingId ?? ""),
    taxonomyNodeId: String(row.taxonomy_node_id ?? row.taxonomyNodeId ?? ""),
    assignmentSource:
      row.assignment_source === "explicit" || row.assignmentSource === "explicit"
        ? "explicit"
        : "legacy_derived",
    updatedAt: String(row.updated_at ?? row.updatedAt ?? ""),
  };
}

export async function fetchPublicListingTaxonomyAssignment(
  listingId: string,
): Promise<ClassifiedsResult<ListingTaxonomyAssignment | null>> {
  const normalizedListingId = listingId.trim();
  if (!normalizedListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<ListingTaxonomyAssignment | null>(
      `/v1/listings/${encodeURIComponent(normalizedListingId)}/taxonomy`,
    );
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: { code: result.code as ClassifiedsErrorCode, message: result.error },
        };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const publicListingResult = await clientResult.data
    .from("listings")
    .select("id")
    .eq("id", normalizedListingId)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter())
    .maybeSingle();
  if (publicListingResult.error) {
    return {
      ok: false,
      error: mapError(publicListingResult.error, "public_listing_taxonomy_read"),
    };
  }
  if (!publicListingResult.data) {
    return { ok: false, error: { code: "not_found", message: "هذا الإعلان غير متاح." } };
  }

  const { data, error } = await clientResult.data
    .from("listing_taxonomy_assignments")
    .select("listing_id, taxonomy_node_id, assignment_source, updated_at")
    .eq("listing_id", normalizedListingId)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error, "public_listing_taxonomy_read") };
  return { ok: true, data: data ? mapAssignment(data as Record<string, unknown>) : null };
}

export async function fetchOwnerListingTaxonomyAssignment(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ListingTaxonomyAssignment | null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لقراءة تصنيف الإعلان." },
    };
  }

  const normalizedListingId = listingId.trim();
  if (!normalizedListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<ListingTaxonomyAssignment | null>(
      `/v1/listings/${encodeURIComponent(normalizedListingId)}/taxonomy`,
    );
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: { code: result.code as ClassifiedsErrorCode, message: result.error },
        };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_taxonomy_assignments")
    .select("listing_id, taxonomy_node_id, assignment_source, updated_at")
    .eq("listing_id", normalizedListingId)
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error, "owner_listing_taxonomy_read") };
  return { ok: true, data: data ? mapAssignment(data as Record<string, unknown>) : null };
}

export async function assignOwnerListingTaxonomy(
  userId: string | null,
  listingId: string,
  taxonomyNodeId: string,
): Promise<ClassifiedsResult<ListingTaxonomyAssignment>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديد تصنيف الإعلان." },
    };
  }

  const normalizedListingId = listingId.trim();
  const normalizedNodeId = taxonomyNodeId.trim();
  if (!normalizedListingId || !normalizedNodeId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر التصنيف النهائي للإعلان." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<ListingTaxonomyAssignment>(
      `/v1/listings/${encodeURIComponent(normalizedListingId)}/taxonomy`,
      { method: "PUT", body: { taxonomyNodeId: normalizedNodeId } },
    );
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: { code: result.code as ClassifiedsErrorCode, message: result.error },
        };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_assign_listing_taxonomy", {
    p_listing_id: normalizedListingId,
    p_taxonomy_node_id: normalizedNodeId,
  });
  if (error) return { ok: false, error: mapError(error, "owner_listing_taxonomy_assign") };

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "لم يؤكد الخادم حفظ تصنيف الإعلان.",
        operation: "owner_listing_taxonomy_assign",
      },
    };
  }

  return { ok: true, data: mapAssignment(row) };
}
