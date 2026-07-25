import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { fetchCloudflareListingFacets } from "@/lib/public-data/cloudflare-client";

export type ListingFacetFilterValue = string | boolean | string[] | { min?: number; max?: number };
export interface ListingFacetOption { valueKey: string; labelAr: string; labelEn: string | null; count: number }
export interface ListingFacet {
  fieldKey: string; labelAr: string; labelEn: string | null; fieldType: string;
  groupKey: string | null; sortOrder: number; options: ListingFacetOption[];
  minimum: number | null; maximum: number | null;
}
export interface ListingFacetsResult { taxonomyVersionId: string | null; totalCount: number; facets: ListingFacet[] }
export interface ListingFacetsQuery {
  taxonomyNodeIds?: string[];
  attributeFilters?: Record<string, ListingFacetFilterValue>;
  governorateId?: string;
  priceMin?: number;
  priceMax?: number;
  query?: string;
}

export async function fetchPublicListingFacets(
  query: ListingFacetsQuery,
): Promise<ClassifiedsResult<ListingFacetsResult>> {
  if ((query.taxonomyNodeIds?.length ?? 0) > 250 || Object.keys(query.attributeFilters ?? {}).length > 50) {
    return invalidFacetQuery();
  }
  if (
    (query.priceMin !== undefined && (!Number.isFinite(query.priceMin) || query.priceMin < 0)) ||
    (query.priceMax !== undefined && (!Number.isFinite(query.priceMax) || query.priceMax < 0)) ||
    (query.priceMin !== undefined && query.priceMax !== undefined && query.priceMin > query.priceMax)
  ) return invalidFacetQuery();
  const result = await fetchCloudflareListingFacets<ListingFacetsResult>({
    taxonomyNodeIds: query.taxonomyNodeIds ?? [],
    attributeFilters: query.attributeFilters ?? {},
    governorateId: query.governorateId,
    priceMin: query.priceMin,
    priceMax: query.priceMax,
    query: query.query?.trim().slice(0, 160),
  });
  return result.ok ? result : { ok: false, error: { code: result.error.code as ClassifiedsErrorCode, message: result.error.message } };
}

function invalidFacetQuery<T>(): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message: "قيم فلاتر البحث غير صالحة.", operation: "public_listing_facets" } };
}
