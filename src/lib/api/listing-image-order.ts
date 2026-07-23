import { fetchListingImages } from "@/lib/api/listings";
import { getClient, mapError, rowNumber, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

export interface ListingImageOrderUpdate {
  id: string;
  sortOrder: number;
}

export async function reorderListingImages(
  userId: string | null,
  listingId: string,
  order: ListingImageOrderUpdate[],
): Promise<ClassifiedsResult<ListingImage[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لترتيب صور الإعلان." },
    };
  }

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const normalized = order.map((item) => ({ id: item.id.trim(), sortOrder: item.sortOrder }));
  const uniqueIds = new Set(normalized.map((item) => item.id));
  if (
    normalized.some(
      (item) => !item.id || !Number.isInteger(item.sortOrder) || item.sortOrder < 0,
    ) ||
    uniqueIds.size !== normalized.length
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "ترتيب الصور غير صالح." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<Record<string, unknown>[]>(
      `/v1/listings/${encodeURIComponent(cleanListingId)}/images`,
      {
        method: "PATCH",
        body: {
          imageIds: [...normalized]
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((item) => item.id),
        },
      },
    );
    if (!result.ok) {
      return {
        ok: false,
        error: { code: "unknown", message: result.error },
      };
    }
    return fetchListingImages(cleanListingId);
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;

  const { data: listing, error: listingError } = await client
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", cleanListingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();
  if (listingError) return { ok: false, error: mapError(listingError, "listing_image_reorder") };
  if (!listing) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن ترتيب صور هذا الإعلان حالياً." },
    };
  }

  const { data: currentRows, error: readError } = await client
    .from("listing_images")
    .select("id, sort_order")
    .eq("listing_id", cleanListingId)
    .order("sort_order");
  if (readError) return { ok: false, error: mapError(readError, "listing_image_reorder") };

  const current = ((currentRows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: rowString(row, "id"),
    sortOrder: rowNumber(row, "sort_order"),
  }));
  const currentIds = new Set(current.map((item) => item.id));
  if (current.length !== normalized.length || normalized.some((item) => !currentIds.has(item.id))) {
    return {
      ok: false,
      error: {
        code: "status_mismatch",
        message: "تغيّرت صور الإعلان. أعد تحميل الصفحة ثم حاول ترتيبها من جديد.",
        operation: "listing_image_reorder",
      },
    };
  }

  const originalOrder = new Map(current.map((item) => [item.id, item.sortOrder] as const));
  const updatedIds: string[] = [];

  for (const item of normalized) {
    const { data: updated, error: updateError } = await client
      .from("listing_images")
      .update({ sort_order: item.sortOrder })
      .eq("id", item.id)
      .eq("listing_id", cleanListingId)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      for (const updatedId of updatedIds) {
        const previousSortOrder = originalOrder.get(updatedId);
        if (previousSortOrder === undefined) continue;
        await client
          .from("listing_images")
          .update({ sort_order: previousSortOrder })
          .eq("id", updatedId)
          .eq("listing_id", cleanListingId);
      }

      return {
        ok: false,
        error: updateError
          ? mapError(updateError, "listing_image_reorder")
          : {
              code: "permission_denied",
              message: "لم يتم حفظ ترتيب الصور. أعد المحاولة.",
              operation: "listing_image_reorder",
            },
      };
    }
    updatedIds.push(item.id);
  }

  return fetchListingImages(cleanListingId);
}
