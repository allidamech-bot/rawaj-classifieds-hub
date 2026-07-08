import type {
  ClassifiedListing,
  ClassifiedsResult,
  UpdateListingPayload,
} from "@/lib/classifieds-types";
import { fetchOwnerListingDetail, mapListing } from "@/lib/api/listings";
import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";
import { getClient, mapError, rowString } from "@/lib/api/shared";

export async function updateOwnerListing(
  userId: string | null,
  listingId: string,
  payload: UpdateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتعديل الإعلان." },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
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

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل هذا الإعلان حالياً." },
    };
  }

  const patch: Record<string, unknown> = {};
  if (payload.categoryId) patch.category_id = payload.categoryId;
  if (payload.subcategoryId !== undefined) patch.subcategory_id = payload.subcategoryId;
  if (payload.governorateId) patch.governorate_id = payload.governorateId;
  if (payload.title?.trim()) patch.title = payload.title.trim();
  if (payload.description !== undefined) patch.description = payload.description?.trim() ?? null;
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

  if (payload.contactName !== undefined) patch.contact_name = payload.contactName;
  if (payload.contactOptions) patch.contact_options = payload.contactOptions;
  if (payload.details !== undefined) patch.details = payload.details;

  const { data, error } = await clientResult.data.rpc("rawaj_owner_update_listing", {
    p_listing_id: cleanListingId,
    p_patch: patch,
  });

  if (error) return { ok: false, error: mapError(error) };

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تم التعديل دون نتيجة قابلة للتحقق." },
    };
  }

  const refreshed = await fetchOwnerListingDetail(userId, cleanListingId);
  return refreshed.ok ? refreshed : { ok: true, data: mapListing(row) };
}

export async function submitOwnerListingForReview(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال الإعلان للمراجعة." },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_submit_listing_for_review", {
    p_listing_id: cleanListingId,
  });

  if (error) return { ok: false, error: mapError(error) };

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تم إرسال الطلب دون نتيجة إعلان قابلة للتحقق." },
    };
  }

  const refreshed = await fetchOwnerListingDetail(userId, cleanListingId);
  return refreshed.ok ? refreshed : { ok: true, data: mapListing(row) };
}
