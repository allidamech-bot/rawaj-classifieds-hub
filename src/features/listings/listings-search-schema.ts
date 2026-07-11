import { z } from "zod";
import { parseBooleanParam } from "../../lib/boolean-parser.ts";

export const listingsSortValues = ["latest", "cheapest", "expensive", "featured"] as const;
export const listingsViewValues = ["grid", "list"] as const;

export type ListingsSort = (typeof listingsSortValues)[number];
export type ListingsView = (typeof listingsViewValues)[number];

export const listingsSearchSchema = z
  .object({
    taxonomy: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    gov: z.string().optional(),
    district: z.string().optional(),
    location: z.string().uuid().optional(),
    price_min: z.coerce.number().nonnegative().optional(),
    price_max: z.coerce.number().nonnegative().optional(),
    car_make: z.string().optional(),
    car_model: z.string().optional(),
    fuel: z.string().optional(),
    transmission: z.string().optional(),
    property_purpose: z.string().optional(),
    property_type: z.string().optional(),
    rooms: z.coerce.number().nonnegative().optional(),
    rental_duration: z.string().optional(),
    electronics_brand: z.string().optional(),
    detail_condition: z.string().optional(),
    employment_type: z.string().optional(),
    salary_type: z.string().optional(),
    q: z.string().optional(),
    sort: z.enum(listingsSortValues).optional(),
    view: z.enum(listingsViewValues).optional(),
    with_photos: z.preprocess(parseBooleanParam, z.boolean().optional()),
    open_filters: z.preprocess(parseBooleanParam, z.boolean().optional()),
  })
  .transform((search) => ({
    ...search,
    district: search.location ? `@${search.location}` : search.district,
  }));

export type ListingsSearch = z.infer<typeof listingsSearchSchema>;
