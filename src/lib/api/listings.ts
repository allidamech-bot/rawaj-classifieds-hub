import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateListingPayload,
  ListingCursor,
  ListingFilters,
  ListingImage,
  ListingImageUploadPayload,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import type { PlaceholderType, PriceType } from "@/types";
import { cloudflareApiRequest, cloudflareApiUrl } from "@/lib/cloudflare-auth";
import {
  fetchCloudflareListingDetail,
  fetchCloudflareListings,
} from "@/lib/public-data/cloudflare-client";
import { validateImageFile } from "@/lib/api/storage";
import {
  prepareListingImageForUpload,
  validateListingImageContent,
} from "@/lib/listing-image-processing";

const OWNER_DETAIL_PATH = "/api/listings";
const PUBLIC_STATUS = "approved";

export function mapListing(
  row: Record<string, unknown>,
  categories: ClassifiedCategory[] = [],
  governorates: ClassifiedGovernorate[] = [],
): ClassifiedListing {
  const categoryId = text(row.categoryId ?? row.category_id);
  const governorateId = text(row.governorateId ?? row.governorate_id);
  const category = categories.find((item) => item.id === categoryId);
  const governorate = governorates.find((item) => item.id === governorateId);
  const rawStatus = text(row.status, "pending_review") as ClassifiedListing["status"];
  const expiryDays = numberOrNull(row.expiryDays ?? row.expiry_days);

  return {
    id: text(row.id),
    ownerId: text(row.ownerId ?? row.owner_id),
    categoryId,
    subcategoryId: nullableText(row.subcategoryId ?? row.subcategory_id),
    categoryNameAr: nullableText(row.categoryNameAr ?? row.category_name_ar) ?? category?.nameAr,
    categoryPlaceholder:
      normalizePlaceholder(row.categoryPlaceholder ?? row.category_placeholder) ??
      category?.placeholder,
    governorateId,
    governorateNameAr:
      nullableText(row.governorateNameAr ?? row.governorate_name_ar) ?? governorate?.nameAr,
    locationNodeId: nullableText(row.locationNodeId ?? row.location_node_id),
    title: text(row.title),
    description: text(row.description),
    price: numberOrNull(row.price),
    currency: "SYP",
    priceType: text(row.priceType ?? row.price_type, "fixed") as PriceType,
    condition: text(
      row.condition ?? row.listingCondition ?? row.listing_condition,
      "not_applicable",
    ) as ClassifiedListing["condition"],
    status: rawStatus,
    districtAr: nullableText(row.districtAr ?? row.district_ar),
    contactName: nullableText(row.contactName ?? row.contact_name),
    contactOptions: booleanRecord(row.contactOptions ?? row.contact_options),
    details: jsonObject(row.details),
    isFeatured: booleanValue(row.isFeatured ?? row.is_featured),
    featuredUntil: nullableText(row.featuredUntil ?? row.featured_until),
    reviewedBy: nullableText(row.reviewedBy ?? row.reviewed_by),
    reviewedAt: nullableText(row.reviewedAt ?? row.reviewed_at),
    rejectionReason: nullableText(row.rejectionReason ?? row.rejection_reason),
    publishedAt: nullableText(row.publishedAt ?? row.published_at),
    archivedAt: nullableText(row.archivedAt ?? row.archived_at),
    reservedAt: nullableText(row.reservedAt ?? row.reserved_at),
    statusChangedAt: nullableText(row.statusChangedAt ?? row.status_changed_at),
    expiresAt: nullableText(row.expiresAt ?? row.expires_at),
    renewedAt: nullableText(row.renewedAt ?? row.renewed_at),
    expiryDays: expiryDays === 30 || expiryDays === 60 || expiryDays === 90 ? expiryDays : null,
    createdAt: text(row.createdAt ?? row.created_at),
    updatedAt: text(row.updatedAt ?? row.updated_at),
    primaryImageUrl: absoluteMediaUrl(nullableText(row.primaryImageUrl ?? row.primary_image_url)),
  };
}

export function mapImage(row: Record<string, unknown>): ListingImage {
  return {
    id: text(row.id),
    listingId: text(row.listingId ?? row.listing_id),
    storagePath: nullableText(row.storagePath ?? row.storage_path),
    publicUrl: absoluteMediaUrl(nullableText(row.publicUrl ?? row.public_url)),
    signedUrlExpiresIn: numberOrNull(row.signedUrlExpiresIn ?? row.signed_url_expires_in),
    altAr: nullableText(row.altAr ?? row.alt_ar),
    sortOrder: numberValue(row.sortOrder ?? row.sort_order),
    createdAt: text(row.createdAt ?? row.created_at),
  };
}

export function fetchPublicListings(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  return fetchCloudflareListings(filters, cursor, pageSize);
}

export async function fetchListingDetail(
  id: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const listingId = id.trim();
  if (!listingId) return validationFailure("تعذر تحديد الإعلان المطلوب.");

  const result = await fetchCloudflareListingDetail(listingId);
  return result.ok ? { ok: true, data: result.data.listing } : result;
}

export async function fetchOwnerListingDetail(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لعرض تفاصيل الإعلان.");
  const cleanId = listingId.trim();
  if (!cleanId) return validationFailure("تعذر تحديد الإعلان المطلوب.");

  const result = await cloudflareApiRequest<{
    listing: Record<string, unknown>;
    images?: Record<string, unknown>[];
  }>(`${OWNER_DETAIL_PATH}/${encodeURIComponent(cleanId)}`);
  if (!result.ok) return apiFailure(result);

  const listing = mapListing(result.data.listing);
  const images = (result.data.images ?? []).map(mapImage);
  return {
    ok: true,
    data: {
      ...listing,
      primaryImageUrl: listing.primaryImageUrl ?? images[0]?.publicUrl ?? null,
    },
  };
}

export async function fetchCurrentUserListings(
  userId: string | null,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لعرض إعلاناتك.");
  const result = await cloudflareApiRequest<Record<string, unknown>[]>("/v1/account/listings");
  return result.ok
    ? { ok: true, data: result.data.map((row) => mapListing(row)) }
    : apiFailure(result);
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
  if (!userId) return authFailure("يجب تسجيل الدخول لحذف الإعلان.");
  const cleanId = listingId.trim();
  if (!cleanId) return validationFailure("تعذر تحديد الإعلان المطلوب.");

  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanId)}`,
    { method: "DELETE" },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

/**
 * Compatibility signature for callers that previously supplied a database client.
 * Cloudflare responses normally include the primary image already. Missing images
 * are hydrated through the Worker without any direct database or storage access.
 */
export async function hydrateListingsWithPrimaryImages(
  _retiredClient: unknown,
  listings: ClassifiedListing[],
): Promise<ClassifiedListing[]> {
  const missing = listings.filter((listing) => !listing.primaryImageUrl);
  if (missing.length === 0) return listings;

  const hydrated = new Map<string, string | null>();
  await runWithConcurrency(missing, 6, async (listing) => {
    const detail =
      listing.status === PUBLIC_STATUS
        ? await fetchCloudflareListingDetail(listing.id)
        : await fetchOwnerBundle(listing.id);
    if (detail.ok) hydrated.set(listing.id, detail.data.images[0]?.publicUrl ?? null);
  });

  return listings.map((listing) =>
    hydrated.has(listing.id)
      ? { ...listing, primaryImageUrl: hydrated.get(listing.id) ?? null }
      : listing,
  );
}

export async function createListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return createListingWithSubmit(userId, payload, true);
}

export async function createOwnerDraftListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return createListingWithSubmit(userId, payload, false);
}

async function createListingWithSubmit(
  userId: string | null,
  payload: CreateListingPayload,
  submit: boolean,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return authFailure(
      submit ? "يجب تسجيل الدخول لنشر إعلان حقيقي." : "يجب تسجيل الدخول لحفظ المسودة.",
    );
  }
  const normalized = normalizeListingPayload(payload);
  if (!normalized.ok) return normalized;

  const created = await cloudflareApiRequest<{ id: string; status: string }>("/v1/listings", {
    method: "POST",
    body: { ...normalized.data, submit },
  });
  if (!created.ok) return apiFailure(created);

  return fetchOwnerListingDetail(userId, created.data.id);
}

export async function uploadListingImage({
  userId,
  listing,
  file,
  altAr,
}: ListingImageUploadPayload): Promise<ClassifiedsResult<ListingImage>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لرفع صور الإعلان.");
  if (listing.ownerId !== userId) {
    return permissionFailure("لا يمكنك رفع صور لإعلان لا تملكه.");
  }
  if (!isEditableImageStatus(listing.status)) {
    return permissionFailure("لا يمكن تعديل صور إعلان بعد اعتماده.");
  }

  const validation = validateImageFile(file);
  if (!validation.ok) return validationFailure(validation.error ?? "ملف الصورة غير صالح.");
  const contentValidation = await validateListingImageContent(file);
  if (!contentValidation.ok) {
    return validationFailure(contentValidation.error ?? "محتوى الصورة غير صالح.");
  }

  const prepared = await prepareListingImageForUpload(file);
  const preparedValidation = validateImageFile(prepared);
  if (!preparedValidation.ok) {
    return validationFailure(preparedValidation.error ?? "تعذر تجهيز الصورة.");
  }
  const preparedContentValidation = await validateListingImageContent(prepared);
  if (!preparedContentValidation.ok) {
    return validationFailure(preparedContentValidation.error ?? "تعذر التحقق من الصورة المجهزة.");
  }

  const form = new FormData();
  form.set("file", prepared, prepared.name);
  form.set("altAr", altAr?.trim() || listing.title);
  const result = await cloudflareApiRequest<Record<string, unknown>>(
    `/v1/listings/${encodeURIComponent(listing.id)}/images`,
    { method: "POST", body: form },
  );
  return result.ok ? { ok: true, data: mapImage(result.data) } : apiFailure(result);
}

export async function deleteListingImage(
  userId: string | null,
  listingId: string,
  image: ListingImage,
): Promise<ClassifiedsResult<null>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لحذف صورة الإعلان.");
  if (!listingId.trim() || image.listingId !== listingId) {
    return validationFailure("تعذر تحديد صورة الإعلان.");
  }

  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/listing-images/${encodeURIComponent(image.id)}`,
    { method: "DELETE" },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

export async function fetchListingImages(
  listingId: string,
): Promise<ClassifiedsResult<ListingImage[]>> {
  const cleanId = listingId.trim();
  if (!cleanId) return validationFailure("تعذر تحديد صور الإعلان.");

  const publicDetail = await fetchCloudflareListingDetail(cleanId);
  if (publicDetail.ok) return { ok: true, data: publicDetail.data.images };

  const ownerDetail = await fetchOwnerBundle(cleanId);
  return ownerDetail.ok ? { ok: true, data: ownerDetail.data.images } : ownerDetail;
}

async function fetchOwnerBundle(
  listingId: string,
): Promise<ClassifiedsResult<{ listing: ClassifiedListing; images: ListingImage[] }>> {
  const result = await cloudflareApiRequest<{
    listing: Record<string, unknown>;
    images?: Record<string, unknown>[];
  }>(`${OWNER_DETAIL_PATH}/${encodeURIComponent(listingId)}`);
  return result.ok
    ? {
        ok: true,
        data: {
          listing: mapListing(result.data.listing),
          images: (result.data.images ?? []).map(mapImage),
        },
      }
    : apiFailure(result);
}

function normalizeListingPayload(
  payload: CreateListingPayload,
): ClassifiedsResult<Record<string, unknown>> {
  const categoryId = payload.categoryId.trim();
  const governorateId = payload.governorateId.trim();
  const title = payload.title.trim();
  const description = payload.description.trim();
  const canonicalLocationId = payload.districtAr?.trim().startsWith("@")
    ? payload.districtAr.trim().slice(1)
    : null;

  if (!categoryId || !governorateId || title.length < 4) {
    return validationFailure("أكمل القسم والمحافظة والعنوان قبل حفظ الإعلان.");
  }
  if (payload.price !== null && (!Number.isFinite(payload.price) || payload.price < 0)) {
    return validationFailure("أدخل سعراً صحيحاً أو اترك السعر فارغاً.");
  }

  return {
    ok: true,
    data: {
      categoryId,
      subcategoryId: payload.subcategoryId?.trim() || null,
      governorateId,
      locationNodeId: canonicalLocationId || null,
      title,
      description,
      price: payload.price,
      priceType: payload.priceType,
      condition: payload.condition,
      districtAr: canonicalLocationId ? null : payload.districtAr?.trim() || null,
      contactName: payload.contactName?.trim() || null,
      contactOptions: booleanRecord(payload.contactOptions),
      details: jsonObject(payload.details),
    },
  };
}

function apiFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
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

function permissionFailure<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "permission_denied", message } };
}

function isEditableImageStatus(status: ClassifiedListing["status"]): boolean {
  return status === "draft" || status === "rejected";
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return numberOrNull(value) ?? fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function booleanRecord(value: unknown): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(jsonObject(value)).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

function normalizePlaceholder(value: unknown): PlaceholderType | undefined {
  const normalized = nullableText(value);
  const allowed: PlaceholderType[] = [
    "car",
    "realestate",
    "phone",
    "electronics",
    "furniture",
    "job",
    "service",
    "fashion",
    "food",
    "animals",
    "education",
    "business",
    "misc",
  ];
  return normalized && allowed.includes(normalized as PlaceholderType)
    ? (normalized as PlaceholderType)
    : undefined;
}

function absoluteMediaUrl(value: string | null): string | null {
  return value ? cloudflareApiUrl(value) : null;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}
