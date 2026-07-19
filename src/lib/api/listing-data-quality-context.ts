import { getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export interface DataQualityTaxonomyVersion {
  id: string;
  versionNumber: number;
  status: "draft" | "published";
  changeSummary: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  activeLeafCount: number;
  fieldRuleCount: number;
  openIssueCount: number;
  blockingIssueCount: number;
}

export interface DataQualityCategory {
  id: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
  openIssueCount: number;
  blockingIssueCount: number;
}

export interface DataQualitySummary {
  total: number;
  open: number;
  needsReview: number;
  sellerAction: number;
  dismissed: number;
  resolved: number;
  blocking: number;
  errors: number;
  warnings: number;
  affectedCategories: number;
  affectedListings: number;
}

export interface ListingDataQualityContext {
  versions: DataQualityTaxonomyVersion[];
  categories: DataQualityCategory[];
  summary: DataQualitySummary;
}

export async function fetchListingDataQualityContext(
  userId: string | null,
): Promise<ClassifiedsResult<ListingDataQualityContext>> {
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "auth_required",
        message: "يجب تسجيل الدخول لفتح مركز جودة البيانات.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_admin_fetch_data_quality_context_v1",
  );
  if (error) {
    return {
      ok: false,
      error: mapError(error, "listing_data_quality_context"),
    };
  }

  const payload = record(data);
  return {
    ok: true,
    data: {
      versions: array(payload.versions).map(parseVersion).filter(isPresent),
      categories: array(payload.categories).map(parseCategory).filter(isPresent),
      summary: parseSummary(payload.summary),
    },
  };
}

function parseVersion(value: unknown): DataQualityTaxonomyVersion | null {
  const item = record(value);
  const id = text(item.id);
  const status = item.status === "draft" || item.status === "published" ? item.status : null;
  if (!id || !status) return null;

  return {
    id,
    versionNumber: integer(item.versionNumber),
    status,
    changeSummary: nullableText(item.changeSummary),
    publishedAt: nullableText(item.publishedAt),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
    nodeCount: integer(item.nodeCount),
    activeLeafCount: integer(item.activeLeafCount),
    fieldRuleCount: integer(item.fieldRuleCount),
    openIssueCount: integer(item.openIssueCount),
    blockingIssueCount: integer(item.blockingIssueCount),
  };
}

function parseCategory(value: unknown): DataQualityCategory | null {
  const item = record(value);
  const id = text(item.id);
  const nameAr = text(item.nameAr);
  if (!id || !nameAr) return null;

  return {
    id,
    nameAr,
    nameEn: nullableText(item.nameEn),
    sortOrder: integer(item.sortOrder),
    openIssueCount: integer(item.openIssueCount),
    blockingIssueCount: integer(item.blockingIssueCount),
  };
}

function parseSummary(value: unknown): DataQualitySummary {
  const item = record(value);
  return {
    total: integer(item.total),
    open: integer(item.open),
    needsReview: integer(item.needsReview),
    sellerAction: integer(item.sellerAction),
    dismissed: integer(item.dismissed),
    resolved: integer(item.resolved),
    blocking: integer(item.blocking),
    errors: integer(item.errors),
    warnings: integer(item.warnings),
    affectedCategories: integer(item.affectedCategories),
    affectedListings: integer(item.affectedListings),
  };
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
  const result = text(value).trim();
  return result || null;
}

function integer(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? Math.trunc(result) : 0;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
