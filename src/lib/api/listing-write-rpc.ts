import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  UpdateListingPayload,
} from "@/lib/classifieds-types";
import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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
  ).finally(() => ownerUpdateRequests.delete(requestKey));
  ownerUpdateRequests.set(requestKey, request);
  return request;
}

async function runOwnerListingUpdate(
  userId: string | null,
  listingId: string,
  payload: UpdateListingPayload,
  expectedUpdatedAt: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لتعديل الإعلان.");
  if (!listingId) return validationFailure("تعذر تحديد الإعلان المطلوب.");
  if (!expectedUpdatedAt) return staleOwnerUpdateResult();

  const current = await fetchOwnerListingDetail(userId, listingId);
  if (!current.ok) return current;
  if (current.data.updatedAt !== expectedUpdatedAt) return staleOwnerUpdateResult();

  const body = mergedListingPayload(current.data, payload, false, expectedUpdatedAt);
  const result = await cloudflareApiRequest<{ id: string; status: string; updatedAt: string }>(
    `/v1/listings/${encodeURIComponent(listingId)}`,
    { method: "PATCH", body },
  );
  if (!result.ok) return writeFailure(result);

  return fetchOwnerListingDetail(userId, listingId);
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
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لإرسال الإعلان للمراجعة.");
  if (!listingId) return validationFailure("تعذر تحديد الإعلان المطلوب.");

  const current = await fetchOwnerListingDetail(userId, listingId);
  if (!current.ok) return current;
  if (current.data.status !== "draft" && current.data.status !== "rejected") {
    return {
      ok: false,
      error: {
        code: "status_mismatch",
        message: "لا يمكن إرسال الإعلان للمراجعة من حالته الحالية.",
        operation: "owner_listing_submit",
      },
    };
  }

  const result = await cloudflareApiRequest<{ id: string; status: string; updatedAt: string }>(
    `/v1/listings/${encodeURIComponent(listingId)}`,
    {
      method: "PATCH",
      body: mergedListingPayload(current.data, {}, true, current.data.updatedAt),
    },
  );
  if (!result.ok) return writeFailure(result);

  const refreshed = await fetchOwnerListingDetail(userId, listingId);
  if (!refreshed.ok) return refreshed;
  return refreshed.data.status === "pending_review"
    ? refreshed
    : submitStatusMismatch(refreshed.data.status);
}

function mergedListingPayload(
  current: ClassifiedListing,
  patch: UpdateListingPayload,
  submit: boolean,
  expectedUpdatedAt: string,
): Record<string, unknown> {
  const districtAr = patch.districtAr === undefined ? current.districtAr : patch.districtAr;
  const canonicalLocationId = districtAr?.trim().startsWith("@")
    ? districtAr.trim().slice(1)
    : null;
  return {
    categoryId: patch.categoryId?.trim() || current.categoryId,
    subcategoryId:
      patch.subcategoryId === undefined
        ? current.subcategoryId
        : patch.subcategoryId?.trim() || null,
    governorateId: patch.governorateId?.trim() || current.governorateId,
    locationNodeId: canonicalLocationId,
    title: patch.title === undefined ? current.title : patch.title.trim(),
    description:
      patch.description === undefined ? current.description : patch.description?.trim() || "",
    price: patch.price === undefined ? current.price : patch.price,
    priceType: patch.priceType ?? current.priceType,
    condition: patch.condition ?? current.condition,
    districtAr: canonicalLocationId ? null : districtAr?.trim() || null,
    contactName:
      patch.contactName === undefined ? current.contactName : patch.contactName?.trim() || null,
    contactOptions: patch.contactOptions ?? current.contactOptions,
    details: patch.details ?? current.details,
    expectedUpdatedAt,
    submit,
  };
}

function writeFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  if (result.code === "stale_write") return staleOwnerUpdateResult();
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}

function authFailure<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "auth_required", message } };
}

function validationFailure<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
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

function submitStatusMismatch(status: string): ClassifiedsResult<never> {
  return {
    ok: false,
    error: {
      code: "status_mismatch",
      message: "لم يؤكد الخادم انتقال الإعلان إلى قائمة المراجعة.",
      details: `Expected pending_review after submit, received ${status}.`,
      operation: "owner_listing_submit",
    },
  };
}

function stablePayloadKey(payload: UpdateListingPayload): string {
  return JSON.stringify(stableValue(payload));
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
