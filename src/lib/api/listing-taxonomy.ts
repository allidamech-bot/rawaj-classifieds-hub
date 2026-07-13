import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError } from "@/lib/api/shared";

export interface ListingTaxonomyAssignment {
  listingId: string;
  taxonomyNodeId: string;
  assignmentSource: "legacy_derived" | "explicit";
  updatedAt: string;
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

  return {
    ok: true,
    data: {
      listingId: String(row.listing_id ?? ""),
      taxonomyNodeId: String(row.taxonomy_node_id ?? ""),
      assignmentSource: row.assignment_source === "explicit" ? "explicit" : "legacy_derived",
      updatedAt: String(row.updated_at ?? ""),
    },
  };
}
