import {
  createOwnerDraftListing as createOwnerDraftListingLegacy,
  mapListing,
} from "@/lib/api/listings";
import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";
import { getClient, mapError } from "@/lib/api/shared";
import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateListingPayload,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

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
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ id: string; status: string }>("/v1/listings", {
      method: "POST",
      body: { ...payload, submit: false },
    });
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.code as ClassifiedsErrorCode, message: result.error },
      };
    }
    const detail = await cloudflareApiRequest<{
      listing: Record<string, unknown>;
    }>(`/api/listings/${encodeURIComponent(result.data.id)}`);
    return detail.ok
      ? { ok: true, data: mapListing(detail.data.listing) }
      : {
          ok: false,
          error: { code: detail.code as ClassifiedsErrorCode, message: detail.error },
        };
  }

  const cleanRequestId = creationRequestId.trim();
  if (!cleanRequestId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد جلسة إنشاء الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const title = payload.title.trim();
  const description = payload.description.trim();
  if (
    !payload.categoryId.trim() ||
    (!payload.governorateId.trim() && !payload.districtAr?.trim().startsWith("@")) ||
    title.length < 4
  ) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "أكمل القسم والمحافظة والعنوان قبل حفظ المسودة.",
      },
    };
  }

  if (payload.price !== null && (!Number.isFinite(payload.price) || payload.price < 0)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سعراً صحيحاً أو اترك السعر فارغاً." },
    };
  }

  const locationWrite = await resolveListingLocationWrite(
    clientResult.data,
    payload.governorateId,
    payload.districtAr,
  );
  if (!locationWrite.ok) return locationWrite;

  const patch = {
    category_id: payload.categoryId,
    subcategory_id: payload.subcategoryId ?? null,
    governorate_id: locationWrite.data.governorateId,
    location_node_id: locationWrite.data.locationNodeId ?? null,
    title,
    description,
    price: payload.price,
    price_type: payload.priceType,
    listing_condition: payload.condition,
    district_ar: locationWrite.data.districtAr,
    contact_name: payload.contactName?.trim() || null,
    contact_options: payload.contactOptions,
    details: payload.details,
  };

  const response = await clientResult.data.rpc("rawaj_create_owner_draft_v2", {
    p_creation_request_id: cleanRequestId,
    p_patch: patch,
  });

  if (response.error) {
    if (isMissingOwnerDraftCreateV2(response.error)) {
      return createOwnerDraftListingLegacy(userId, payload);
    }
    if (isCompletedOwnerDraftCreation(response.error)) {
      return {
        ok: false,
        error: {
          code: "status_mismatch",
          message: "اكتملت جلسة إنشاء هذا الإعلان مسبقاً. افتح صفحة إضافة إعلان جديدة.",
          operation: "owner_listing_create",
        },
      };
    }
    return { ok: false, error: mapError(response.error, "owner_listing_create") };
  }

  const row = ((response.data ?? []) as Record<string, unknown>[])[0];
  if (row) return { ok: true, data: mapListing(row) };

  return {
    ok: false,
    error: {
      code: "unknown",
      message: "تم حفظ طلب المسودة دون نتيجة إعلان قابلة للتحقق.",
      operation: "owner_listing_create",
    },
  };
}

function isMissingOwnerDraftCreateV2(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const message = error.message ?? "";
  const details = error.details ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("rawaj_create_owner_draft_v2") ||
    details.includes("rawaj_create_owner_draft_v2")
  );
}

function isCompletedOwnerDraftCreation(error: { message?: string; details?: string }): boolean {
  return `${error.message ?? ""} ${error.details ?? ""}`.includes("creation_request_completed");
}
