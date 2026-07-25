import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";

export type ListingDataQualityStatus =
  "open" | "needs_review" | "seller_action" | "dismissed" | "resolved";

export type ListingDataQualityIssueType =
  | "taxonomy"
  | "required_field"
  | "unexpected_field"
  | "invalid_value"
  | "legacy_payload"
  | "specialized_reference";

export type ListingDataQualitySeverity = "info" | "warning" | "error" | "blocking";

export type ListingDataQualityDecision =
  "needs_review" | "seller_action" | "dismiss" | "resolve" | "reopen";

export interface ListingDataQualityIssue {
  id: string;
  listingId: string;
  listingTitle: string;
  listingStatus: string;
  ownerId: string;
  categoryId: string;
  categoryNameAr: string;
  categoryNameEn: string | null;
  subcategoryId: string | null;
  subcategoryNameAr: string | null;
  subcategoryNameEn: string | null;
  taxonomyVersionId: string;
  taxonomyVersionNumber: number;
  taxonomyVersionStatus: string;
  taxonomyNodeId: string | null;
  taxonomyNameAr: string | null;
  taxonomyNameEn: string | null;
  fieldKey: string | null;
  fieldLabelAr: string | null;
  fieldLabelEn: string | null;
  issueType: ListingDataQualityIssueType;
  issueCode: string;
  severity: ListingDataQualitySeverity;
  status: ListingDataQualityStatus;
  evidence: Record<string, unknown>;
  detectedAt: string;
  lastSeenAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingDataQualityPage {
  total: number;
  limit: number;
  offset: number;
  items: ListingDataQualityIssue[];
}

export interface ListingDataQualityRefreshResult {
  versionId: string;
  versionStatus: string;
  scannedCount: number;
  limit: number;
  offset: number;
  openIssueCount: number;
  blockingIssueCount: number;
}

function fromApi<T>(
  result: Awaited<ReturnType<typeof cloudflareApiRequest<T>>>,
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

export async function fetchListingDataQualityIssues(
  userId: string | null,
  options: {
    status?: ListingDataQualityStatus | null;
    issueType?: ListingDataQualityIssueType | null;
    categoryId?: string | null;
    severity?: ListingDataQualitySeverity | null;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ClassifiedsResult<ListingDataQualityPage>> {
  if (!userId) return authenticationFailure();
  const params = new URLSearchParams({
    limit: String(clampInteger(options.limit, 1, 200, 50)),
    offset: String(clampInteger(options.offset, 0, 1_000_000, 0)),
  });
  if (options.status) params.set("status", options.status);
  if (options.issueType) params.set("issueType", options.issueType);
  if (options.categoryId?.trim()) params.set("categoryId", options.categoryId.trim());
  if (options.severity) params.set("severity", options.severity);
  return fromApi(
    await cloudflareApiRequest<ListingDataQualityPage>(
      `/v1/admin/data-quality/issues?${params.toString()}`,
    ),
  );
}

export async function refreshListingDataQualityIssues(
  userId: string | null,
  input: { versionId: string; limit?: number; offset?: number },
): Promise<ClassifiedsResult<ListingDataQualityRefreshResult>> {
  if (!userId) return authenticationFailure();
  if (!input.versionId.trim()) return validationFailure();
  return fromApi(
    await cloudflareApiRequest<ListingDataQualityRefreshResult>("/v1/admin/data-quality/refresh", {
      method: "POST",
      body: { versionId: input.versionId.trim(), limit: input.limit, offset: input.offset },
    }),
  );
}

export async function reviewListingDataQualityIssue(
  userId: string | null,
  input: {
    issueId: string;
    decision: ListingDataQualityDecision;
    note?: string | null;
    expectedUpdatedAt: string;
  },
): Promise<ClassifiedsResult<Record<string, unknown>>> {
  if (!userId) return authenticationFailure();
  if (!input.issueId.trim() || !input.expectedUpdatedAt.trim()) return validationFailure();
  return fromApi(
    await cloudflareApiRequest<Record<string, unknown>>(
      `/v1/admin/data-quality/issues/${encodeURIComponent(input.issueId.trim())}/review`,
      { method: "PATCH", body: input },
    ),
  );
}

function authenticationFailure<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "auth_required", message: "يجب تسجيل الدخول لاستخدام مركز جودة البيانات." },
  };
}
function validationFailure<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "validation_error", message: "بيانات عملية جودة الإعلانات غير مكتملة." },
  };
}
function clampInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value as number)));
}
