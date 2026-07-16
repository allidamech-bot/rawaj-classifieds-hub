import type { ListingFilters } from "@/lib/classifieds-types";

export function normalizeSavedSearchFilters(filters: ListingFilters): ListingFilters {
  const normalized = Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, normalizeValue(value)] as const)
      .filter(
        (entry): entry is [string, NonNullable<ReturnType<typeof normalizeValue>>] =>
          entry[1] !== undefined,
      )
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return normalized as ListingFilters;
}

function normalizeValue(value: unknown): unknown | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
  if (typeof value === "boolean") return value || undefined;
  if (Array.isArray(value)) {
    const items = value.map(normalizeValue).filter((item) => item !== undefined);
    return items.length > 0
      ? [...new Set(items.map((item) => JSON.stringify(item)))].map((item) => JSON.parse(item))
      : undefined;
  }
  if (value && typeof value === "object") {
    const object = Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, normalizeValue(item)] as const)
        .filter((entry) => entry[1] !== undefined)
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    return Object.keys(object).length > 0 ? object : undefined;
  }
  return undefined;
}
