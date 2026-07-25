import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type { ListingExpiryOption } from "@/lib/api/listing-expiry";
import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
} from "@/lib/classifieds-types";

export type OwnerCloseListingStatus = "sold" | "rented" | "unavailable";
const ownerLifecycleRequests = new Map<string, Promise<ClassifiedsResult<ClassifiedListing>>>();

function runOnce(key: string, operation: () => Promise<ClassifiedsResult<ClassifiedListing>>) {
  const pending = ownerLifecycleRequests.get(key);
  if (pending) return pending;
  const request = operation().finally(() => ownerLifecycleRequests.delete(key));
  ownerLifecycleRequests.set(key, request);
  return request;
}

async function perform(
  userId: string | null,
  listingId: string,
  action: string,
  body: Record<string, unknown> = {},
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) return failure("auth_required", "يجب تسجيل الدخول لتحديث الإعلان.");
  const cleanId = listingId.trim();
  if (!cleanId) return failure("validation_error", "تعذر تحديد الإعلان المطلوب.");
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanId)}/lifecycle`,
    { method: "PATCH", body: { action, ...body } },
  );
  if (!result.ok) return failure(result.code as ClassifiedsErrorCode, result.error);
  return fetchOwnerListingDetail(userId, cleanId);
}

export function closeOwnerListing(
  userId: string | null,
  listingId: string,
  targetStatus: OwnerCloseListingStatus,
) {
  const id = listingId.trim();
  return runOnce(`${userId ?? "anonymous"}:${id}:close:${targetStatus}`, () =>
    perform(userId, id, targetStatus),
  );
}

export function reactivateOwnerListing(userId: string | null, listingId: string) {
  const id = listingId.trim();
  return runOnce(`${userId ?? "anonymous"}:${id}:reactivate`, () =>
    perform(userId, id, "reactivate"),
  );
}

export function setOwnerListingExpiry(
  userId: string | null,
  listingId: string,
  option: ListingExpiryOption,
) {
  const id = listingId.trim();
  return runOnce(`${userId ?? "anonymous"}:${id}:expiry:${option}`, () =>
    perform(userId, id, "set_expiry", { expiryDays: option === "never" ? null : option }),
  );
}

export function confirmOwnerListingAvailability(userId: string | null, listingId: string) {
  const id = listingId.trim();
  return runOnce(`${userId ?? "anonymous"}:${id}:availability`, () =>
    perform(userId, id, "confirm_availability"),
  );
}

function failure<T>(code: ClassifiedsErrorCode, message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code, message } };
}
