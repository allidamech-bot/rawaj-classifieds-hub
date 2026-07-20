import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingReport,
  ListingReportType,
} from "@/lib/classifieds-types";
import {
  accountSessionStillMatches,
  resolveAuthenticatedAccountId,
} from "@/lib/api/account-identity";
import { mapModerationError } from "@/lib/api/moderation-errors";
import { getClient, mapError, rowNullableString, rowRecord, rowString } from "@/lib/api/shared";
import { isListingReportType, normalizeModerationText } from "@/lib/moderation-contract";

interface ModerateReportPayload {
  reportId: string;
  status: ListingReport["status"];
  adminNote?: string | null;
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
  listingId: string,
  reportType: ListingReportType,
  reason: string,
): Promise<ClassifiedsResult<null>> {
  const cleanListingId = listingId.trim();
  const reportReason = normalizeModerationText(reason, 500);
  if (
    !cleanListingId ||
    !isListingReportType(reportType) ||
    reportReason.length < 4 ||
    (reportType === "other" && reportReason.length < 10)
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر سببًا صالحًا وأضف وصفًا واضحًا للبلاغ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const actor = await resolveAuthenticatedAccountId(client, "listing_report_auth");
  if (!actor.ok) return actor;
  const { error } = await client.rpc("rawaj_create_listing_report_v2", {
    p_listing_id: cleanListingId,
    p_report_type: reportType,
    p_reason: reportReason,
  });
  if (error) {
    return {
      ok: false,
      error: mapModerationError(error, "listing_report_create", "تعذر إرسال البلاغ الآن."),
    };
  }
  const current = await accountSessionStillMatches(client, actor.data, "listing_report_stale");
  if (!current.ok) return current;
  return { ok: true, data: null };
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

export async function adminFetchReports(): Promise<ClassifiedsResult<ListingReport[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_fetch_listing_reports_for_admin", {
    p_limit: 200,
  });
  if (error) {
    return {
      ok: false,
      error: mapModerationError(error, "listing_report_admin_queue", "تعذر تحميل البلاغات."),
    };
  }
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapReport) };
}

export async function adminModerateReport(
  payload: ModerateReportPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!payload.reportId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البلاغ أو نسخته الحالية." },
    };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_listing_report_v2", {
    p_report_id: payload.reportId.trim(),
    p_status: toDbReportStatus(payload.status),
    p_admin_note: normalizeModerationText(payload.adminNote ?? "", 1000) || null,
    p_expected_updated_at: payload.expectedUpdatedAt,
  });
  if (error) {
    return {
      ok: false,
      error: mapModerationError(error, "listing_report_moderate", "تعذر تحديث البلاغ."),
    };
  }
  return { ok: true, data: null };
}

function mapListing(
  row: Record<string, unknown>,
  categories: import("@/lib/classifieds-types").ClassifiedCategory[] = [],
  governorates: import("@/lib/classifieds-types").ClassifiedGovernorate[] = [],
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
    price: rowNullableString(row, "price") ? Number(rowNullableString(row, "price")) : null,
    currency: "SYP",
    priceDenomination: rowString(
      row,
      "price_denomination",
      "unclassified",
    ) as ClassifiedListing["priceDenomination"],
    priceNewSypNormalized: rowNullableString(row, "price_new_syp_normalized")
      ? Number(rowNullableString(row, "price_new_syp_normalized"))
      : null,
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
    listingId: rowNullableString(row, "listing_id"),
    listingTitleSnapshot: rowNullableString(row, "listing_title_snapshot"),
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
