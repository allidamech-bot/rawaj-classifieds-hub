import { getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedsError, ClassifiedsResult } from "@/lib/classifieds-types";

export type ListingDataQualityStatus =
  | "open"
  | "needs_review"
  | "seller_action"
  | "dismissed"
  | "resolved";

export type ListingDataQualityIssueType =
  | "taxonomy"
  | "required_field"
  | "unexpected_field"
  | "invalid_value"
  | "legacy_payload"
  | "specialized_reference";

export type ListingDataQualitySeverity = "info" | "warning" | "error" | "blocking";

export type ListingDataQualityDecision =
  | "needs_review"
  | "seller_action"
  | "dismiss"
  | "resolve"
  | "reopen";

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
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_admin_fetch_listing_data_quality_v1",
    {
      p_status: options.status ?? null,
      p_issue_type: options.issueType ?? null,
      p_category_id: cleanNullableText(options.categoryId),
      p_severity: options.severity ?? null,
      p_limit: clampInteger(options.limit, 1, 200, 50),
      p_offset: clampInteger(options.offset, 0, 1_000_000, 0),
    },
  );

  if (error) return rpcFailure(error, "listing_data_quality_fetch");
  return { ok: true, data: parsePage(data) };
}

export async function refreshListingDataQualityIssues(
  userId: string | null,
  input: { versionId: string; limit?: number; offset?: number },
): Promise<ClassifiedsResult<ListingDataQualityRefreshResult>> {
  if (!userId) return authenticationFailure();
  if (!input.versionId.trim()) return validationFailure();
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_owner_refresh_listing_data_quality_v1",
    {
      p_version_id: input.versionId.trim(),
      p_limit: clampInteger(input.limit, 1, 1000, 500),
      p_offset: clampInteger(input.offset, 0, 1_000_000, 0),
    },
  );

  if (error) return rpcFailure(error, "listing_data_quality_refresh");
  const payload = record(data);
  const versionId = text(payload.versionId);
  if (!versionId) return invalidPayloadFailure("listing_data_quality_refresh");

  return {
    ok: true,
    data: {
      versionId,
      versionStatus: text(payload.versionStatus),
      scannedCount: integer(payload.scannedCount),
      limit: integer(payload.limit),
      offset: integer(payload.offset),
      openIssueCount: integer(payload.openIssueCount),
      blockingIssueCount: integer(payload.blockingIssueCount),
    },
  };
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
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_admin_review_listing_data_quality_v1",
    {
      p_issue_id: input.issueId.trim(),
      p_decision: input.decision,
      p_note: cleanNullableText(input.note),
      p_expected_updated_at: input.expectedUpdatedAt.trim(),
    },
  );

  if (error) return rpcFailure(error, "listing_data_quality_review");
  return { ok: true, data: record(data) };
}

function parsePage(value: unknown): ListingDataQualityPage {
  const payload = record(value);
  return {
    total: integer(payload.total),
    limit: integer(payload.limit),
    offset: integer(payload.offset),
    items: array(payload.items).map(parseIssue).filter(isPresent),
  };
}

function parseIssue(value: unknown): ListingDataQualityIssue | null {
  const item = record(value);
  const id = text(item.id);
  const listingId = text(item.listingId);
  const issueType = parseIssueType(item.issueType);
  const severity = parseSeverity(item.severity);
  const status = parseStatus(item.status);
  if (!id || !listingId || !issueType || !severity || !status) return null;

  return {
    id,
    listingId,
    listingTitle: text(item.listingTitle),
    listingStatus: text(item.listingStatus),
    ownerId: text(item.ownerId),
    categoryId: text(item.categoryId),
    categoryNameAr: text(item.categoryNameAr),
    categoryNameEn: nullableText(item.categoryNameEn),
    subcategoryId: nullableText(item.subcategoryId),
    subcategoryNameAr: nullableText(item.subcategoryNameAr),
    subcategoryNameEn: nullableText(item.subcategoryNameEn),
    taxonomyVersionId: text(item.taxonomyVersionId),
    taxonomyVersionNumber: integer(item.taxonomyVersionNumber),
    taxonomyVersionStatus: text(item.taxonomyVersionStatus),
    taxonomyNodeId: nullableText(item.taxonomyNodeId),
    taxonomyNameAr: nullableText(item.taxonomyNameAr),
    taxonomyNameEn: nullableText(item.taxonomyNameEn),
    fieldKey: nullableText(item.fieldKey),
    fieldLabelAr: nullableText(item.fieldLabelAr),
    fieldLabelEn: nullableText(item.fieldLabelEn),
    issueType,
    issueCode: text(item.issueCode),
    severity,
    status,
    evidence: record(item.evidence),
    detectedAt: text(item.detectedAt),
    lastSeenAt: text(item.lastSeenAt),
    reviewedBy: nullableText(item.reviewedBy),
    reviewedAt: nullableText(item.reviewedAt),
    reviewNote: nullableText(item.reviewNote),
    resolvedAt: nullableText(item.resolvedAt),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  };
}

function rpcFailure<T>(
  error: { code?: string; message?: string; details?: string },
  operation: string,
): ClassifiedsResult<T> {
  const combined = `${error.message ?? ""} ${error.details ?? ""}`;
  if (combined.includes("stale_data_quality_review")) {
    const mapped: ClassifiedsError = {
      code: "status_mismatch",
      message: "تغيّرت نتيجة الفحص. حدّث مركز الجودة قبل إعادة المحاولة.",
      details: error.details ?? error.message,
      operation,
    };
    return { ok: false, error: mapped };
  }
  return { ok: false, error: mapError(error, operation) };
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

function invalidPayloadFailure<T>(operation: string): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "unknown",
      message: "أعاد مركز جودة البيانات استجابة غير صالحة.",
      operation,
    },
  };
}

function parseIssueType(value: unknown): ListingDataQualityIssueType | null {
  return oneOf(value, [
    "taxonomy",
    "required_field",
    "unexpected_field",
    "invalid_value",
    "legacy_payload",
    "specialized_reference",
  ] as const);
}

function parseSeverity(value: unknown): ListingDataQualitySeverity | null {
  return oneOf(value, ["info", "warning", "error", "blocking"] as const);
}

function parseStatus(value: unknown): ListingDataQualityStatus | null {
  return oneOf(value, ["open", "needs_review", "seller_action", "dismissed", "resolved"] as const);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function clampInteger(value: number | undefined, minimum: number, maximum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value as number)));
}

function cleanNullableText(value: string | null | undefined): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned || null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  const cleaned = text(value).trim();
  return cleaned || null;
}

function integer(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
