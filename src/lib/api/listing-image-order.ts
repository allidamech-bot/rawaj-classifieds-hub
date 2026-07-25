import { fetchListingImages, mapImage } from "@/lib/api/listings";
import type { ClassifiedsErrorCode, ClassifiedsResult, ListingImage } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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
  const normalized = order
    .map((item) => ({ id: item.id.trim(), sortOrder: item.sortOrder }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  if (
    !cleanListingId ||
    normalized.some(
      (item, index) =>
        !item.id || !Number.isInteger(item.sortOrder) || item.sortOrder !== index,
    ) ||
    new Set(normalized.map((item) => item.id)).size !== normalized.length
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "ترتيب الصور غير صالح." },
    };
  }

  const result = await cloudflareApiRequest<Record<string, unknown>[]>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/images`,
    { method: "PATCH", body: { imageIds: normalized.map((item) => item.id) } },
  );
  if (!result.ok) {
    return {
      ok: false,
      error: { code: result.code as ClassifiedsErrorCode, message: result.error },
    };
  }

  const images = result.data.map(mapImage);
  return images.length === normalized.length
    ? { ok: true, data: images }
    : fetchListingImages(cleanListingId);
}
