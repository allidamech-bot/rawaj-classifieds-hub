import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError } from "@/lib/api/shared";

export type ListingFacetFilterValue =
  | string
  | boolean
  | string[]
  | { min?: number; max?: number };

export interface ListingFacetOption {
  valueKey: string;
  labelAr: string;
  labelEn: string | null;
  count: number;
}

export interface ListingFacet {
  fieldKey: string;
  labelAr: string;
  labelEn: string | null;
  fieldType: string;
  groupKey: string | null;
  sortOrder: number;
  options: ListingFacetOption[];
  minimum: number | null;
  maximum: number | null;
}

export interface ListingFacetsResult {
  taxonomyVersionId: string | null;
  totalCount: number;
  facets: ListingFacet[];
}

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
  const taxonomyNodeIds = uniqueCleanStrings(query.taxonomyNodeIds ?? []).slice(0, 250);
  const attributeFilters = query.attributeFilters ?? {};
  if (Object.keys(attributeFilters).length > 50) return invalidFacetQuery();

  const priceMin = finiteNonNegative(query.priceMin);
  const priceMax = finiteNonNegative(query.priceMax);
  if (
    query.priceMin !== undefined &&
    priceMin === undefined ||
    query.priceMax !== undefined &&
    priceMax === undefined ||
    priceMin !== undefined &&
    priceMax !== undefined &&
    priceMin > priceMax
  ) {
    return invalidFacetQuery();
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_public_listing_facets_v1", {
    p_taxonomy_node_ids: taxonomyNodeIds.length > 0 ? taxonomyNodeIds : null,
    p_attribute_filters: attributeFilters,
    p_governorate_id: cleanText(query.governorateId) || null,
    p_price_min: priceMin ?? null,
    p_price_max: priceMax ?? null,
    p_query: cleanText(query.query).slice(0, 160) || null,
  });

  if (error) {
    return {
      ok: false,
      error: mapError(error, "public_listing_facets"),
    };
  }

  return { ok: true, data: parseListingFacets(data) };
}

function parseListingFacets(value: unknown): ListingFacetsResult {
  const payload = record(value);
  return {
    taxonomyVersionId: nullableText(payload.taxonomyVersionId),
    totalCount: integer(payload.totalCount),
    facets: records(payload.facets)
      .map((facet) => {
        const fieldKey = cleanText(facet.fieldKey);
        const labelAr = cleanText(facet.labelAr);
        if (!fieldKey || !labelAr) return null;
        return {
          fieldKey,
          labelAr,
          labelEn: nullableText(facet.labelEn),
          fieldType: cleanText(facet.fieldType),
          groupKey: nullableText(facet.groupKey),
          sortOrder: integer(facet.sortOrder),
          options: records(facet.options)
            .map((option) => {
              const valueKey = cleanText(option.valueKey);
              if (!valueKey) return null;
              return {
                valueKey,
                labelAr: cleanText(option.labelAr) || valueKey,
                labelEn: nullableText(option.labelEn),
                count: integer(option.count),
              };
            })
            .filter((option): option is ListingFacetOption => option !== null),
          minimum: nullableNumber(facet.minimum),
          maximum: nullableNumber(facet.maximum),
        };
      })
      .filter((facet): facet is ListingFacet => facet !== null),
  };
}

function invalidFacetQuery<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "validation_error",
      message: "قيم فلاتر البحث غير صالحة.",
      operation: "public_listing_facets",
    },
  };
}

function uniqueCleanStrings(values: string[]) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function finiteNonNegative(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  return cleanText(value) || null;
}

function integer(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
