import type { ListingFacetFilterValue } from "@/lib/api/listing-facets";

export type ListingAttributeFilters = Record<string, ListingFacetFilterValue>;

const MAX_FILTER_FIELDS = 50;
const MAX_FIELD_KEY_LENGTH = 80;
const MAX_SCALAR_LENGTH = 160;
const MAX_ARRAY_VALUES = 50;
const MAX_ENCODED_LENGTH = 6000;
const FIELD_KEY_PATTERN = /^[a-z0-9][a-z0-9_.:-]*$/i;

export function parseListingAttributeFilters(value: unknown): ListingAttributeFilters {
  if (typeof value === "string") {
    const encoded = value.trim();
    if (!encoded || encoded.length > MAX_ENCODED_LENGTH) return {};
    try {
      return normalizeListingAttributeFilters(JSON.parse(encoded));
    } catch {
      return {};
    }
  }

  return normalizeListingAttributeFilters(value);
}

export function encodeListingAttributeFilters(
  value: ListingAttributeFilters,
): string | undefined {
  const normalized = normalizeListingAttributeFilters(value);
  if (Object.keys(normalized).length === 0) return undefined;
  const encoded = JSON.stringify(normalized);
  return encoded.length <= MAX_ENCODED_LENGTH ? encoded : undefined;
}

export function normalizeListingAttributeFilters(value: unknown): ListingAttributeFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: ListingAttributeFilters = {};
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, filterValue]) => [key.trim(), filterValue] as const)
    .filter(
      ([key]) =>
        key.length > 0 &&
        key.length <= MAX_FIELD_KEY_LENGTH &&
        FIELD_KEY_PATTERN.test(key),
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_FILTER_FIELDS);

  for (const [key, filterValue] of entries) {
    const parsed = normalizeFilterValue(filterValue);
    if (parsed !== undefined) normalized[key] = parsed;
  }

  return normalized;
}

export function countListingAttributeFilters(value: ListingAttributeFilters): number {
  return Object.keys(normalizeListingAttributeFilters(value)).length;
}

function normalizeFilterValue(value: unknown): ListingFacetFilterValue | undefined {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const cleaned = value.trim().slice(0, MAX_SCALAR_LENGTH);
    return cleaned || undefined;
  }

  if (Array.isArray(value)) {
    const items = [
      ...new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, MAX_SCALAR_LENGTH))
          .filter(Boolean),
      ),
    ]
      .sort((left, right) => left.localeCompare(right))
      .slice(0, MAX_ARRAY_VALUES);
    return items.length > 0 ? items : undefined;
  }

  if (value && typeof value === "object") {
    const range = value as Record<string, unknown>;
    const minimum = finiteNumber(range.min);
    const maximum = finiteNumber(range.max);
    if (minimum === undefined && maximum === undefined) return undefined;
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      return { min: maximum, max: minimum };
    }
    return {
      ...(minimum !== undefined ? { min: minimum } : {}),
      ...(maximum !== undefined ? { max: maximum } : {}),
    };
  }

  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
