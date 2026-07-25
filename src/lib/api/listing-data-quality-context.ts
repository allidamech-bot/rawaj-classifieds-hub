import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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
  if (!userId)
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لفتح مركز جودة البيانات." },
    };
  const result = await cloudflareApiRequest<ListingDataQualityContext>(
    "/v1/admin/data-quality/context",
  );
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}
