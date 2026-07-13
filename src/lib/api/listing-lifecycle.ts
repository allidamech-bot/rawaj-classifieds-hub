import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { getClient, mapError } from "@/lib/api/shared";
import type { ListingExpiryOption } from "@/lib/api/listing-expiry";
import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";

export type OwnerCloseListingStatus = "sold" | "rented" | "unavailable";

const ownerLifecycleRequests = new Map<
  string,
  Promise<ClassifiedsResult<ClassifiedListing>>
>();

function runOnce(
  key: string,
  operation: () => Promise<ClassifiedsResult<ClassifiedListing>>,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const pending = ownerLifecycleRequests.get(key);
  if (pending) return pending;

  const request = operation().finally(() => {
    ownerLifecycleRequests.delete(key);
  });
  ownerLifecycleRequests.set(key, request);
  return request;
}

function runOwnerTransition(
  userId: string | null,
  listingId: string,
  action: OwnerCloseListingStatus | "reactivate",
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const cleanListingId = listingId.trim();
  return runOnce(`${userId ?? "anonymous"}:${cleanListingId}:transition:${action}`, async () => {
    if (!userId) {
      return {
        ok: false,
        error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث حالة الإعلان." },
      };
    }

    if (!cleanListingId) {
      return {
        ok: false,
        error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
      };
    }

    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;

    const { error } = await clientResult.data.rpc("rawaj_owner_transition_listing", {
      p_listing_id: cleanListingId,
      p_action: action,
    });
    if (error) return { ok: false, error: mapError(error) };

    return fetchOwnerListingDetail(userId, cleanListingId);
  });
}

export function closeOwnerListing(
  userId: string | null,
  listingId: string,
  targetStatus: OwnerCloseListingStatus,
) {
  return runOwnerTransition(userId, listingId, targetStatus);
}

export function reactivateOwnerListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return runOwnerTransition(userId, listingId, "reactivate");
}

export function setOwnerListingExpiry(
  userId: string | null,
  listingId: string,
  option: ListingExpiryOption,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const cleanListingId = listingId.trim();
  return runOnce(`${userId ?? "anonymous"}:${cleanListingId}:expiry:${option}`, async () => {
    if (!userId) {
      return {
        ok: false,
        error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث مدة الإعلان." },
      };
    }

    if (!cleanListingId) {
      return {
        ok: false,
        error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
      };
    }

    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;

    const { error } = await clientResult.data.rpc("rawaj_owner_set_listing_expiry", {
      p_listing_id: cleanListingId,
      p_expiry_days: option === "never" ? null : option,
    });
    if (error) return { ok: false, error: mapError(error) };

    return fetchOwnerListingDetail(userId, cleanListingId);
  });
}

export function confirmOwnerListingAvailability(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const cleanListingId = listingId.trim();
  return runOnce(`${userId ?? "anonymous"}:${cleanListingId}:availability`, async () => {
    if (!userId) {
      return {
        ok: false,
        error: { code: "auth_required", message: "يجب تسجيل الدخول لتأكيد توفر الإعلان." },
      };
    }

    if (!cleanListingId) {
      return {
        ok: false,
        error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
      };
    }

    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;

    const { error } = await clientResult.data.rpc("rawaj_owner_confirm_listing_availability", {
      p_listing_id: cleanListingId,
    });
    if (error) return { ok: false, error: mapError(error) };

    return fetchOwnerListingDetail(userId, cleanListingId);
  });
}
