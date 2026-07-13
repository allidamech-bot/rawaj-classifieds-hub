import type {
  ClassifiedListing,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import { resolveCanonicalLocationIds } from "@/lib/api/canonical-location-filter";
import { fetchPublicListingsLocationAware } from "@/lib/api/location-aware-listings";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { publicListingSelect } from "@/lib/api/public-fields";
import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";
import { readReferences } from "@/lib/api/references";
import {
  escapePostgrestFilterValue,
  escapePostgrestSearchTerm,
  getClient,
  mapError,
} from "@/lib/api/shared";
import {
  normalizeArabicSearchTerm,
  supportsNormalizedListingSearch,
} from "@/lib/search-normalization";

export async function fetchPublicListingsCanonicalAware(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const encoded = filters.districtAr?.startsWith("@") ? filters.districtAr.slice(1) : undefined;
  if (!encoded) return fetchPublicListingsLocationAware(filters, cursor, pageSize);

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const idsResult = await resolveCanonicalLocationIds(client, encoded);
  if (!idsResult.ok) return idsResult;
  const references = await readReferences(client);
  if (!references.ok) return { ok: false, error: references.error };

  const rawSearchTerm = filters.query?.trim() ?? "";
  const useNormalizedSearch = rawSearchTerm ? await supportsNormalizedListingSearch(client) : false;

  let query = client
    .from("listings")
    .select(publicListingSelect)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter())
    .in("location_node_id", idsResult.data);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  const subcategoryId = filters.taxonomyLegacySubcategoryId ?? filters.subcategoryId;
  if (subcategoryId) query = query.eq("subcategory_id", subcategoryId);
  if (filters.governorateId) query = query.eq("governorate_id", filters.governorateId);
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  if (filters.yearFrom !== undefined) query = query.gte("details->>year", String(filters.yearFrom));
  if (filters.yearTo !== undefined) query = query.lte("details->>year", String(filters.yearTo));

  const exact: Array<[string, string | undefined]> = [
    ["details->>car_make", filters.carMake],
    ["details->>car_model", filters.carModel],
    ["details->>fuel_type", filters.fuelType],
    ["details->>transmission", filters.transmission],
    ["details->>listing_purpose", filters.taxonomyPropertyPurpose ?? filters.propertyPurpose],
    ["details->>property_type", filters.taxonomyPropertyType ?? filters.propertyType],
    ["details->>rental_duration", filters.rentalDuration],
    ["details->>electronics_brand", filters.electronicsBrand],
    ["details->>condition", filters.detailCondition],
    ["details->>employment_type", filters.employmentType],
    ["details->>salary_type", filters.salaryType],
  ];
  for (const [column, value] of exact) if (value?.trim()) query = query.eq(column, value);
  if (filters.rooms !== undefined) query = query.eq("details->>rooms", String(filters.rooms));
  if (rawSearchTerm) {
    const normalizedTerm = useNormalizedSearch
      ? normalizeArabicSearchTerm(rawSearchTerm)
      : rawSearchTerm;
    const term = escapePostgrestSearchTerm(normalizedTerm);
    query = useNormalizedSearch
      ? query.ilike("search_text_normalized", `%${term}%`)
      : query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const sort = filters.sort ?? "latest";
  if (sort === "cheapest")
    query = query
      .order("price", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
  else if (sort === "expensive")
    query = query
      .order("price", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
  else if (sort === "featured")
    query = query
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  else query = query.order("created_at", { ascending: false }).order("id", { ascending: false });

  query = applyCursor(query, cursor);

  const safePageSize = Math.max(1, Math.min(pageSize, 50));
  const { data, error } = await query.limit(safePageSize + 1);
  if (error) return { ok: false, error: mapError(error) };
  const listings = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );
  const hasMore = listings.length > safePageSize;
  const pageItems = hasMore ? listings.slice(0, safePageSize) : listings;
  const hydrated = await hydrateListingsWithPrimaryImages(client, pageItems);
  const last = pageItems.at(-1);

  return {
    ok: true,
    data: {
      items: hydrated,
      nextCursor: hasMore && last ? buildCursor(sort, last) : null,
      pageSize: safePageSize,
    },
  };
}

function applyCursor<T extends { or(filters: string): T }>(
  query: T,
  cursor: ListingCursor | null,
): T {
  if (!cursor) return query;
  const id = escapePostgrestFilterValue(cursor.id);

  if (cursor.type === "latest") {
    const created = escapePostgrestFilterValue(cursor.created_at);
    return query.or(`created_at.lt.${created},and(created_at.eq.${created},id.lt.${id})`);
  }

  if (cursor.type === "featured") {
    const created = escapePostgrestFilterValue(cursor.created_at);
    return cursor.is_featured
      ? query.or(
          `is_featured.eq.false,and(is_featured.eq.true,created_at.lt.${created}),and(is_featured.eq.true,created_at.eq.${created},id.lt.${id})`,
        )
      : query.or(
          `and(is_featured.eq.false,created_at.lt.${created}),and(is_featured.eq.false,created_at.eq.${created},id.lt.${id})`,
        );
  }

  if (cursor.price === null) return query.or(`and(price.is.null,id.gt.${id})`);
  const price = escapePostgrestFilterValue(String(cursor.price));
  const operator = cursor.type === "cheapest" ? "gt" : "lt";
  return query.or(`price.${operator}.${price},price.is.null,and(price.eq.${price},id.gt.${id})`);
}

function buildCursor(sort: string, listing: ClassifiedListing): ListingCursor {
  if (sort === "cheapest") return { type: "cheapest", price: listing.price, id: listing.id };
  if (sort === "expensive") return { type: "expensive", price: listing.price, id: listing.id };
  if (sort === "featured")
    return {
      type: "featured",
      is_featured: listing.isFeatured,
      created_at: listing.createdAt,
      id: listing.id,
    };
  return { type: "latest", created_at: listing.createdAt, id: listing.id };
}
