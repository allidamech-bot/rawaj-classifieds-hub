import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsResult,
  ClassifiedSubcategory,
  CreateListingPayload,
  ListingCursor,
  ListingImage,
  ListingImageUploadPayload,
  PaginatedListingsResponse,
  UpdateListingPayload,
} from "@/lib/classifieds-types";
import type { PlaceholderType, PriceType } from "@/types";
import {
  decodeListingCursor,
  encodeListingCursor,
  escapePostgrestFilterValue,
  escapePostgrestSearchTerm,
  getClient,
  mapError,
  mapStorageError,
  normalizePlaceholder,
  rowArray,
  rowBoolean,
  rowNullableNumber,
  rowNullableString,
  rowNumber,
  rowRecord,
  rowString,
} from "@/lib/api/shared";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  mapCategory,
  mapGovernorate,
  readReferences,
} from "@/lib/api/references";

import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";
import { isListingPastExpiry, publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";

const signedImageUrlExpiresInSeconds = 900;

export function mapListing(
  row: Record<string, unknown>,
  categories: ClassifiedCategory[] = [],
  governorates: ClassifiedGovernorate[] = [],
): ClassifiedListing {
  const categoryId = rowString(row, "category_id");
  const governorateId = rowString(row, "governorate_id");
  const category = categories.find((item) => item.id === categoryId);
  const governorate = governorates.find((item) => item.id === governorateId);
  const rawStatus = rowString(row, "status", "pending_review") as ClassifiedListing["status"];
  const expiresAt = rowNullableString(row, "expires_at");
  const status = rawStatus === "approved" && isListingPastExpiry(expiresAt) ? "expired" : rawStatus;

  return {
    id: rowString(row, "id"),
    ownerId: rowString(row, "owner_id"),
    categoryId,
    subcategoryId: rowNullableString(row, "subcategory_id"),
    categoryNameAr: category?.nameAr,
    categoryPlaceholder: category?.placeholder,
    governorateId,
    governorateNameAr: governorate?.nameAr,
    title: rowString(row, "title"),
    description: rowString(row, "description"),
    price: rowNullableNumber(row, "price"),
    currency: "SYP",
    priceType: rowString(row, "price_type", "fixed") as PriceType,
    condition: rowString(
      row,
      "listing_condition",
      "not_applicable",
    ) as ClassifiedListing["condition"],
    status,
    districtAr: rowNullableString(row, "district_ar"),
    contactName: rowNullableString(row, "contact_name"),
    contactOptions: rowRecord(row, "contact_options") as Record<string, boolean>,
    details: rowRecord(row, "details"),
    isFeatured: rowBoolean(row, "is_featured"),
    featuredUntil: rowNullableString(row, "featured_until"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    rejectionReason: rowNullableString(row, "rejection_reason"),
    publishedAt: rowNullableString(row, "published_at"),
    archivedAt: rowNullableString(row, "archived_at"),
    statusChangedAt: rowNullableString(row, "status_changed_at"),
    expiresAt,
    renewedAt: rowNullableString(row, "renewed_at"),
    expiryDays: rowNullableNumber(row, "expiry_days") as 30 | 60 | 90 | null,
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

export function mapImage(row: Record<string, unknown>): ListingImage {
  const storagePath = rowNullableString(row, "storage_path");

  return {
    id: rowString(row, "id"),
    listingId: rowString(row, "listing_id"),
    storagePath,
    publicUrl: null,
    signedUrlExpiresIn: null,
    altAr: rowNullableString(row, "alt_ar"),
    sortOrder: rowNumber(row, "sort_order"),
    createdAt: rowString(row, "created_at"),
  };
}

export async function fetchPublicListings(
  filters: { categoryId?: string; sort?: string } & Record<string, unknown> = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  let query = clientResult.data
    .from("listings")
    .select("*")
    .eq("status", "approved")
    .or(publicListingExpiryFilter());

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  const sort = filters.sort ?? "latest";
  if (sort === "cheapest") {
    query = query
      .order("price", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
  } else if (sort === "expensive") {
    query = query
      .order("price", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
  } else if (sort === "featured") {
    query = query
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  if (cursor) {
    if (cursor.type === "latest") {
      const created_at = escapePostgrestFilterValue(cursor.created_at);
      const id = escapePostgrestFilterValue(cursor.id);
      query = query.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`);
    } else if (cursor.type === "featured") {
      const created_at = escapePostgrestFilterValue(cursor.created_at);
      const id = escapePostgrestFilterValue(cursor.id);
      if (cursor.is_featured) {
        query = query.or(
          `is_featured.eq.false,and(is_featured.eq.true,created_at.lt.${created_at}),and(is_featured.eq.true,created_at.eq.${created_at},id.lt.${id})`,
        );
      } else {
        query = query.or(
          `and(is_featured.eq.false,created_at.lt.${created_at}),and(is_featured.eq.false,created_at.eq.${created_at},id.lt.${id})`,
        );
      }
    } else if (cursor.type === "cheapest" || cursor.type === "expensive") {
      const id = escapePostgrestFilterValue(cursor.id);
      if (cursor.price === null) {
        query = query.or(`and(price.is.null,id.gt.${id})`);
      } else {
        const price = escapePostgrestFilterValue(String(cursor.price));
        const operator = cursor.type === "cheapest" ? "gt" : "lt";
        query = query.or(
          `price.${operator}.${price},price.is.null,and(price.eq.${price},id.gt.${id})`,
        );
      }
    } else {
      return { ok: false, error: { code: "validation_error", message: "Invalid cursor type." } };
    }
  }

  const safePageSize = Math.max(1, Math.min(pageSize, 50));
  const { data, error } = await query.limit(safePageSize + 1);
  if (error) return { ok: false, error: mapError(error) };

  const listings = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );

  const nextCursor: ListingCursor | null =
    listings.length > safePageSize
      ? ({
          type:
            sort === "cheapest"
              ? "cheapest"
              : sort === "expensive"
                ? "expensive"
                : sort === "featured"
                  ? "featured"
                  : "latest",
          id: listings[safePageSize - 1].id,
          ...(sort === "cheapest" || sort === "expensive"
            ? { price: listings[safePageSize - 1].price }
            : {}),
          ...(sort === "featured"
            ? {
                is_featured: listings[safePageSize - 1].isFeatured,
                created_at: listings[safePageSize - 1].createdAt,
              }
            : {}),
          ...(sort === "latest" ? { created_at: listings[safePageSize - 1].createdAt } : {}),
        } as ListingCursor)
      : null;
  const pagedItems = nextCursor ? listings.slice(0, safePageSize) : listings;

  return {
    ok: true,
    data: {
      items: await hydrateListingsWithPrimaryImages(clientResult.data, pagedItems),
      nextCursor,
      pageSize: safePageSize,
    },
  };
}

export async function fetchListingDetail(
  id: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const listingId = id.trim();
  if (!listingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("status", "approved")
    .or(publicListingExpiryFilter())
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان غير متاح أو لم تتم الموافقة عليه بعد." },
    };
  }

  const listing = mapListing(
    data as Record<string, unknown>,
    references.categories,
    references.governorates,
  );
  const [hydratedListing] = await hydrateListingsWithPrimaryImages(clientResult.data, [listing]);
  return { ok: true, data: hydratedListing ?? listing };
}

export async function fetchOwnerListingDetail(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض تفاصيل الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان غير متاح." },
    };
  }

  const listing = mapListing(
    data as Record<string, unknown>,
    references.categories,
    references.governorates,
  );
  const [hydratedListing] = await hydrateListingsWithPrimaryImages(clientResult.data, [listing]);
  return { ok: true, data: hydratedListing ?? listing };
}

export async function fetchCurrentUserListings(
  userId: string | null,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض إعلاناتك." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  const listings = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );

  return { ok: true, data: await hydrateListingsWithPrimaryImages(clientResult.data, listings) };
}

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن تعديل هذا الإعلان حالياً. أعد إرساله للمراجعة إذا كان مرفوضاً.",
      },
    };
  }

  const updateData: Record<string, unknown> = {};
  if (payload.categoryId) updateData.category_id = payload.categoryId;
  if (payload.governorateId) updateData.governorate_id = payload.governorateId;
  if (payload.subcategoryId !== undefined) updateData.subcategory_id = payload.subcategoryId;
  if (payload.title?.trim()) updateData.title = payload.title.trim();
  if (payload.description !== undefined) {
    updateData.description = payload.description?.trim() ?? null;
  }
  if (payload.price !== undefined) updateData.price = payload.price;
  if (payload.priceType) updateData.price_type = payload.priceType;
  if (payload.condition) updateData.listing_condition = payload.condition;
  if (payload.districtAr !== undefined) {
    const locationWrite = await resolveListingLocationWrite(
      clientResult.data,
      payload.governorateId ?? rowString(existing as Record<string, unknown>, "governorate_id"),
      payload.districtAr,
    );
    if (!locationWrite.ok) return locationWrite;
    updateData.governorate_id = locationWrite.data.governorateId;
    updateData.district_ar = locationWrite.data.districtAr;
    if (locationWrite.data.locationNodeId !== undefined) {
      updateData.location_node_id = locationWrite.data.locationNodeId;
    }
  }
  if (payload.contactName !== undefined) updateData.contact_name = payload.contactName;
  if (payload.contactOptions) updateData.contact_options = payload.contactOptions;
  if (payload.details !== undefined) updateData.details = payload.details;

  if (existing.status === "rejected") {
    updateData.reviewed_by = null;
    updateData.reviewed_at = null;
  }

  const { data, error } = await clientResult.data
    .from("listings")
    .update(updateData)
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .select("*");

  if (error) return { ok: false, error: mapError(error) };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر تحديث الإعلان." },
    };
  }

  return {
    ok: true,
    data: mapListing(
      data[0] as Record<string, unknown>,
      references.categories,
      references.governorates,
    ),
  };
}

export async function resubmitOwnerListing(
  userId: string | null,
  listingId: string,
  payload: UpdateListingPayload = {},
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإعادة إرسال الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن إعادة إرسال هذا الإعلان حالياً.",
      },
    };
  }

  const updateData: Record<string, unknown> = {
    status: "pending_review",
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
  };

  if (payload.categoryId) updateData.category_id = payload.categoryId;
  if (payload.governorateId) updateData.governorate_id = payload.governorateId;
  if (payload.subcategoryId !== undefined) updateData.subcategory_id = payload.subcategoryId;
  if (payload.title?.trim()) updateData.title = payload.title.trim();
  if (payload.description !== undefined) {
    updateData.description = payload.description?.trim() ?? null;
  }
  if (payload.price !== undefined) updateData.price = payload.price;
  if (payload.priceType) updateData.price_type = payload.priceType;
  if (payload.condition) updateData.listing_condition = payload.condition;
  if (payload.districtAr !== undefined) {
    const locationWrite = await resolveListingLocationWrite(
      clientResult.data,
      payload.governorateId ?? rowString(existing as Record<string, unknown>, "governorate_id"),
      payload.districtAr,
    );
    if (!locationWrite.ok) return locationWrite;
    updateData.governorate_id = locationWrite.data.governorateId;
    updateData.district_ar = locationWrite.data.districtAr;
    if (locationWrite.data.locationNodeId !== undefined) {
      updateData.location_node_id = locationWrite.data.locationNodeId;
    }
  }
  if (payload.contactName !== undefined) updateData.contact_name = payload.contactName;
  if (payload.contactOptions) updateData.contact_options = payload.contactOptions;
  if (payload.details !== undefined) updateData.details = payload.details;

  const { data, error } = await clientResult.data
    .from("listings")
    .update(updateData)
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .select("*");

  if (error) return { ok: false, error: mapError(error) };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر إعادة إرسال الإعلان." },
    };
  }

  return {
    ok: true,
    data: mapListing(
      data[0] as Record<string, unknown>,
      references.categories,
      references.governorates,
    ),
  };
}

export const OWNER_DELETABLE_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
] as const;

export type OwnerDeletableStatus = (typeof OWNER_DELETABLE_STATUSES)[number];

export function isOwnerDeletableStatus(status: string): status is OwnerDeletableStatus {
  return (OWNER_DELETABLE_STATUSES as readonly string[]).includes(status);
}

export async function deleteOwnerListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحذف الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", OWNER_DELETABLE_STATUSES)
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن حذف هذا الإعلان حالياً.",
      },
    };
  }

  const { data: images, error: imagesError } = await clientResult.data
    .from("listing_images")
    .select("storage_path")
    .eq("listing_id", listingId);

  if (imagesError) return { ok: false, error: mapError(imagesError) };

  const paths = ((images ?? []) as Record<string, unknown>[])
    .map((row) => rowString(row, "storage_path"))
    .filter((path): path is string => Boolean(path));

  const { data: deletedData, error } = await clientResult.data
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", OWNER_DELETABLE_STATUSES)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };

  if (!deletedData) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لم يتم حذف الإعلان. قد تكون الصلاحية مفقودة أو تم تغييره مسبقاً.",
      },
    };
  }

  if (paths.length > 0) {
    const storageResult = await clientResult.data.storage.from(listingImagesBucket).remove(paths);

    if (storageResult.error) {
      console.error("Failed to clean up storage images after listing delete", {
        listingId,
        error: storageResult.error,
      });
    }
  }

  return { ok: true, data: null };
}

async function signListingImages(
  client: SupabaseClient,
  images: ListingImage[],
): Promise<ListingImage[]> {
  const paths = [...new Set(images.map((image) => image.storagePath).filter(Boolean))] as string[];
  if (paths.length === 0) return images;

  try {
    const { data, error } = await client.storage
      .from(listingImagesBucket)
      .createSignedUrls(paths, signedImageUrlExpiresInSeconds);

    if (error || !data) return images;

    const urlsByPath = new Map(
      data.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl] as const),
    );

    return images.map((image) => {
      const signedUrl = image.storagePath ? urlsByPath.get(image.storagePath) : null;
      return signedUrl
        ? { ...image, publicUrl: signedUrl, signedUrlExpiresIn: signedImageUrlExpiresInSeconds }
        : image;
    });
  } catch {
    return images;
  }
}

async function readListingImagesByListingIds(
  client: SupabaseClient,
  listingIds: string[],
): Promise<ListingImage[]> {
  const ids = [...new Set(listingIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from("listing_images")
    .select("*")
    .in("listing_id", ids)
    .order("sort_order");

  if (error) return [];
  return signListingImages(client, ((data ?? []) as Record<string, unknown>[]).map(mapImage));
}

export async function hydrateListingsWithPrimaryImages(
  client: SupabaseClient,
  listings: ClassifiedListing[],
): Promise<ClassifiedListing[]> {
  if (listings.length === 0) return listings;

  const images = await readListingImagesByListingIds(
    client,
    listings.map((listing) => listing.id),
  );
  if (images.length === 0) return listings;

  const firstImageByListing = new Map<string, ListingImage>();
  for (const image of images) {
    if (!firstImageByListing.has(image.listingId)) {
      firstImageByListing.set(image.listingId, image);
    }
  }

  return listings.map((listing) => ({
    ...listing,
    primaryImageUrl: firstImageByListing.get(listing.id)?.publicUrl ?? null,
  }));
}

function buildNextCursor(sort: string, listing: ClassifiedListing): ListingCursor | null {
  if (!listing?.id) return null;
  if (sort === "cheapest") {
    return { type: "cheapest", price: listing.price, id: listing.id };
  }
  if (sort === "expensive") {
    return { type: "expensive", price: listing.price, id: listing.id };
  }
  if (sort === "featured") {
    return {
      type: "featured",
      is_featured: listing.isFeatured,
      created_at: listing.createdAt,
      id: listing.id,
    };
  }
  return { type: "latest", created_at: listing.createdAt, id: listing.id };
}

export async function createListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return createListingWithStatus(userId, payload, "pending_review");
}

export async function createOwnerDraftListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return createListingWithStatus(userId, payload, "draft");
}

async function createListingWithStatus(
  userId: string | null,
  payload: CreateListingPayload,
  status: "draft" | "pending_review",
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لنشر إعلان حقيقي." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const title = payload.title.trim();
  const description = payload.description.trim();
  const contactName = payload.contactName?.trim() || null;

  if (
    !payload.categoryId.trim() ||
    (!payload.governorateId.trim() && !payload.districtAr?.trim().startsWith("@")) ||
    title.length < 4
  ) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "أكمل القسم والمحافظة والعنوان قبل إرسال الإعلان.",
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

  const insertPayload = {
    owner_id: userId,
    category_id: payload.categoryId,
    governorate_id: locationWrite.data.governorateId,
    title,
    description,
    price: payload.price,
    price_type: payload.priceType,
    listing_condition: payload.condition,
    status,
    location_node_id: locationWrite.data.locationNodeId ?? null,
    district_ar: locationWrite.data.districtAr,
    contact_name: contactName,
    contact_options: payload.contactOptions,
    details: payload.details,
  };

  const { data, error } = await clientResult.data
    .from("listings")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapListing(data as Record<string, unknown>) };
}

export async function submitOwnerListingForReview(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return resubmitOwnerListing(userId, listingId);
}

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

  const storagePath = buildListingImagePath(userId, listing.id, file.name);

  const uploadResult = await clientResult.data.storage
    .from(listingImagesBucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

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

  const [image] = await signListingImages(clientResult.data, [
    mapImage(data as Record<string, unknown>),
  ]);
  return { ok: true, data: image ?? mapImage(data as Record<string, unknown>) };
}

export async function deleteListingImage(
  userId: string | null,
  listingId: string,
  image: ListingImage,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحذف صورة الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("owner_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing || existing.owner_id !== userId) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكنك حذف صور إعلان لا تملكه." },
    };
  }

  if (existing.status !== "draft" && existing.status !== "rejected") {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكنك حذف صور إعلان لا تملكه." },
    };
  }

  const { data: storedImage, error: imageError } = await clientResult.data
    .from("listing_images")
    .select("id, listing_id, storage_path")
    .eq("id", image.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (imageError) return { ok: false, error: mapError(imageError) };
  if (!storedImage) {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر تحديد صورة الإعلان." },
    };
  }

  const storagePath = rowNullableString(storedImage as Record<string, unknown>, "storage_path");
  const { data: deletedImage, error } = await clientResult.data
    .from("listing_images")
    .delete()
    .eq("id", image.id)
    .eq("listing_id", listingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error) };
  if (!deletedImage) {
    return {
      ok: false,
      error: {
        code: "not_found",
        message: "لم يتم حذف صورة الإعلان. قد تكون تغيّرت أو حُذفت مسبقًا.",
      },
    };
  }

  if (storagePath) {
    const storageResult = await clientResult.data.storage
      .from(listingImagesBucket)
      .remove([storagePath]);
    if (storageResult.error) {
      console.error("Failed to clean up storage image after listing image delete", {
        listingId,
        imageId: image.id,
        error: storageResult.error,
      });
    }
  }

  return { ok: true, data: null };
}

export async function fetchListingImages(
  listingId: string,
): Promise<ClassifiedsResult<ListingImage[]>> {
  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد صور الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_images")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order");

  if (error) return { ok: false, error: mapError(error) };
  const images = ((data ?? []) as Record<string, unknown>[]).map(mapImage);
  return { ok: true, data: await signListingImages(clientResult.data, images) };
}
