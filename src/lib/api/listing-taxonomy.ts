import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export interface ListingTaxonomyAssignment {
  listingId: string;
  taxonomyNodeId: string;
  assignmentSource: "legacy_derived" | "explicit";
  updatedAt: string;
}

export async function fetchPublicListingTaxonomyAssignment(
  listingId: string,
): Promise<ClassifiedsResult<ListingTaxonomyAssignment | null>> {
  return readAssignment(listingId);
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
  return readAssignment(listingId);
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
  const cleanListingId = listingId.trim();
  const cleanNodeId = taxonomyNodeId.trim();
  if (!cleanListingId || !cleanNodeId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر التصنيف النهائي للإعلان." },
    };
  }

  const result = await cloudflareApiRequest<ListingTaxonomyAssignment>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/taxonomy`,
    { method: "PUT", body: { taxonomyNodeId: cleanNodeId } },
  );
  return result.ok ? { ok: true, data: result.data } : failure(result);
}

async function readAssignment(
  listingId: string,
): Promise<ClassifiedsResult<ListingTaxonomyAssignment | null>> {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }
  const result = await cloudflareApiRequest<ListingTaxonomyAssignment | null>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/taxonomy`,
  );
  return result.ok ? { ok: true, data: result.data } : failure(result);
}

function failure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}
