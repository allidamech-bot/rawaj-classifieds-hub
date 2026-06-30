import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthUnavailableReason, supabase } from "@/lib/supabase";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedsResult,
  CreateSavedSearchPayload,
  ClassifiedSubcategory,
  CreateListingPayload,
  Favorite,
  ListingImage,
  ListingImageUploadPayload,
  ListingFilters,
  ListingReport,
  ListingReportType,
  ModerateReportPayload,
  ModerateListingPayload,
  PublicSellerProfile,
  SavedSearch,
} from "@/lib/classifieds-types";
import type { PlaceholderType, PriceType } from "@/types";

type Row = Record<string, unknown>;

const setupRequiredMessage = "تعذر تحميل البيانات الآن. حاول مرة أخرى.";
const storageSetupRequiredMessage =
  "تعذر رفع الصور الآن. يمكنك إرسال الإعلان بدون صور والمحاولة مرة أخرى بعد حفظه.";
const listingImagesBucket = "listing-images";
const signedImageUrlExpiresInSeconds = 900;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSizeBytes = 5 * 1024 * 1024;

function getClient(): ClassifiedsResult<SupabaseClient> {
  if (!supabase) {
    return {
      ok: false,
      error: {
        code: "supabase_unconfigured",
        message: getSupabaseAuthUnavailableReason() ?? "تعذر الاتصال بالخدمة الآن. حاول مرة أخرى.",
      },
    };
  }

  return { ok: true, data: supabase };
}

function mapError(error: { code?: string; message?: string; details?: string }): ClassifiedsError {
  const message = error.message ?? "حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات.";
  const isMissingSchema =
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("schema cache");

  if (isMissingSchema) {
    return {
      code: "schema_missing",
      message: setupRequiredMessage,
      details: message,
    };
  }

  if (error.code === "42501") {
    return {
      code: "permission_denied",
      message: "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
      details: message,
    };
  }

  return { code: "unknown", message, details: error.details };
}

function mapStorageError(error: {
  statusCode?: string | number;
  message?: string;
}): ClassifiedsError {
  const message = error.message ?? "تعذر تنفيذ عملية التخزين.";
  const isMissingStorage =
    message.includes("Bucket not found") ||
    message.includes("bucket not found") ||
    message.includes("The resource was not found") ||
    error.statusCode === 404 ||
    error.statusCode === "404";

  if (isMissingStorage) {
    return {
      code: "storage_unconfigured",
      message: storageSetupRequiredMessage,
      details: message,
    };
  }

  return { code: "unknown", message };
}

function rowString(row: Row, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}

function rowNullableString(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function rowBoolean(row: Row, key: string, fallback = false): boolean {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

function rowNumber(row: Row, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return fallback;
}

function rowNullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return null;
}

function rowArray(row: Row, key: string): string[] {
  const value = row[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function rowRecord(row: Row, key: string): Record<string, unknown> {
  const value = row[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rowBooleanRecord(row: Row, key: string): Record<string, boolean> {
  const source = rowRecord(row, key);
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

function normalizePlaceholder(value: string): PlaceholderType {
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
  return allowed.includes(value as PlaceholderType) ? (value as PlaceholderType) : "misc";
}

function fromDbReportStatus(status: string): ListingReport["status"] {
  if (status === "in_review") return "under_review";
  if (status === "dismissed") return "rejected";
  if (["new", "under_review", "resolved", "rejected"].includes(status)) {
    return status as ListingReport["status"];
  }
  return "new";
}

function toDbReportStatus(status: ListingReport["status"]): string {
  if (status === "under_review") return "in_review";
  if (status === "rejected") return "dismissed";
  return status;
}

function mapCategory(row: Row): ClassifiedCategory {
  return {
    id: rowString(row, "id"),
    slug: rowString(row, "slug"),
    nameAr: rowString(row, "name_ar"),
    hintAr: rowNullableString(row, "hint_ar"),
    placeholder: normalizePlaceholder(rowString(row, "placeholder", "misc")),
    sortOrder: rowNumber(row, "sort_order"),
    isActive: rowBoolean(row, "is_active", true),
  };
}

function mapGovernorate(row: Row): ClassifiedGovernorate {
  return {
    id: rowString(row, "id"),
    slug: rowString(row, "slug"),
    nameAr: rowString(row, "name_ar"),
    districtsAr: rowArray(row, "districts_ar"),
    sortOrder: rowNumber(row, "sort_order"),
    isActive: rowBoolean(row, "is_active", true),
  };
}

function mapListing(
  row: Row,
  categories: ClassifiedCategory[] = [],
  governorates: ClassifiedGovernorate[] = [],
): ClassifiedListing {
  const categoryId = rowString(row, "category_id");
  const governorateId = rowString(row, "governorate_id");
  const category = categories.find((item) => item.id === categoryId);
  const governorate = governorates.find((item) => item.id === governorateId);

  return {
    id: rowString(row, "id"),
    ownerId: rowString(row, "owner_id"),
    categoryId,
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
    status: rowString(row, "status", "pending_review") as ClassifiedListing["status"],
    districtAr: rowNullableString(row, "district_ar"),
    contactName: rowNullableString(row, "contact_name"),
    contactOptions: rowBooleanRecord(row, "contact_options"),
    details: rowRecord(row, "details"),
    isFeatured: rowBoolean(row, "is_featured"),
    featuredUntil: rowNullableString(row, "featured_until"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    rejectionReason: rowNullableString(row, "rejection_reason"),
    publishedAt: rowNullableString(row, "published_at"),
    archivedAt: rowNullableString(row, "archived_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapImage(row: Row): ListingImage {
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
  return signListingImages(client, ((data ?? []) as Row[]).map(mapImage));
}

async function hydrateListingsWithPrimaryImages(
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

function mapSubcategory(row: Row): ClassifiedSubcategory {
  return {
    id: rowString(row, "id"),
    categoryId: rowString(row, "category_id"),
    nameAr: rowString(row, "name_ar"),
    sortOrder: rowNumber(row, "sort_order"),
  };
}

async function readReferences(client: SupabaseClient) {
  const [categoriesResult, governoratesResult] = await Promise.all([
    client.from("categories").select("*").eq("is_active", true).order("sort_order"),
    client.from("governorates").select("*").eq("is_active", true).order("sort_order"),
  ]);

  if (categoriesResult.error)
    return { ok: false as const, error: mapError(categoriesResult.error) };
  if (governoratesResult.error)
    return { ok: false as const, error: mapError(governoratesResult.error) };

  return {
    ok: true as const,
    categories: ((categoriesResult.data ?? []) as Row[]).map(mapCategory),
    governorates: ((governoratesResult.data ?? []) as Row[]).map(mapGovernorate),
  };
}

export async function fetchPublicCategories(): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapCategory) };
}

export async function fetchPublicSubcategories(): Promise<
  ClassifiedsResult<ClassifiedSubcategory[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("subcategories")
    .select("*")
    .order("sort_order");

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapSubcategory) };
}

export async function fetchPublicGovernorates(): Promise<
  ClassifiedsResult<ClassifiedGovernorate[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("governorates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapGovernorate) };
}

export async function fetchPublicListings(
  filters: ListingFilters = {},
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  let query = clientResult.data.from("listings").select("*").eq("status", "approved");

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.governorateId) query = query.eq("governorate_id", filters.governorateId);
  if (filters.query?.trim()) {
    const term = filters.query.trim();
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  switch (filters.sort) {
    case "cheapest":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "expensive":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    case "featured":
      query = query
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data, error } = await query.limit(60);
  if (error) return { ok: false, error: mapError(error) };

  const listings = ((data ?? []) as Row[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );

  return { ok: true, data: await hydrateListingsWithPrimaryImages(clientResult.data, listings) };
}

export async function fetchListingDetail(
  id: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان غير متاح أو لم تتم الموافقة عليه بعد." },
    };
  }

  const listing = mapListing(data as Row, references.categories, references.governorates);
  const [hydratedListing] = await hydrateListingsWithPrimaryImages(clientResult.data, [listing]);
  return { ok: true, data: hydratedListing ?? listing };
}

export async function fetchPublicSellerProfile(
  sellerId: string,
): Promise<ClassifiedsResult<PublicSellerProfile>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (!sellerId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البائع." },
    };
  }

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("owner_id", sellerId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return { ok: false, error: mapError(error) };

  const listings = await hydrateListingsWithPrimaryImages(
    clientResult.data,
    ((data ?? []) as Row[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  );

  if (listings.length === 0) {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر عرض ملف هذا البائع الآن." },
    };
  }

  const firstListing = listings[0];
  const contactName = firstListing.contactName?.trim();

  return {
    ok: true,
    data: {
      id: sellerId,
      displayName: contactName || "بائع رَوَاج",
      verified: false,
      joinedAt: listings.at(-1)?.createdAt ?? null,
      locationAr: firstListing.governorateNameAr ?? null,
      listings,
    },
  };
}

export async function fetchListingImages(
  listingId: string,
): Promise<ClassifiedsResult<ListingImage[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_images")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order");

  if (error) return { ok: false, error: mapError(error) };
  const images = ((data ?? []) as Row[]).map(mapImage);
  return { ok: true, data: await signListingImages(clientResult.data, images) };
}

export async function fetchCurrentUserListings(
  userId: string,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
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
  const listings = ((data ?? []) as Row[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );

  return { ok: true, data: await hydrateListingsWithPrimaryImages(clientResult.data, listings) };
}

export async function createListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لنشر إعلان حقيقي." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const insertPayload = {
    owner_id: userId,
    category_id: payload.categoryId,
    governorate_id: payload.governorateId,
    title: payload.title,
    description: payload.description,
    price: payload.price,
    price_type: payload.priceType,
    listing_condition: payload.condition,
    status: "pending_review",
    district_ar: payload.districtAr,
    contact_name: payload.contactName,
    contact_options: payload.contactOptions,
    details: payload.details,
  };

  const { data, error } = await clientResult.data
    .from("listings")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapListing(data as Row) };
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

  if (!["draft", "pending_review", "rejected"].includes(listing.status)) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل صور إعلان بعد اعتماده." },
    };
  }

  if (!allowedImageTypes.includes(file.type)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "الصيغ المسموحة للصور: JPG أو PNG أو WebP." },
    };
  }

  if (file.size > maxImageSizeBytes) {
    return {
      ok: false,
      error: { code: "validation_error", message: "حجم الصورة يجب ألا يتجاوز 5MB." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const extension = file.name.split(".").pop()?.toLowerCase();
  const safeExtension =
    extension && ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const storagePath = `${userId}/${listing.id}/${crypto.randomUUID()}.${safeExtension}`;

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

  const [image] = await signListingImages(clientResult.data, [mapImage(data as Row)]);
  return { ok: true, data: image ?? mapImage(data as Row) };
}

export async function deleteListingImage(
  userId: string | null,
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

  if (image.storagePath) {
    const storageResult = await clientResult.data.storage
      .from(listingImagesBucket)
      .remove([image.storagePath]);
    if (storageResult.error) return { ok: false, error: mapStorageError(storageResult.error) };
  }

  const { error } = await clientResult.data.from("listing_images").delete().eq("id", image.id);
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function fetchFavorites(
  userId: string | null,
): Promise<ClassifiedsResult<Favorite[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض المفضلة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("favorites")
    .select("user_id, listing_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };

  const favorites = ((data ?? []) as Row[]).map((row) => ({
    userId: rowString(row, "user_id"),
    listingId: rowString(row, "listing_id"),
    createdAt: rowString(row, "created_at"),
  }));

  const listingIds = [...new Set(favorites.map((favorite) => favorite.listingId).filter(Boolean))];
  if (listingIds.length === 0) return { ok: true, data: favorites };

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: true, data: favorites };

  const listingsResult = await clientResult.data
    .from("listings")
    .select("*")
    .in("id", listingIds)
    .eq("status", "approved");

  if (listingsResult.error) return { ok: true, data: favorites };

  const listings = await hydrateListingsWithPrimaryImages(
    clientResult.data,
    ((listingsResult.data ?? []) as Row[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  );
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));

  return {
    ok: true,
    data: favorites.map((favorite) => ({
      ...favorite,
      listing: listingById.get(favorite.listingId),
    })),
  };
}

export async function favoriteListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("favorites")
    .upsert({ user_id: userId, listing_id: listingId });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function unfavoriteListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتعديل المفضلة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", listingId);
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function fetchSavedSearches(
  userId: string | null,
): Promise<ClassifiedsResult<SavedSearch[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض عمليات البحث المحفوظة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) => ({
      id: rowString(row, "id"),
      userId: rowString(row, "user_id"),
      nameAr: rowString(row, "name_ar"),
      filters: rowRecord(row, "filters"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
  };
}

export async function createSavedSearch(
  userId: string | null,
  payload: CreateSavedSearchPayload,
): Promise<ClassifiedsResult<SavedSearch>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ البحث." },
    };
  }

  const nameAr = payload.nameAr.trim();
  if (!nameAr) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل اسماً واضحاً للبحث المحفوظ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("saved_searches")
    .insert({
      user_id: userId,
      name_ar: nameAr,
      filters: payload.filters,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: {
      id: rowString(data as Row, "id"),
      userId: rowString(data as Row, "user_id"),
      nameAr: rowString(data as Row, "name_ar"),
      filters: rowRecord(data as Row, "filters"),
      createdAt: rowString(data as Row, "created_at"),
      updatedAt: rowString(data as Row, "updated_at"),
    },
  };
}

export async function deleteSavedSearch(
  userId: string | null,
  savedSearchId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحذف البحث المحفوظ." },
    };
  }

  if (!savedSearchId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البحث المحفوظ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("saved_searches")
    .delete()
    .eq("id", savedSearchId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function createListingReport(
  userId: string | null,
  listingId: string,
  reportType: ListingReportType,
  reason: string,
): Promise<ClassifiedsResult<ListingReport>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال بلاغ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_reports")
    .insert({
      listing_id: listingId,
      reporter_id: userId,
      report_type: reportType,
      reason,
      status: "new",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapReport(data as Row) };
}

export async function adminFetchPendingListings(
  canUseOwnerControls: boolean,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  if (!canUseOwnerControls) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "هذه البيانات متاحة للمالك فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .in("status", ["pending_review", "rejected"])
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  };
}

export async function adminFetchReports(
  canUseOwnerControls: boolean,
): Promise<ClassifiedsResult<ListingReport[]>> {
  if (!canUseOwnerControls) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة البلاغات متاحة للمالك فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapReport) };
}

export async function adminModerateReport(
  canUseOwnerControls: boolean,
  payload: ModerateReportPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseOwnerControls) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة البلاغات متاحة للمالك فقط." },
    };
  }

  if (!payload.reportId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البلاغ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const dbStatus = toDbReportStatus(payload.status);
  const { error } = await clientResult.data
    .from("listing_reports")
    .update({
      status: dbStatus,
      assigned_to: payload.assignedTo ?? null,
      admin_note: payload.adminNote ?? null,
      resolved_at:
        payload.resolvedAt ??
        (payload.status === "resolved" || payload.status === "rejected"
          ? new Date().toISOString()
          : null),
    })
    .eq("id", payload.reportId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function adminModerateListing(
  canUseOwnerControls: boolean,
  payload: ModerateListingPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseOwnerControls) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة الإعلانات متاحة للمالك فقط." },
    };
  }

  if (!payload.listingId.trim() || !payload.reviewerId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان أو حساب المراجع." },
    };
  }

  if (payload.status === "rejected" && !payload.rejectionReason?.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبب الرفض قبل تحديث الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const updatePayload = {
    status: payload.status,
    reviewed_by: payload.reviewerId,
    reviewed_at: new Date().toISOString(),
    rejection_reason:
      payload.status === "rejected" ? (payload.rejectionReason ?? "مرفوض من لوحة الإدارة") : null,
    published_at: payload.status === "approved" ? new Date().toISOString() : null,
    archived_at: payload.status === "archived" ? new Date().toISOString() : null,
  };

  const { error } = await clientResult.data
    .from("listings")
    .update(updatePayload)
    .eq("id", payload.listingId);
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

function mapReport(row: Row): ListingReport {
  return {
    id: rowString(row, "id"),
    listingId: rowString(row, "listing_id"),
    reporterId: rowString(row, "reporter_id"),
    reportType: rowString(row, "report_type", "other") as ListingReport["reportType"],
    reason: rowString(row, "reason"),
    status: fromDbReportStatus(rowString(row, "status", "new")),
    assignedTo: rowNullableString(row, "assigned_to"),
    adminNote: rowNullableString(row, "admin_note"),
    resolvedAt: rowNullableString(row, "resolved_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
