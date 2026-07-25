import { mapListing } from "@/lib/api/listings";
import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateListingPayload,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export async function createOwnerDraftListingIdempotent(
  userId: string | null,
  payload: CreateListingPayload,
  creationRequestId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ مسودة الإعلان." },
    };
  }

  const cleanRequestId = creationRequestId.trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(cleanRequestId)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد جلسة إنشاء الإعلان." },
    };
  }

  const canonicalLocationId = payload.districtAr?.trim().startsWith("@")
    ? payload.districtAr.trim().slice(1)
    : null;
  const result = await cloudflareApiRequest<{ id: string; status: string }>("/v1/listings", {
    method: "POST",
    body: {
      ...payload,
      categoryId: payload.categoryId.trim(),
      subcategoryId: payload.subcategoryId?.trim() || null,
      governorateId: payload.governorateId.trim(),
      title: payload.title.trim(),
      description: payload.description.trim(),
      districtAr: canonicalLocationId ? null : payload.districtAr?.trim() || null,
      locationNodeId: canonicalLocationId || null,
      contactName: payload.contactName?.trim() || null,
      creationRequestId: cleanRequestId,
      submit: false,
    },
  });
  if (!result.ok) return failure(result);

  const detail = await cloudflareApiRequest<{ listing: Record<string, unknown> }>(
    `/api/listings/${encodeURIComponent(result.data.id)}`,
  );
  return detail.ok ? { ok: true, data: mapListing(detail.data.listing) } : failure(detail);
}

function failure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}
