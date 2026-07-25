import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  ListingReport,
  ListingReportType,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isListingReportType, normalizeModerationText } from "@/lib/moderation-contract";

interface ModerateReportPayload {
  reportId: string;
  status: ListingReport["status"];
  adminNote?: string | null;
}

export function fromDbReportStatus(status: string): ListingReport["status"] {
  if (status === "reviewing" || status === "in_review") return "under_review";
  if (status === "dismissed") return "rejected";
  if (["new", "under_review", "resolved", "rejected"].includes(status)) {
    return status as ListingReport["status"];
  }
  return "new";
}

export function toDbReportStatus(status: ListingReport["status"]): string {
  if (status === "under_review") return "reviewing";
  if (status === "rejected") return "dismissed";
  if (status === "new") return "open";
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
  const result = await cloudflareApiRequest<{ id: string; duplicate: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/reports`,
    { method: "POST", body: { reportType, reason: reportReason } },
  );
  return result.ok
    ? { ok: true, data: null }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

export async function adminFetchPendingListings(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  if (!canUseAdminAccess) return denied("هذه البيانات متاحة لحساب إداري مخول فقط.");
  const result = await cloudflareApiRequest<Array<Record<string, unknown>>>(
    "/v1/admin/listings/pending",
  );
  return result.ok
    ? { ok: true, data: result.data.map(mapAdminListing) }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

export async function adminFetchReports(): Promise<ClassifiedsResult<ListingReport[]>> {
  return fromApi(
    await cloudflareApiRequest<ListingReport[]>("/v1/admin/listing-reports?limit=200"),
  );
}

export async function adminModerateReport(
  payload: ModerateReportPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  const reportId = payload.reportId.trim();
  if (!reportId || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البلاغ أو نسخته الحالية." },
    };
  }
  const result = await cloudflareApiRequest<{ success: boolean; updatedAt: string }>(
    `/v1/admin/listing-reports/${encodeURIComponent(reportId)}`,
    {
      method: "PATCH",
      body: {
        status: payload.status,
        adminNote: normalizeModerationText(payload.adminNote ?? "", 1000) || null,
        expectedUpdatedAt: payload.expectedUpdatedAt,
      },
    },
  );
  return result.ok
    ? { ok: true, data: null }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

function mapAdminListing(row: Record<string, unknown>): ClassifiedListing {
  return {
    id: stringValue(row.id),
    ownerId: stringValue(row.ownerId ?? row.owner_id),
    categoryId: stringValue(row.categoryId ?? row.category_id),
    subcategoryId: nullableString(row.subcategoryId ?? row.subcategory_id),
    governorateId: stringValue(row.governorateId ?? row.governorate_id),
    title: stringValue(row.title),
    description: stringValue(row.description),
    price: nullableNumber(row.price),
    currency: "SYP",
    priceType: stringValue(
      row.priceType ?? row.price_type,
      "fixed",
    ) as ClassifiedListing["priceType"],
    condition: stringValue(
      row.condition ?? row.listing_condition,
      "not_applicable",
    ) as ClassifiedListing["condition"],
    status: stringValue(row.status, "pending_review") as ClassifiedListing["status"],
    districtAr: nullableString(row.districtAr ?? row.district_ar),
    contactName: nullableString(row.contactName ?? row.contact_name),
    contactOptions: booleanObjectValue(row.contactOptions ?? row.contact_options),
    details: objectValue(row.details),
    isFeatured: Boolean(row.isFeatured ?? row.is_featured),
    featuredUntil: nullableString(row.featuredUntil ?? row.featured_until),
    reviewedBy: nullableString(row.reviewedBy ?? row.reviewed_by),
    reviewedAt: nullableString(row.reviewedAt ?? row.reviewed_at),
    rejectionReason: nullableString(row.rejectionReason ?? row.rejection_reason),
    publishedAt: nullableString(row.publishedAt ?? row.published_at),
    archivedAt: nullableString(row.archivedAt ?? row.archived_at),
    expiresAt: nullableString(row.expiresAt ?? row.expires_at),
    createdAt: stringValue(row.createdAt ?? row.created_at),
    updatedAt: stringValue(row.updatedAt ?? row.updated_at),
  };
}

function denied<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "permission_denied", message } };
}

function fromApi<T>(
  result: { ok: true; data: T } | { ok: false; error: string; code: string },
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function booleanObjectValue(value: unknown): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(objectValue(value)).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}
