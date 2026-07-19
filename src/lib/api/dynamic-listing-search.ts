import type {
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
} from "@/lib/classifieds-types";
import { getClient, mapError } from "@/lib/api/shared";

export interface DynamicListingSearchPage {
  taxonomyVersionId: string | null;
  totalCount: number;
  listingIds: string[];
  nextCursor: ListingCursor | null;
}

export interface DynamicListingSearchQuery {
  filters: ListingFilters;
  locationNodeIds?: string[];
  cursor: ListingCursor | null;
  pageSize: number;
}

export async function fetchDynamicListingSearchPage(
  query: DynamicListingSearchQuery,
): Promise<ClassifiedsResult<DynamicListingSearchPage>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const filters = query.filters;
  const { data, error } = await clientResult.data.rpc("rawaj_public_listing_search_page_v1", {
    p_taxonomy_node_ids: cleanStrings(filters.taxonomyNodeIds),
    p_attribute_filters: filters.attributeFilters ?? {},
    p_governorate_id: cleanText(filters.governorateId) || null,
    p_location_node_ids: cleanStrings(query.locationNodeIds),
    p_price_min: finiteNonNegative(filters.priceMin),
    p_price_max: finiteNonNegative(filters.priceMax),
    p_price_type: cleanText(filters.priceType) || null,
    p_condition: cleanText(filters.condition) || null,
    p_query: cleanText(filters.query).slice(0, 160) || null,
    p_with_photos: Boolean(filters.withPhotos),
    p_sort: filters.sort ?? "latest",
    p_cursor: query.cursor,
    p_page_size: Math.max(1, Math.min(Math.trunc(query.pageSize), 50)),
  });

  if (error) {
    return {
      ok: false,
      error: mapError(error, "public_dynamic_listing_search"),
    };
  }

  return { ok: true, data: parseDynamicListingSearchPage(data) };
}

export function hasDynamicListingFilters(filters: ListingFilters): boolean {
  return Boolean(filters.attributeFilters && Object.keys(filters.attributeFilters).length > 0);
}

function parseDynamicListingSearchPage(value: unknown): DynamicListingSearchPage {
  const payload = record(value);
  return {
    taxonomyVersionId: nullableText(payload.taxonomyVersionId),
    totalCount: integer(payload.totalCount),
    listingIds: Array.isArray(payload.listingIds)
      ? [...new Set(payload.listingIds.map(cleanText).filter(Boolean))]
      : [],
    nextCursor: parseCursor(payload.nextCursor),
  };
}

function parseCursor(value: unknown): ListingCursor | null {
  const cursor = record(value);
  const type = cleanText(cursor.type);
  const id = cleanText(cursor.id);
  if (!id) return null;

  if (type === "latest") {
    const createdAt = cleanText(cursor.created_at);
    return createdAt ? { type, created_at: createdAt, id } : null;
  }

  if (type === "featured") {
    const createdAt = cleanText(cursor.created_at);
    if (!createdAt || typeof cursor.is_featured !== "boolean") return null;
    return { type, is_featured: cursor.is_featured, created_at: createdAt, id };
  }

  if (type === "cheapest" || type === "expensive") {
    return { type, price: nullableNumber(cursor.price), id };
  }

  return null;
}

function finiteNonNegative(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function cleanStrings(values: string[] | undefined): string[] | null {
  const result = [...new Set((values ?? []).map(cleanText).filter(Boolean))].slice(0, 250);
  return result.length > 0 ? result : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
