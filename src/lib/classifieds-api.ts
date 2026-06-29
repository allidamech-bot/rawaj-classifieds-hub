import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthUnavailableReason, supabase } from "@/lib/supabase";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedsResult,
  CreateListingPayload,
  Favorite,
  ListingFilters,
  ListingReport,
  ListingReportType,
  ModerateListingPayload,
  SavedSearch,
} from "@/lib/classifieds-types";
import type { PlaceholderType, PriceType } from "@/types";

type Row = Record<string, unknown>;

const setupRequiredMessage =
  "جداول الإعلانات الحقيقية غير جاهزة بعد. يجب تنفيذ SQL الخاص بأساس الإعلانات يدوياً من Supabase Dashboard.";

function getClient(): ClassifiedsResult<SupabaseClient> {
  if (!supabase) {
    return {
      ok: false,
      error: {
        code: "supabase_unconfigured",
        message: getSupabaseAuthUnavailableReason() ?? "Supabase غير مهيأ حالياً.",
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

  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  };
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
    .eq("status", "approved")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان غير متاح أو لم تتم الموافقة عليه بعد." },
    };
  }

  return {
    ok: true,
    data: mapListing(data as Row, references.categories, references.governorates),
  };
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
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  };
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
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) => ({
      userId: rowString(row, "user_id"),
      listingId: rowString(row, "listing_id"),
      createdAt: rowString(row, "created_at"),
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
    status: rowString(row, "status", "new") as ListingReport["status"],
    assignedTo: rowNullableString(row, "assigned_to"),
    adminNote: rowNullableString(row, "admin_note"),
    resolvedAt: rowNullableString(row, "resolved_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
