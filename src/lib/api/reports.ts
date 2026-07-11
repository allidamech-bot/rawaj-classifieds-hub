import type { ClassifiedsResult, ListingReport, ListingReportType } from "@/lib/classifieds-types";
import { getClient, mapError, rowNullableString, rowRecord, rowString } from "@/lib/api/shared";

interface ModerateReportPayload {
  reportId: string;
  status: ListingReport["status"];
  assignedTo?: string | null;
  adminNote?: string | null;
  resolvedAt?: string | null;
}

export function fromDbReportStatus(status: string): ListingReport["status"] {
  if (status === "in_review") return "under_review";
  if (status === "dismissed") return "rejected";
  if (["new", "under_review", "resolved", "rejected"].includes(status)) {
    return status as ListingReport["status"];
  }
  return "new";
}

export function toDbReportStatus(status: ListingReport["status"]): string {
  if (status === "under_review") return "in_review";
  if (status === "rejected") return "dismissed";
  return status;
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
  if (existingReport)
    return { ok: true, data: mapReport(existingReport as Record<string, unknown>) };

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
  return { ok: true, data: mapReport(data as Record<string, unknown>) };
}

export async function adminFetchPendingListings(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<import("@/lib/classifieds-types").ClassifiedListing[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "هذه البيانات متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { readReferences } = await import("@/lib/api/references");
  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  let { data, error } = await clientResult.data.rpc("rawaj_review_queue_pending");

  if (error && mapError(error).code === "schema_missing") {
    const fallback = await clientResult.data
      .from("listings")
      .select("*")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) return { ok: false, error: mapError(error, "admin_review_queue") };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) =>
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
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapReport) };
}

export async function adminModerateReport(
  canUseAdminAccess: boolean,
  payload: ModerateReportPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إدارة البلاغات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.reportId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البلاغ أو نسخته الحالية." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const dbStatus = toDbReportStatus(payload.status);
  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_listing_report", {
    p_report_id: payload.reportId,
    p_status: dbStatus,
    p_assigned_to: payload.assignedTo ?? null,
    p_admin_note: payload.adminNote ?? null,
    p_resolved_at:
      payload.resolvedAt ??
      (payload.status === "resolved" || payload.status === "rejected"
        ? new Date().toISOString()
        : null),
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    if (error.message?.includes("stale_listing_report")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر البلاغ منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  return { ok: true, data: null };
}

function mapListing(
  row: Record<string, unknown>,
  categories: import("@/lib/classifieds-types").ClassifiedCategory[] = [],
  governorates: import("@/lib/classifieds-types").ClassifiedGovernorate[] = [],
): import("@/lib/classifieds-types").ClassifiedListing {
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
    price: rowNullableString(row, "price") ? Number(rowNullableString(row, "price")) : null,
    currency: "SYP",
    priceType: rowString(row, "price_type", "fixed") as import("@/types").PriceType,
    condition: rowString(
      row,
      "listing_condition",
      "not_applicable",
    ) as import("@/lib/classifieds-types").ListingCondition,
    status: rowString(
      row,
      "status",
      "pending_review",
    ) as import("@/lib/classifieds-types").ListingStatus,
    districtAr: rowNullableString(row, "district_ar"),
    contactName: rowNullableString(row, "contact_name"),
    contactOptions: rowRecord(row, "contact_options") as Record<string, boolean>,
    details: rowRecord(row, "details"),
    isFeatured: rowString(row, "is_featured") === "true",
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

function mapReport(row: Record<string, unknown>): ListingReport {
  return {
    id: rowString(row, "id"),
    listingId: rowString(row, "listing_id"),
    reporterId: rowString(row, "reporter_id"),
    reportType: rowString(row, "report_type", "other") as ListingReportType,
    reason: rowString(row, "reason"),
    status: fromDbReportStatus(rowString(row, "status", "new")),
    assignedTo: rowNullableString(row, "assigned_to"),
    adminNote: rowNullableString(row, "admin_note"),
    resolvedAt: rowNullableString(row, "resolved_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
