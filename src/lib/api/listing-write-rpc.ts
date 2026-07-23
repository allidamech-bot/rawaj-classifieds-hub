import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  UpdateListingPayload,
} from "@/lib/classifieds-types";
import { fetchOwnerListingDetail, mapListing } from "@/lib/api/listings";
import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";
import {
  buildOwnerUpdateRpcArgs,
  buildOwnerUpdateRpcArgsV3,
} from "@/lib/api/listing-write-contract";
import { getClient, mapError, rowString } from "@/lib/api/shared";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const ownerUpdateRequests = new Map<string, Promise<ClassifiedsResult<ClassifiedListing>>>();
const ownerSubmitRequests = new Map<string, Promise<ClassifiedsResult<ClassifiedListing>>>();

export function updateOwnerListing(
  userId: string | null,
  listingId: string,
  payload: UpdateListingPayload,
  expectedUpdatedAt: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const cleanListingId = listingId.trim();
  const cleanExpectedUpdatedAt = expectedUpdatedAt.trim();
  const requestKey = `${userId ?? "anonymous"}:${cleanListingId}:${cleanExpectedUpdatedAt}:${stablePayloadKey(
    payload,
  )}`;
  const pending = ownerUpdateRequests.get(requestKey);
  if (pending) return pending;

  const request = runOwnerListingUpdate(
    userId,
    cleanListingId,
    payload,
    cleanExpectedUpdatedAt,
  ).finally(() => {
    ownerUpdateRequests.delete(requestKey);
  });
  ownerUpdateRequests.set(requestKey, request);
  return request;
}

async function runOwnerListingUpdate(
  userId: string | null,
  cleanListingId: string,
  payload: UpdateListingPayload,
  expectedUpdatedAt: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لتعديل الإعلان.",
      },
    };
  }

  if (!cleanListingId) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد الإعلان المطلوب.",
      },
    };
  }

  if (!expectedUpdatedAt) {
    return staleOwnerUpdateResult();
  }
  if (isCloudflarePublicDataProvider()) {
    const current = await cloudflareApiRequest<{
      listing: Record<string, unknown>;
    }>(`/api/listings/${encodeURIComponent(cleanListingId)}`);
    if (!current.ok) {
      return {
        ok: false,
        error: { code: current.code as ClassifiedsErrorCode, message: current.error },
      };
    }
    const listing = mapListing(current.data.listing);
    const body = {
      categoryId: payload.categoryId ?? listing.categoryId,
      subcategoryId: payload.subcategoryId ?? listing.subcategoryId,
      governorateId: payload.governorateId ?? listing.governorateId,
      title: payload.title ?? listing.title,
      description: payload.description ?? listing.description,
      price: payload.price === undefined ? listing.price : payload.price,
      priceType: payload.priceType ?? listing.priceType,
      condition: payload.condition ?? listing.condition,
      districtAr: payload.districtAr === undefined ? listing.districtAr : payload.districtAr,
      contactName: payload.contactName === undefined ? listing.contactName : payload.contactName,
      contactOptions: payload.contactOptions ?? listing.contactOptions,
      details: payload.details ?? listing.details,
      submit: false,
    };
    const updated = await cloudflareApiRequest<{ id: string; status: string }>(
      `/v1/listings/${encodeURIComponent(cleanListingId)}`,
      { method: "PATCH", body },
    );
    if (!updated.ok) {
      return {
        ok: false,
        error: { code: updated.code as ClassifiedsErrorCode, message: updated.error },
      };
    }
    const refreshed = await cloudflareApiRequest<{
      listing: Record<string, unknown>;
    }>(`/api/listings/${encodeURIComponent(cleanListingId)}`);
    return refreshed.ok
      ? { ok: true, data: mapListing(refreshed.data.listing) }
      : {
          ok: false,
          error: { code: refreshed.code as ClassifiedsErrorCode, message: refreshed.error },
        };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();

  if (existingError)
    return {
      ok: false,
      error: mapError(existingError, "owner_listing_update"),
    };
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن تعديل هذا الإعلان حالياً.",
      },
    };
  }

  const patch: Record<string, unknown> = {};
  if (payload.categoryId) patch.category_id = payload.categoryId;
  if (payload.subcategoryId !== undefined) {
    patch.subcategory_id = payload.subcategoryId;
  }
  if (payload.governorateId) patch.governorate_id = payload.governorateId;
  if (payload.title?.trim()) patch.title = payload.title.trim();
  if (payload.description !== undefined) {
    patch.description = payload.description?.trim() ?? null;
  }
  if (payload.price !== undefined) patch.price = payload.price;
  if (payload.priceType) patch.price_type = payload.priceType;
  if (payload.condition) patch.listing_condition = payload.condition;

  if (payload.districtAr !== undefined) {
    const locationWrite = await resolveListingLocationWrite(
      clientResult.data,
      payload.governorateId ?? rowString(existing as Record<string, unknown>, "governorate_id"),
      payload.districtAr,
    );
    if (!locationWrite.ok) return locationWrite;

    patch.governorate_id = locationWrite.data.governorateId;
    patch.district_ar = locationWrite.data.districtAr;
    if (locationWrite.data.locationNodeId !== undefined) {
      patch.location_node_id = locationWrite.data.locationNodeId;
    }
  }

  if (payload.contactName !== undefined) {
    patch.contact_name = payload.contactName;
  }
  if (payload.contactOptions) patch.contact_options = payload.contactOptions;
  if (payload.details !== undefined) patch.details = payload.details;

  const rpcArgsV3 = buildOwnerUpdateRpcArgsV3(cleanListingId, patch, expectedUpdatedAt);
  let response = await clientResult.data.rpc("rawaj_owner_update_listing_v3", rpcArgsV3);

  if (response.error && isMissingOwnerUpdateV3(response.error)) {
    response = await clientResult.data.rpc(
      "rawaj_owner_update_listing_v2",
      buildOwnerUpdateRpcArgs(cleanListingId, patch),
    );
  }

  const { data, error } = response;
  if (error) {
    if (isStaleOwnerUpdateError(error)) return staleOwnerUpdateResult();
    return { ok: false, error: mapError(error, "owner_listing_update") };
  }

  const refreshed = await fetchOwnerListingDetail(userId, cleanListingId);
  if (refreshed.ok) return refreshed;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row) {
    return { ok: true, data: mapListing(row) };
  }

  return {
    ok: false,
    error: {
      code: "unknown",
      message: "تم التعديل دون نتيجة قابلة للتحقق.",
      operation: "owner_listing_update",
    },
  };
}

export function submitOwnerListingForReview(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const cleanListingId = listingId.trim();
  const requestKey = `${userId ?? "anonymous"}:${cleanListingId}`;
  const pending = ownerSubmitRequests.get(requestKey);
  if (pending) return pending;

  const request = runOwnerListingSubmit(userId, cleanListingId).finally(() => {
    ownerSubmitRequests.delete(requestKey);
  });
  ownerSubmitRequests.set(requestKey, request);
  return request;
}

async function runOwnerListingSubmit(
  userId: string | null,
  cleanListingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لإرسال الإعلان للمراجعة.",
      },
    };
  }

  if (!cleanListingId) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد الإعلان المطلوب.",
      },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const current = await cloudflareApiRequest<{
      listing: Record<string, unknown>;
    }>(`/api/listings/${encodeURIComponent(cleanListingId)}`);
    if (!current.ok) {
      return {
        ok: false,
        error: { code: current.code as ClassifiedsErrorCode, message: current.error },
      };
    }
    const listing = mapListing(current.data.listing);
    const submitted = await cloudflareApiRequest<{ id: string; status: string }>(
      `/v1/listings/${encodeURIComponent(cleanListingId)}`,
      {
        method: "PATCH",
        body: {
          categoryId: listing.categoryId,
          subcategoryId: listing.subcategoryId,
          governorateId: listing.governorateId,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          priceType: listing.priceType,
          condition: listing.condition,
          districtAr: listing.districtAr,
          contactName: listing.contactName,
          contactOptions: listing.contactOptions,
          details: listing.details,
          submit: true,
        },
      },
    );
    if (!submitted.ok) {
      return {
        ok: false,
        error: { code: submitted.code as ClassifiedsErrorCode, message: submitted.error },
      };
    }
    return { ok: true, data: { ...listing, status: "pending_review" } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_submit_listing_for_review", {
    p_listing_id: cleanListingId,
  });

  if (error) {
    return { ok: false, error: mapError(error, "owner_listing_submit") };
  }

  const refreshed = await fetchOwnerListingDetail(userId, cleanListingId);
  if (refreshed.ok) {
    if (refreshed.data.status === "pending_review") return refreshed;
    return submitStatusMismatch(refreshed.data.status);
  }

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row) {
    const listing = mapListing(row);
    if (listing.status === "pending_review") return { ok: true, data: listing };
    return submitStatusMismatch(listing.status);
  }

  return {
    ok: false,
    error: {
      code: "unknown",
      message: "تم إرسال الطلب دون نتيجة إعلان قابلة للتحقق.",
      operation: "owner_listing_submit",
    },
  };
}

function isMissingOwnerUpdateV3(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const message = error.message ?? "";
  const details = error.details ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("rawaj_owner_update_listing_v3") ||
    details.includes("rawaj_owner_update_listing_v3")
  );
}

function isStaleOwnerUpdateError(error: { message?: string; details?: string }): boolean {
  return `${error.message ?? ""} ${error.details ?? ""}`.includes("stale_owner_update");
}

function staleOwnerUpdateResult(): ClassifiedsResult<never> {
  return {
    ok: false,
    error: {
      code: "status_mismatch",
      message:
        "تم تعديل الإعلان من مكان آخر بعد فتح هذه الصفحة. أعد تحميل أحدث نسخة قبل حفظ تعديلاتك.",
      operation: "owner_listing_update",
    },
  };
}

function stablePayloadKey(payload: UpdateListingPayload): string {
  return JSON.stringify(
    Object.entries(payload)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, stableValue(value)]),
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function submitStatusMismatch(status: ClassifiedListing["status"]): ClassifiedsResult<never> {
  return {
    ok: false,
    error: {
      code: "status_mismatch",
      message:
        "لم يؤكد الخادم انتقال الإعلان إلى قائمة المراجعة. بقي الإعلان محفوظاً دون تأكيد الإرسال.",
      details: `Expected pending_review after submit RPC, received ${status}.`,
      operation: "owner_listing_submit",
    },
  };
}
