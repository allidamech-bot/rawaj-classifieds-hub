import { z } from "zod";
import { parseBooleanParam } from "../../lib/boolean-parser.ts";

export const listingsSortValues = ["latest", "cheapest", "expensive", "featured"] as const;
export const listingsViewValues = ["grid", "list"] as const;

export type ListingsSort = (typeof listingsSortValues)[number];
export type ListingsView = (typeof listingsViewValues)[number];

const cleanText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(160).optional(),
);
const cleanAttributeFilters = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(6000).optional(),
);
const safeNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}, z.number().optional());
const safeUuid = z.preprocess((value) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return z.string().uuid().safeParse(value.trim()).success ? value.trim() : undefined;
}, z.string().optional());
function safeEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && values.includes(value as T[number]) ? value : undefined,
    z.enum(values).optional(),
  );
}

export const listingsSearchSchema = z
  .object({
    taxonomy: cleanText,
    category: cleanText,
    subcategory: cleanText,
    gov: cleanText,
    district: cleanText,
    location: safeUuid,
    price_min: safeNumber,
    price_max: safeNumber,
    car_make: cleanText,
    car_model: cleanText,
    fuel: safeEnum(["gasoline", "diesel", "hybrid", "electric", "gas", "other"]),
    transmission: safeEnum(["automatic", "manual", "semi_auto"]),
    property_purpose: safeEnum(["sale", "rent"]),
    property_type: safeEnum(["apartment", "house", "villa", "land", "shop", "office", "warehouse"]),
    rooms: safeNumber,
    rental_duration: safeEnum(["daily", "monthly", "yearly", "negotiable"]),
    electronics_brand: cleanText,
    detail_condition: safeEnum(["new", "used", "excellent", "good", "needs_work"]),
    employment_type: safeEnum(["full_time", "part_time", "contract", "temporary", "internship"]),
    salary_type: safeEnum(["fixed", "range", "commission", "negotiable", "not_listed"]),
    condition: safeEnum(["new", "used", "refurbished", "not_applicable"]),
    price_type: safeEnum(["fixed", "negotiable", "contact", "free"]),
    attrs: cleanAttributeFilters,
    q: cleanText,
    sort: z.enum(listingsSortValues).optional().catch("latest"),
    view: z.enum(listingsViewValues).optional().catch("grid"),
    with_photos: z.preprocess(parseBooleanParam, z.boolean().optional()),
    open_filters: z.preprocess(parseBooleanParam, z.boolean().optional()),
  })
  .transform((search) => {
    const priceMin = search.price_min;
    const priceMax = search.price_max;
    return {
      ...search,
      price_min:
        priceMin !== undefined && priceMax !== undefined && priceMin > priceMax
          ? priceMax
          : priceMin,
      price_max:
        priceMin !== undefined && priceMax !== undefined && priceMin > priceMax
          ? priceMin
          : priceMax,
      district: search.location ? `@${search.location}` : search.district,
    };
  });

export type ListingsSearch = z.infer<typeof listingsSearchSchema>;
