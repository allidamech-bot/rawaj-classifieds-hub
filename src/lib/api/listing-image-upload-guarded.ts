import type {
  ClassifiedsResult,
  ListingImage,
  ListingImageUploadPayload,
} from "@/lib/classifieds-types";
import { fetchListingImages, mapImage } from "@/lib/api/listings";
import { getClient, mapError, mapStorageError } from "@/lib/api/shared";
import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";
import { uploadListingImageObjectWithRetry } from "@/lib/api/listing-image-upload-retry";
import {
  prepareListingImageForUpload,
  validateListingImageContent,
} from "@/lib/listing-image-processing";

export async function uploadListingImage({
  userId,
  listing,
  file,
  sortOrder,
  altAr,
}: ListingImageUploadPayload): Promise<ClassifiedsResult<ListingImage>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لرفع صور الإعلان." },
    };
  }

  if (listing.ownerId !== userId) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكنك رفع صور لإعلان لا تملكه." },
    };
  }

  if (!["draft", "rejected"].includes(listing.status)) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل صور إعلان بعد اعتماده." },
    };
  }

  const validation = validateImageFile(file);
  if (!validation.ok) {
    return { ok: false, error: { code: "validation_error", message: validation.error! } };
  }

  const contentValidation = await validateListingImageContent(file);
  if (!contentValidation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: contentValidation.error! },
    };
  }

  const preparedFile = await prepareListingImageForUpload(file);
  const preparedValidation = validateImageFile(preparedFile);
  if (!preparedValidation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: preparedValidation.error! },
    };
  }

  const preparedContentValidation = await validateListingImageContent(preparedFile);
  if (!preparedContentValidation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: preparedContentValidation.error! },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: existingListing, error: existingListingError } = await clientResult.data
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", listing.id)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();

  if (existingListingError) return { ok: false, error: mapError(existingListingError) };
  if (!existingListing) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل صور هذا الإعلان." },
    };
  }

  const storagePath = buildListingImagePath(userId, listing.id, preparedFile.name);

  let uploadResult;
  try {
    uploadResult = await uploadListingImageObjectWithRetry(() =>
      clientResult.data.storage.from(listingImagesBucket).upload(storagePath, preparedFile, {
        cacheControl: "31536000",
        contentType: preparedFile.type,
        upsert: false,
      }),
    );
  } catch (error: unknown) {
    return {
      ok: false,
      error: mapStorageError({
        message: error instanceof Error ? error.message : "تعذر رفع الصورة بعد عدة محاولات.",
      }),
    };
  }

  if (uploadResult.error) {
    return { ok: false, error: mapStorageError(uploadResult.error) };
  }

  const { data, error } = await clientResult.data
    .from("listing_images")
    .insert({
      listing_id: listing.id,
      storage_path: storagePath,
      alt_ar: altAr ?? listing.title,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) {
    await clientResult.data.storage.from(listingImagesBucket).remove([storagePath]);
    return { ok: false, error: mapError(error) };
  }

  const mappedImage = mapImage(data as Record<string, unknown>);
  const refreshed = await fetchListingImages(listing.id);
  if (refreshed.ok) {
    return {
      ok: true,
      data: refreshed.data.find((image) => image.id === mappedImage.id) ?? mappedImage,
    };
  }

  return { ok: true, data: mappedImage };
}
