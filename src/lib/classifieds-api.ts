import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthUnavailableReason, supabase } from "@/lib/supabase";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedsResult,
  Conversation,
  ConversationMessage,
  CreateListingPromotionRequestPayload,
  CreateSavedSearchPayload,
  CreateMessageReportPayload,
  ClassifiedSubcategory,
  CreateListingPayload,
  CreateSellerVerificationRequestPayload,
  Favorite,
  ListingPromotionRequest,
  ListingImage,
  ListingImageUploadPayload,
  ListingFilters,
  MessageReport,
  ListingReport,
  ListingReportType,
  PromotionReceiptUploadPayload,
  ModerateListingPromotionRequestPayload,
  ModerateMessageReportPayload,
  ModerateReportPayload,
  CreateSupportRequestPayload,
  ModerateListingPayload,
  ModerateSupportRequestPayload,
  ModerateSellerReviewPayload,
  ModerateSellerVerificationRequestPayload,
  NotificationItem,
  ProfileMediaKind,
  ProfileMediaUploadPayload,
  SellerVerificationRequest,
  BlockConversationPayload,
  PublicSellerSearchResult,
  PublicSellerProfile,
  SavedSearch,
  SellerRatingSummary,
  SellerReview,
  SupportRequest,
  CreateSellerReviewPayload,
  UpdateProfileBasicsPayload,
  UpdateListingPayload,
} from "@/lib/classifieds-types";
import type { PlaceholderType, PriceType } from "@/types";

type Row = Record<string, unknown>;

const setupRequiredMessage = "تعذر تحميل البيانات الآن. حاول مرة أخرى.";
const storageSetupRequiredMessage =
  "تعذر رفع الصور الآن. يمكنك إرسال الإعلان بدون صور والمحاولة مرة أخرى بعد حفظه.";
const listingImagesBucket = "listing-images";
const profileMediaBucket = "profile-media";
const promotionReceiptsBucket = "promotion-receipts";
const signedImageUrlExpiresInSeconds = 900;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedReceiptTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const maxImageSizeBytes = 5 * 1024 * 1024;
const maxProfileImageSizeBytes = 3 * 1024 * 1024;
const maxReceiptSizeBytes = 8 * 1024 * 1024;

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

function publicProfileMediaUrl(client: SupabaseClient, path: string | null): string | null {
  if (!path) return null;
  const { data } = client.storage.from(profileMediaBucket).getPublicUrl(path);
  return data.publicUrl ?? null;
}

function mapReview(row: Row): SellerReview {
  return {
    id: rowString(row, "id"),
    sellerUserId: rowString(row, "seller_user_id"),
    reviewerUserId: rowString(row, "reviewer_user_id"),
    relatedListingId: rowNullableString(row, "related_listing_id"),
    rating: rowNumber(row, "rating"),
    comment: rowString(row, "comment"),
    status: rowString(row, "status", "pending_review") as SellerReview["status"],
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapConversation(row: Row): Conversation {
  return {
    id: rowString(row, "id"),
    listingId: rowString(row, "listing_id"),
    listingTitle: rowString(row, "listing_title", "إعلان على رواجا"),
    buyerUserId: rowString(row, "buyer_user_id"),
    sellerUserId: rowString(row, "seller_user_id"),
    status: rowString(row, "status", "active") as Conversation["status"],
    otherParticipant: {
      userId: rowString(row, "other_user_id"),
      displayName: rowString(row, "other_display_name", "مستخدم رواجا"),
      avatarUrl: rowNullableString(row, "other_avatar_url"),
      governorate: rowNullableString(row, "other_governorate"),
    },
    lastMessageAt: rowNullableString(row, "last_message_at"),
    lastMessagePreview: rowNullableString(row, "last_message_preview"),
    unreadCount: rowNumber(row, "unread_count"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapMessage(row: Row): ConversationMessage {
  return {
    id: rowString(row, "id"),
    conversationId: rowString(row, "conversation_id"),
    senderUserId: rowString(row, "sender_user_id"),
    body: rowString(row, "body"),
    createdAt: rowString(row, "created_at"),
    editedAt: rowNullableString(row, "edited_at"),
    deletedAt: rowNullableString(row, "deleted_at"),
  };
}

function mapMessageReport(row: Row): MessageReport {
  return {
    id: rowString(row, "id"),
    messageId: rowString(row, "message_id"),
    conversationId: rowString(row, "conversation_id"),
    reporterUserId: rowString(row, "reporter_user_id"),
    reportedUserId: rowString(row, "reported_user_id"),
    reason: rowString(row, "reason"),
    details: rowNullableString(row, "details"),
    status: rowString(row, "status", "new") as MessageReport["status"],
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    messageBody: rowNullableString(row, "message_body"),
    listingId: rowNullableString(row, "listing_id"),
    listingTitle: rowNullableString(row, "listing_title"),
    reporterDisplayName: rowNullableString(row, "reporter_display_name"),
    reportedDisplayName: rowNullableString(row, "reported_display_name"),
  };
}

function mapVerificationRequest(row: Row): SellerVerificationRequest {
  return {
    id: rowString(row, "id"),
    userId: rowString(row, "user_id"),
    status: rowString(row, "status", "pending_review") as SellerVerificationRequest["status"],
    requestType: rowString(
      row,
      "request_type",
      "personal",
    ) as SellerVerificationRequest["requestType"],
    legalName: rowString(row, "legal_name"),
    businessName: rowNullableString(row, "business_name"),
    documentType: rowNullableString(row, "document_type"),
    documentPath: rowNullableString(row, "document_path"),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapPromotionRequest(row: Row): ListingPromotionRequest {
  return {
    id: rowString(row, "id"),
    listingId: rowString(row, "listing_id"),
    requesterUserId: rowString(row, "requester_user_id"),
    promotionType: rowString(
      row,
      "promotion_type",
      "featured_home",
    ) as ListingPromotionRequest["promotionType"],
    status: rowString(row, "status", "pending_review") as ListingPromotionRequest["status"],
    requestedDays: rowNumber(row, "requested_days", 7),
    startsAt: rowNullableString(row, "starts_at"),
    endsAt: rowNullableString(row, "ends_at"),
    paymentMethod: rowNullableString(row, "payment_method"),
    paymentReference: rowNullableString(row, "payment_reference"),
    proofPath: rowNullableString(row, "proof_path"),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    listingTitle: rowNullableString(row, "listing_title"),
  };
}

function mapPublicSellerSearchResult(row: Row): PublicSellerSearchResult {
  const firstName = rowNullableString(row, "first_name");
  const lastName = rowNullableString(row, "last_name");
  const displayName =
    rowNullableString(row, "display_name") ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    rowNullableString(row, "business_name") ||
    "معلن على رواجا";

  return {
    id: rowString(row, "id"),
    displayName,
    firstName,
    lastName,
    businessName: rowNullableString(row, "business_name"),
    governorate: rowNullableString(row, "governorate"),
    bio: rowNullableString(row, "bio"),
    avatarUrl: rowNullableString(row, "avatar_url"),
    approvedListingCount: rowNumber(row, "approved_listing_count"),
  };
}

function emptyRatingSummary(): SellerRatingSummary {
  return {
    average: null,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

function buildRatingSummary(reviews: SellerReview[]): SellerRatingSummary {
  const approved = reviews.filter((review) => review.status === "approved");
  if (approved.length === 0) return emptyRatingSummary();

  const distribution: SellerRatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const review of approved) {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[rating] += 1;
    total += rating;
  }

  return {
    average: Number((total / approved.length).toFixed(1)),
    count: approved.length,
    distribution,
  };
}

function cleanOptionalText(value: string | null | undefined, maxLength: number): string | null {
  const clean = value?.trim() ?? "";
  return clean ? clean.slice(0, maxLength) : null;
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
  if (filters.subcategoryId) query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.governorateId) query = query.eq("governorate_id", filters.governorateId);
  if (filters.districtAr?.trim()) query = query.eq("district_ar", filters.districtAr.trim());
  if (typeof filters.priceMin === "number") query = query.gte("price", filters.priceMin);
  if (typeof filters.priceMax === "number") query = query.lte("price", filters.priceMax);
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

async function fetchPublicSellerProfileLegacy(
  sellerId: string,
): Promise<ClassifiedsResult<unknown>> {
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

export async function fetchPublicSellerProfile(
  sellerId: string,
): Promise<ClassifiedsResult<PublicSellerProfile>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const cleanSellerId = sellerId.trim();
  if (!cleanSellerId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البائع." },
    };
  }

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data: listingData, error: listingError } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("owner_id", cleanSellerId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(60);

  if (listingError) return { ok: false, error: mapError(listingError) };

  const listings = await hydrateListingsWithPrimaryImages(
    clientResult.data,
    ((listingData ?? []) as Row[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  );

  const { data: profileData, error: profileError } = await clientResult.data
    .rpc("get_public_seller_profile", { p_seller_id: cleanSellerId })
    .maybeSingle();

  if (profileError && profileError.code !== "42P01" && profileError.code !== "42703") {
    return { ok: false, error: mapError(profileError) };
  }

  if (listings.length === 0 && !profileData) {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر عرض ملف هذا البائع الآن." },
    };
  }

  const { data: reviewData, error: reviewError } = await clientResult.data
    .from("seller_reviews")
    .select("*")
    .eq("seller_user_id", cleanSellerId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  if (reviewError && reviewError.code !== "42P01" && reviewError.code !== "42703") {
    return { ok: false, error: mapError(reviewError) };
  }

  const profile = (profileData ?? {}) as Row;
  const firstListing = listings[0];
  const firstName = rowNullableString(profile, "first_name");
  const lastName = rowNullableString(profile, "last_name");
  const displayName =
    rowNullableString(profile, "display_name") ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    firstListing?.contactName?.trim() ||
    "بائع رواجا";
  const reviews = ((reviewData ?? []) as Row[]).map(mapReview);

  return {
    ok: true,
    data: {
      id: cleanSellerId,
      firstName,
      lastName,
      displayName,
      verified: rowBoolean(profile, "verified", false),
      joinedAt: rowNullableString(profile, "created_at") ?? listings.at(-1)?.createdAt ?? null,
      locationAr:
        rowNullableString(profile, "governorate") ?? firstListing?.governorateNameAr ?? null,
      bio: rowNullableString(profile, "bio"),
      businessName: rowNullableString(profile, "business_name"),
      avatarUrl:
        rowNullableString(profile, "avatar_url") ??
        publicProfileMediaUrl(clientResult.data, rowNullableString(profile, "avatar_path")),
      coverUrl:
        rowNullableString(profile, "cover_url") ??
        publicProfileMediaUrl(clientResult.data, rowNullableString(profile, "cover_path")),
      approvedListingCount: listings.length,
      ratingSummary: buildRatingSummary(reviews),
      reviews,
      listings,
    },
  };
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
  const images = ((data ?? []) as Row[]).map(mapImage);
  return { ok: true, data: await signListingImages(clientResult.data, images) };
}

export async function fetchCurrentUserListings(
  userId: string,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  if (!userId.trim()) {
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
  const listings = ((data ?? []) as Row[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );

  return { ok: true, data: await hydrateListingsWithPrimaryImages(clientResult.data, listings) };
}

async function updateOwnProfileBasicsLegacy(
  userId: string | null,
  payload: { displayName: string; governorate: string | null },
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث الحساب." },
    };
  }

  const displayName = payload.displayName.trim();
  const governorate = payload.governorate?.trim() || null;

  if (displayName.length < 2 || displayName.length > 80) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل اسما بين 2 و80 حرفا." },
    };
  }

  if (governorate && governorate.length > 80) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اسم المحافظة طويل جدا." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("profiles")
    .update({
      display_name: displayName,
      governorate,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function updateOwnProfileBasics(
  userId: string | null,
  payload: UpdateProfileBasicsPayload,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث الحساب." },
    };
  }

  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const computedDisplayName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName =
    payload.displayName && payload.displayName.trim().length > 0
      ? payload.displayName.trim()
      : computedDisplayName || null;
  const governorate = cleanOptionalText(payload.governorate, 80);
  const cityArea = cleanOptionalText(payload.cityArea, 80);
  const bio = cleanOptionalText(payload.bio, 600);
  const businessName = cleanOptionalText(payload.businessName, 120);
  const phone = cleanOptionalText(payload.phone, 40);
  const whatsapp = cleanOptionalText(payload.whatsapp, 40);
  const preferredContactMethod = cleanOptionalText(payload.preferredContactMethod, 40);

  if (firstName.length < 2 || firstName.length > 40 || lastName.length > 40) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل الاسم الأول بين 2 و40 حرفا." },
    };
  }

  if (bio && bio.length > 600) {
    return {
      ok: false,
      error: { code: "validation_error", message: "النبذة يجب ألا تتجاوز 600 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName || null,
      display_name: displayName,
      governorate,
      city_area: cityArea,
      bio,
      business_name: businessName,
      phone,
      whatsapp,
      preferred_contact_method: preferredContactMethod,
    })
    .eq("id", userId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
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

  const listing = mapListing(data as Row, references.categories, references.governorates);
  const [hydratedListing] = await hydrateListingsWithPrimaryImages(clientResult.data, [listing]);
  return { ok: true, data: hydratedListing ?? listing };
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
    .in("status", ["draft", "pending_review", "rejected"])
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
  if (payload.districtAr !== undefined) updateData.district_ar = payload.districtAr;
  if (payload.contactName !== undefined) updateData.contact_name = payload.contactName;
  if (payload.contactOptions) updateData.contact_options = payload.contactOptions;
  if (payload.details !== undefined) updateData.details = payload.details;

  const { data, error } = await clientResult.data
    .from("listings")
    .update(updateData)
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "pending_review", "rejected"])
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
    data: mapListing(data[0] as Row, references.categories, references.governorates),
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
  if (payload.districtAr !== undefined) updateData.district_ar = payload.districtAr;
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
    data: mapListing(data[0] as Row, references.categories, references.governorates),
  };
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
    .in("status", ["draft", "rejected"])
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

  const paths = ((images ?? []) as Row[])
    .map((row) => rowString(row, "storage_path"))
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    const storageResult = await clientResult.data.storage.from(listingImagesBucket).remove(paths);

    if (storageResult.error) {
      return { ok: false, error: mapStorageError(storageResult.error) };
    }
  }

  const { error } = await clientResult.data
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"]);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
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

  const title = payload.title.trim();
  const description = payload.description.trim();
  const districtAr = payload.districtAr?.trim() || null;
  const contactName = payload.contactName?.trim() || null;

  if (!payload.categoryId.trim() || !payload.governorateId.trim() || title.length < 4) {
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

  const insertPayload = {
    owner_id: userId,
    category_id: payload.categoryId,
    governorate_id: payload.governorateId,
    title,
    description,
    price: payload.price,
    price_type: payload.priceType,
    listing_condition: payload.condition,
    status: "pending_review",
    district_ar: districtAr,
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

  const { data: existingListing, error: existingListingError } = await clientResult.data
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", listing.id)
    .eq("owner_id", userId)
    .in("status", ["draft", "pending_review", "rejected"])
    .maybeSingle();

  if (existingListingError) return { ok: false, error: mapError(existingListingError) };
  if (!existingListing) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل صور هذا الإعلان." },
    };
  }

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

  if (
    existing.status !== "draft" &&
    existing.status !== "pending_review" &&
    existing.status !== "rejected"
  ) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل صور إعلان بعد اعتماده." },
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

  const storagePath = rowNullableString(storedImage as Row, "storage_path");
  if (storagePath) {
    const storageResult = await clientResult.data.storage
      .from(listingImagesBucket)
      .remove([storagePath]);
    if (storageResult.error) return { ok: false, error: mapStorageError(storageResult.error) };
  }

  const { error } = await clientResult.data
    .from("listing_images")
    .delete()
    .eq("id", image.id)
    .eq("listing_id", listingId);
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function startListingConversation(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<string>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لبدء محادثة." },
    };
  }

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان لبدء المحادثة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_start_listing_conversation", {
    p_listing_id: listingId,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: typeof data === "string" ? data : String(data) };
}

export async function fetchMyConversations(
  userId: string | null,
): Promise<ClassifiedsResult<Conversation[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض المحادثات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_fetch_my_conversations");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapConversation) };
}

export async function fetchConversationMessages(
  userId: string | null,
  conversationId: string,
): Promise<ClassifiedsResult<ConversationMessage[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض الرسائل." },
    };
  }

  if (!conversationId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المحادثة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapMessage) };
}

export async function sendConversationMessage(
  userId: string | null,
  conversationId: string,
  body: string,
): Promise<ClassifiedsResult<ConversationMessage>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال رسالة." },
    };
  }

  const cleanBody = body.trim();
  if (!conversationId.trim() || cleanBody.length < 1 || cleanBody.length > 2000) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب رسالة بين 1 و2000 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      sender_user_id: userId,
      body: cleanBody,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapMessage(data as Row) };
}

export async function markConversationRead(
  userId: string | null,
  conversationId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث المحادثة." },
    };
  }

  if (!conversationId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المحادثة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_mark_conversation_read", {
    p_conversation_id: conversationId,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function searchPublicSellers(
  query: string,
  limit = 8,
): Promise<ClassifiedsResult<PublicSellerSearchResult[]>> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return { ok: true, data: [] };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("search_public_sellers", {
    p_query: cleanQuery,
    p_limit: limit,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapPublicSellerSearchResult) };
}

export async function createMessageReport(
  payload: CreateMessageReportPayload,
): Promise<ClassifiedsResult<MessageReport>> {
  if (!payload.reporterUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول للإبلاغ عن رسالة." },
    };
  }

  const reason = payload.reason.trim();
  const details = cleanOptionalText(payload.details, 1000);
  if (!payload.messageId.trim() || !payload.conversationId.trim() || reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر سبباً واضحاً للبلاغ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("message_reports")
    .insert({
      message_id: payload.messageId,
      conversation_id: payload.conversationId,
      reporter_user_id: payload.reporterUserId,
      reported_user_id: payload.reporterUserId,
      reason,
      details,
      status: "new",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapMessageReport(data as Row) };
}

export async function blockConversationParticipant(
  payload: BlockConversationPayload,
): Promise<ClassifiedsResult<null>> {
  if (!payload.blockerUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحظر مستخدم." },
    };
  }

  if (
    !payload.conversationId.trim() ||
    !payload.blockedUserId.trim() ||
    payload.blockedUserId === payload.blockerUserId
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد المستخدم المطلوب حظره." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.from("user_blocks").insert({
    conversation_id: payload.conversationId,
    blocker_user_id: payload.blockerUserId,
    blocked_user_id: payload.blockedUserId,
    reason: cleanOptionalText(payload.reason, 300),
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function createSellerVerificationRequest(
  payload: CreateSellerVerificationRequestPayload,
): Promise<ClassifiedsResult<SellerVerificationRequest>> {
  if (!payload.userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لطلب التوثيق." },
    };
  }

  const legalName = payload.legalName.trim();
  if (legalName.length < 3 || legalName.length > 120) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب الاسم القانوني بين 3 و120 حرفاً." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .insert({
      user_id: payload.userId,
      request_type: payload.requestType,
      legal_name: legalName,
      business_name: cleanOptionalText(payload.businessName, 120),
      document_type: cleanOptionalText(payload.documentType, 80),
      status: "pending_review",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapVerificationRequest(data as Row) };
}

export async function fetchMyVerificationRequests(
  userId: string | null,
): Promise<ClassifiedsResult<SellerVerificationRequest[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض طلبات التوثيق." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapVerificationRequest) };
}

export async function adminFetchVerificationRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<SellerVerificationRequest[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التوثيق متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapVerificationRequest) };
}

export async function adminModerateVerificationRequest(
  canUseAdminAccess: boolean,
  payload: ModerateSellerVerificationRequestPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التوثيق متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.requestId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد طلب التوثيق." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("seller_verification_requests")
    .update({
      status: payload.status,
      admin_note: cleanOptionalText(payload.adminNote, 1000),
    })
    .eq("id", payload.requestId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function createListingPromotionRequest(
  payload: CreateListingPromotionRequestPayload,
): Promise<ClassifiedsResult<ListingPromotionRequest>> {
  if (!payload.requesterUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لطلب الترويج." },
    };
  }

  if (!payload.listingId.trim() || payload.requestedDays < 1 || payload.requestedDays > 90) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر إعلاناً معتمداً ومدة بين 1 و90 يوماً." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_promotion_requests")
    .insert({
      listing_id: payload.listingId,
      requester_user_id: payload.requesterUserId,
      promotion_type: payload.promotionType,
      requested_days: payload.requestedDays,
      payment_method: cleanOptionalText(payload.paymentMethod, 80),
      payment_reference: cleanOptionalText(payload.paymentReference, 160),
      proof_path: cleanOptionalText(payload.proofPath, 500),
      status: "pending_review",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapPromotionRequest(data as Row) };
}

export async function uploadPromotionReceipt({
  userId,
  requestId,
  file,
}: PromotionReceiptUploadPayload): Promise<ClassifiedsResult<string>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لرفع إيصال الترويج." },
    };
  }

  if (!requestId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد طلب الترويج." },
    };
  }

  if (!allowedReceiptTypes.includes(file.type)) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "الصيغ المسموحة للإيصال: JPG أو PNG أو WebP أو PDF.",
      },
    };
  }

  if (file.size > maxReceiptSizeBytes) {
    return {
      ok: false,
      error: { code: "validation_error", message: "حجم الإيصال يجب ألا يتجاوز 8MB." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: request, error: requestError } = await clientResult.data
    .from("listing_promotion_requests")
    .select("id, requester_user_id, status")
    .eq("id", requestId)
    .eq("requester_user_id", userId)
    .eq("status", "pending_review")
    .maybeSingle();

  if (requestError) return { ok: false, error: mapError(requestError) };
  if (!request) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "يمكن رفع الإيصال فقط لطلب ترويج قيد المراجعة تملكه.",
      },
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const safeExtension =
    extension && ["jpg", "jpeg", "png", "webp", "pdf"].includes(extension) ? extension : "jpg";
  const storagePath = `${userId}/${requestId}/${crypto.randomUUID()}.${safeExtension}`;

  const uploadResult = await clientResult.data.storage
    .from(promotionReceiptsBucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const attachResult = await clientResult.data.rpc("rawaj_attach_promotion_receipt", {
    request_id: requestId,
    receipt_path: storagePath,
  });

  if (attachResult.error) {
    await clientResult.data.storage.from(promotionReceiptsBucket).remove([storagePath]);
    return { ok: false, error: mapError(attachResult.error) };
  }

  return { ok: true, data: storagePath };
}

export async function createPromotionReceiptSignedUrl(
  proofPath: string | null,
): Promise<ClassifiedsResult<string | null>> {
  if (!proofPath?.trim()) return { ok: true, data: null };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.storage
    .from(promotionReceiptsBucket)
    .createSignedUrl(proofPath, signedImageUrlExpiresInSeconds);

  if (error) return { ok: false, error: mapStorageError(error) };
  return { ok: true, data: data.signedUrl };
}

export async function fetchMyPromotionRequests(
  userId: string | null,
): Promise<ClassifiedsResult<ListingPromotionRequest[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض طلبات الترويج." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_promotion_requests")
    .select("*, listings(title)")
    .eq("requester_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) =>
      mapPromotionRequest({
        ...row,
        listing_title: rowRecord(row, "listings").title,
      }),
    ),
  };
}

export async function adminFetchPromotionRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<ListingPromotionRequest[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة الترويج متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_promotion_requests")
    .select("*, listings(title)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) =>
      mapPromotionRequest({
        ...row,
        listing_title: rowRecord(row, "listings").title,
      }),
    ),
  };
}

export async function adminModeratePromotionRequest(
  canUseAdminAccess: boolean,
  payload: ModerateListingPromotionRequestPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة الترويج متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.requestId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد طلب الترويج." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("listing_promotion_requests")
    .update({
      status: payload.status,
      admin_note: cleanOptionalText(payload.adminNote, 1000),
    })
    .eq("id", payload.requestId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function adminFetchMessageReports(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<MessageReport[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة بلاغات الرسائل متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_fetch_message_reports_for_admin");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapMessageReport) };
}

export async function adminModerateMessageReport(
  canUseAdminAccess: boolean,
  payload: ModerateMessageReportPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة بلاغات الرسائل متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  if (!payload.reportId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد بلاغ الرسالة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("message_reports")
    .update({
      status: payload.status,
      admin_note: cleanOptionalText(payload.adminNote, 1000),
    })
    .eq("id", payload.reportId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function uploadProfileMedia({
  userId,
  kind,
  file,
  oldPath,
}: ProfileMediaUploadPayload): Promise<ClassifiedsResult<string>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث صورة الحساب." },
    };
  }

  if (!allowedImageTypes.includes(file.type)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "الصيغ المسموحة للصور: JPG أو PNG أو WebP." },
    };
  }

  if (file.size > maxProfileImageSizeBytes) {
    return {
      ok: false,
      error: { code: "validation_error", message: "حجم صورة الملف يجب ألا يتجاوز 3MB." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const extension = file.name.split(".").pop()?.toLowerCase();
  const safeExtension =
    extension && ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  const storagePath = `${userId}/${kind}/${crypto.randomUUID()}.${safeExtension}`;

  const uploadResult = await clientResult.data.storage
    .from(profileMediaBucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const publicUrl = publicProfileMediaUrl(clientResult.data, storagePath);
  const updatePayload =
    kind === "avatar"
      ? { avatar_path: storagePath, avatar_url: publicUrl }
      : { cover_path: storagePath, cover_url: publicUrl };

  const { error } = await clientResult.data.from("profiles").update(updatePayload).eq("id", userId);
  if (error) {
    await clientResult.data.storage.from(profileMediaBucket).remove([storagePath]);
    return { ok: false, error: mapError(error) };
  }

  if (oldPath && oldPath.startsWith(`${userId}/${kind}/`)) {
    await clientResult.data.storage.from(profileMediaBucket).remove([oldPath]);
  }

  return { ok: true, data: publicUrl ?? "" };
}

export async function removeProfileMedia(
  userId: string | null,
  kind: ProfileMediaKind,
  path: string | null | undefined,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث صورة الحساب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (path && path.startsWith(`${userId}/${kind}/`)) {
    const storageResult = await clientResult.data.storage.from(profileMediaBucket).remove([path]);
    if (storageResult.error) return { ok: false, error: mapStorageError(storageResult.error) };
  }

  const updatePayload =
    kind === "avatar"
      ? { avatar_path: null, avatar_url: null }
      : { cover_path: null, cover_url: null };

  const { error } = await clientResult.data.from("profiles").update(updatePayload).eq("id", userId);
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function createSellerReview(
  payload: CreateSellerReviewPayload,
): Promise<ClassifiedsResult<SellerReview>> {
  if (!payload.reviewerUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال تقييم." },
    };
  }

  const sellerUserId = payload.sellerUserId.trim();
  const reviewerUserId = payload.reviewerUserId.trim();
  const comment = payload.comment.trim();

  if (!sellerUserId || sellerUserId === reviewerUserId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "لا يمكن للمستخدم تقييم نفسه." },
    };
  }

  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر تقييما من 1 إلى 5." },
    };
  }

  if (comment.length < 10 || comment.length > 1200) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب مراجعة بين 10 و1200 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_reviews")
    .insert({
      seller_user_id: sellerUserId,
      reviewer_user_id: reviewerUserId,
      related_listing_id: payload.relatedListingId?.trim() || null,
      rating: payload.rating,
      comment,
      status: "pending_review",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapReview(data as Row) };
}

export async function adminFetchSellerReviews(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<SellerReview[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التقييمات متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_reviews")
    .select(
      "id,seller_user_id,reviewer_user_id,related_listing_id,rating,comment,status,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapReview) };
}

export async function adminModerateSellerReview(
  canUseAdminAccess: boolean,
  payload: ModerateSellerReviewPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التقييمات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.reviewId.trim() || !payload.reviewerId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد التقييم أو المراجع." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("seller_reviews")
    .update({
      status: payload.status,
      admin_note: payload.adminNote?.trim() || null,
      reviewed_by: payload.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", payload.reviewId)
    .eq("status", "pending_review");

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

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const { data: listing, error: listingError } = await clientResult.data
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("status", "approved")
    .maybeSingle();

  if (listingError) return { ok: false, error: mapError(listingError) };
  if (!listing) {
    return {
      ok: false,
      error: { code: "not_found", message: "لا يمكن حفظ إعلان غير متاح." },
    };
  }

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

  const reportReason = reason.trim();
  if (!listingId.trim() || reportReason.length < 4) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبب البلاغ وحدد الإعلان." },
    };
  }

  const { data: listing, error: listingError } = await clientResult.data
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("status", "approved")
    .maybeSingle();

  if (listingError) return { ok: false, error: mapError(listingError) };
  if (!listing) {
    return {
      ok: false,
      error: { code: "not_found", message: "لا يمكن إرسال بلاغ على إعلان غير متاح." },
    };
  }

  const { data: existingReport, error: existingReportError } = await clientResult.data
    .from("listing_reports")
    .select("*")
    .eq("listing_id", listingId)
    .eq("reporter_id", userId)
    .in("status", ["new", "under_review", "in_review"])
    .maybeSingle();

  if (existingReportError) return { ok: false, error: mapError(existingReportError) };
  if (existingReport) return { ok: true, data: mapReport(existingReport as Row) };

  const { data, error } = await clientResult.data
    .from("listing_reports")
    .insert({
      listing_id: listingId,
      reporter_id: userId,
      report_type: reportType,
      reason: reportReason,
      status: "new",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapReport(data as Row) };
}

export async function adminFetchPendingListings(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "هذه البيانات متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("status", "pending_review")
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
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<ListingReport[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة البلاغات متاحة لحساب إداري مخول فقط." },
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
  canUseAdminAccess: boolean,
  payload: ModerateReportPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة البلاغات متاحة لحساب إداري مخول فقط." },
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

export async function createSupportRequest(
  userId: string | null,
  payload: CreateSupportRequestPayload,
): Promise<ClassifiedsResult<SupportRequest>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال طلب دعم." },
    };
  }

  const subject = payload.subject.trim();
  const message = payload.message.trim();

  if (subject.length < 4 || subject.length > 160) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل عنوانا بين 4 و160 حرفا." },
    };
  }

  if (message.length < 10 || message.length > 3000) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل رسالة بين 10 و3000 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("support_requests")
    .insert({
      user_id: userId,
      type: payload.type,
      subject,
      message,
      related_listing_id: payload.relatedListingId?.trim() || null,
      related_report_id: payload.relatedReportId?.trim() || null,
      status: "new",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapSupportRequest(data as Row) };
}

export async function fetchMySupportRequests(
  userId: string | null,
): Promise<ClassifiedsResult<SupportRequest[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض طلبات الدعم." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("support_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapSupportRequest) };
}

export async function adminFetchSupportRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<SupportRequest[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "طلبات الدعم متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("support_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapSupportRequest) };
}

export async function adminModerateSupportRequest(
  canUseAdminAccess: boolean,
  payload: ModerateSupportRequestPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "تحديث طلبات الدعم متاح لحساب إداري مخول فقط." },
    };
  }

  if (!payload.requestId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد طلب الدعم." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("support_requests")
    .update({
      status: payload.status,
      admin_note: payload.adminNote?.trim() || null,
    })
    .eq("id", payload.requestId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function adminModerateListing(
  canUseAdminAccess: boolean,
  payload: ModerateListingPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة الإعلانات متاحة لحساب إداري مخول فقط." },
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

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("id, owner_id, title, status")
    .eq("id", payload.listingId)
    .eq("status", "pending_review")
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان ليس ضمن طابور المراجعة." },
    };
  }

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
    .eq("id", payload.listingId)
    .eq("status", "pending_review");
  if (error) return { ok: false, error: mapError(error) };

  const notificationResult = await createListingModerationNotification(
    clientResult.data,
    existing as Row,
    payload,
  );
  if (!notificationResult.ok) {
    console.warn("Listing moderation succeeded but notification creation failed.", {
      listingId: payload.listingId,
      error: notificationResult.error.message,
    });
  }

  return { ok: true, data: null };
}

async function createListingModerationNotification(
  client: SupabaseClient,
  listing: Row,
  payload: ModerateListingPayload,
): Promise<ClassifiedsResult<null>> {
  if (payload.status !== "approved" && payload.status !== "rejected") {
    return { ok: true, data: null };
  }

  const ownerId = rowString(listing, "owner_id");
  if (!ownerId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد صاحب الإعلان لإرسال الإشعار." },
    };
  }

  const listingTitle = rowString(listing, "title", "إعلانك");
  const rejected = payload.status === "rejected";
  const rejectionReason = payload.rejectionReason?.trim();

  const { error } = await client.rpc("rawaj_create_notification", {
    recipient_id: ownerId,
    notification_type: rejected ? "listing.rejected" : "listing.approved",
    title_ar: rejected ? "تم رفض إعلانك" : "تمت الموافقة على إعلانك",
    body_ar: rejected
      ? rejectionReason
        ? `تم رفض إعلان "${listingTitle}". السبب: ${rejectionReason}`
        : `تم رفض إعلان "${listingTitle}".`
      : `تمت الموافقة على إعلان "${listingTitle}" وأصبح جاهزاً للظهور.`,
    target_type: "listing",
    target_id: payload.listingId,
    metadata: {
      listing_id: payload.listingId,
      status: payload.status,
    },
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function fetchMyNotifications(
  userId: string | null,
): Promise<ClassifiedsResult<NotificationItem[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض الإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(mapNotification) };
}

export async function fetchUnreadNotificationsCount(
  userId: string | null,
): Promise<ClassifiedsResult<number>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض الإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { count, error } = await clientResult.data
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: count ?? 0 };
}

export async function markNotificationRead(
  userId: string | null,
  notificationId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث الإشعارات." },
    };
  }

  if (!notificationId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإشعار." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .is("read_at", null);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function markAllNotificationsRead(
  userId: string | null,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث الإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);

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

function mapSupportRequest(row: Row): SupportRequest {
  return {
    id: rowString(row, "id"),
    userId: rowString(row, "user_id"),
    type: rowString(row, "type", "other") as SupportRequest["type"],
    status: rowString(row, "status", "new") as SupportRequest["status"],
    subject: rowString(row, "subject"),
    message: rowString(row, "message"),
    relatedListingId: rowNullableString(row, "related_listing_id"),
    relatedReportId: rowNullableString(row, "related_report_id"),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapNotification(row: Row): NotificationItem {
  return {
    id: rowString(row, "id"),
    recipientId: rowString(row, "recipient_id"),
    actorId: rowNullableString(row, "actor_id"),
    type: rowString(row, "type"),
    titleAr: rowString(row, "title_ar"),
    bodyAr: rowNullableString(row, "body_ar"),
    targetType: rowNullableString(row, "target_type"),
    targetId: rowNullableString(row, "target_id"),
    metadata: rowRecord(row, "metadata"),
    readAt: rowNullableString(row, "read_at"),
    createdAt: rowString(row, "created_at"),
  };
}
