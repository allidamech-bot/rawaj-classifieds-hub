import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsResult,
  ClassifiedSubcategory,
  CreateListingPayload,
  ListingCursor,
  ListingImage,
  ListingImageUploadPayload,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import type { PlaceholderType, PriceType } from "@/types";
import {
  decodeListingCursor,
  encodeListingCursor,
  escapePostgrestFilterValue,
  escapePostgrestSearchTerm,
  getClient,
  mapError,
  mapStorageError,
  normalizePlaceholder,
  rowArray,
  rowBoolean,
  rowNullableNumber,
  rowNullableString,
  rowNumber,
  rowRecord,
  rowString,
} from "@/lib/api/shared";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  mapCategory,
  mapGovernorate,
  mapTaxonomyNode,
  readReferences,
} from "@/lib/api/references";

import { fetchDynamicFilteredPublicListings } from "@/lib/api/dynamic-filtered-listings";
import { hasDynamicListingFilters } from "@/lib/api/dynamic-listing-search";
import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";
import { resolveCanonicalLocationIds } from "@/lib/api/canonical-location-filter";
import { isListingPastExpiry, publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { publicListingDetailAliases, publicListingSelect } from "@/lib/api/public-fields";
import { selectPrimaryListingImages } from "@/lib/api/primary-listing-images";
import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";
import { prepareListingImageForUpload } from "@/lib/listing-image-processing";
import {
  isR2ListingImagePath,
  readSupabaseAccessToken,
  signR2ListingImagePaths,
} from "@/lib/r2-listing-images-client";
import { sanitizePublicListing } from "@/lib/public-listing-presentation";
import {
  normalizeArabicSearchTerm,
  supportsNormalizedListingSearch,
} from "@/lib/search-normalization";
import { buildTaxonomyIndex, findTaxonomyNode, resolveTaxonomyFilterScope } from "@/lib/taxonomy";

const signedImageUrlExpiresInSeconds = 900;

export function mapListing(
  row: Record<string, unknown>,
  categories: ClassifiedCategory[] = [],
  governorates: ClassifiedGovernorate[] = [],
): ClassifiedListing {
  const categoryId = rowString(row, "category_id");
  const governorateId = rowString(row, "governorate_id");
  const category = categories.find((item) => item.id === categoryId);
  const governorate = governorates.find((item) => item.id === governorateId);
  const rawStatus = rowString(row, "status", "pending_review") as ClassifiedListing["status"];
  const expiresAt = rowNullableString(row, "expires_at");
  const status = rawStatus === "approved" && isListingPastExpiry(expiresAt) ? "expired" : rawStatus;

  return {
    id: rowString(row, "id"),
    ownerId: rowString(row, "owner_id"),
    categoryId,
    subcategoryId: rowNullableString(row, "subcategory_id"),
    categoryNameAr: category?.nameAr,
    categoryPlaceholder: category?.placeholder,
    governorateId,
    governorateNameAr: governorate?.nameAr,
    title: rowString(row, "title"),
    description: rowString(row, "description"),
    price: rowNullableNumber(row, "price"),
    currency: "SYP",
    priceType: rowString(row, "price_type", "fixed") as PriceType,
    condition: rowString(
      row,
      "listing_condition",
      "not_applicable",
    ) as ClassifiedListing["condition"],
    status,
    districtAr: rowNullableString(row, "district_ar"),
    contactName: rowNullableString(row, "contact_name"),
    contactOptions: rowRecord(row, "contact_options") as Record<string, boolean>,
    details: mapListingDetails(row),
    isFeatured: rowBoolean(row, "is_featured"),
    featuredUntil: rowNullableString(row, "featured_until"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    rejectionReason: rowNullableString(row, "rejection_reason"),
    publishedAt: rowNullableString(row, "published_at"),
    archivedAt: rowNullableString(row, "archived_at"),
    reservedAt: rowNullableString(row, "reserved_at"),
    statusChangedAt: rowNullableString(row, "status_changed_at"),
    expiresAt,
    renewedAt: rowNullableString(row, "renewed_at"),
    expiryDays: rowNullableNumber(row, "expiry_days") as 30 | 60 | 90 | null,
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapListingDetails(row: Record<string, unknown>) {
  const fullDetails = rowRecord(row, "details");
  if (Object.keys(fullDetails).length > 0) return fullDetails;

  const details: Record<string, unknown> = {};
  for (const [key, alias] of Object.entries(publicListingDetailAliases)) {
    const value = row[alias];
    if (value !== undefined && value !== null) details[key] = value;
  }
  const taxonomyNodeId = row.detail_taxonomy_node_id;
  if (typeof taxonomyNodeId === "string" && taxonomyNodeId.trim()) {
    details._taxonomy_node_id = taxonomyNodeId.trim();
  }
  return details;
}

async function readEnabledPublicContactDetails(
  client: SupabaseClient,
  listingId: string,
  contactOptions: Record<string, boolean>,
) {
  const selectors = ["id"];
  if (contactOptions.phone === true) {
    selectors.push(
      "public_phone:details->>phone",
      "public_mobile:details->>mobile",
      "public_contact_phone:details->>contact_phone",
    );
  }
  if (contactOptions.whatsapp === true) {
    selectors.push(
      "public_whatsapp:details->>whatsapp",
      "public_whatsapp_camel:details->>whatsApp",
      "public_contact_whatsapp:details->>contact_whatsapp",
    );
  }
  if (selectors.length === 1) return {};

  const { data, error } = await client
    .from("listings")
    .select(selectors.join(","))
    .eq("id", listingId)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter())
    .maybeSingle();
  if (error || !data) return {};

  const row = data as unknown as Record<string, unknown>;
  const details: Record<string, unknown> = {};
  if (contactOptions.phone === true) {
    const phone = [row.public_phone, row.public_mobile, row.public_contact_phone].find(
      (value) => typeof value === "string" && value.trim(),
    );
    if (typeof phone === "string") details.phone = phone.trim();
  }
  if (contactOptions.whatsapp === true) {
    const whatsapp = [
      row.public_whatsapp,
      row.public_whatsapp_camel,
      row.public_contact_whatsapp,
    ].find((value) => typeof value === "string" && value.trim());
    if (typeof whatsapp === "string") details.whatsapp = whatsapp.trim();
  }
  return details;
}

export function mapImage(row: Record<string, unknown>): ListingImage {
  const storagePath = rowNullableString(row, "storage_path");

  return {
    id: rowString(row, "id"),
    listingId: rowString(row, "listing_id"),
    storagePath,
    publicUrl: null,
    signedUrlExpiresIn: null,
    altAr: rowNullableString(row, "alt_ar"),
    sortOrder: rowNumber(row, "sort_order"),
    createdAt: rowString(row, "created_at"),
  };
}

export async function fetchPublicListings(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  filters = await hydrateSavedTaxonomyFilter(clientResult.data, filters);

  if (hasDynamicListingFilters(filters)) {
    return fetchDynamicFilteredPublicListings(filters, cursor, pageSize, {
      mapListing,
      hydrateListingsWithPrimaryImages,
    });
  }

  const canonicalListingIds = await resolveCanonicalTaxonomyListingIds(
    clientResult.data,
    filters.taxonomyNodeIds,
  );
  if (!canonicalListingIds.ok) return canonicalListingIds;

  const listingSelect = filters.withPhotos
    ? `${publicListingSelect},listing_images!inner(id)`
    : publicListingSelect;

  let query = clientResult.data
    .from("listings")
    .select(listingSelect)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter());

  const taxonomyExpression = buildTaxonomyFilterExpression(
    canonicalListingIds.data,
    filters.taxonomyLegacyScopes,
  );
  if (taxonomyExpression) {
    query = query.or(taxonomyExpression);
  } else {
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.subcategoryId) query = query.eq("subcategory_id", filters.subcategoryId);
  }

  if (filters.districtAr?.startsWith("@")) {
    const locationIds = await resolveCanonicalLocationIds(
      clientResult.data,
      filters.districtAr.slice(1),
    );
    if (locationIds.ok) {
      const escapedIds = locationIds.data.map(escapePostgrestFilterValue).join(",");
      query = filters.governorateId
        ? query.or(
            `location_node_id.in.(${escapedIds}),and(location_node_id.is.null,governorate_id.eq.${escapePostgrestFilterValue(filters.governorateId)})`,
          )
        : query.in("location_node_id", locationIds.data);
    } else if (filters.governorateId) {
      query = query.eq("governorate_id", filters.governorateId);
    }
  } else if (filters.districtAr) {
    if (filters.governorateId) query = query.eq("governorate_id", filters.governorateId);
    query = query.eq("district_ar", filters.districtAr);
  } else if (filters.governorateId) {
    query = query.eq("governorate_id", filters.governorateId);
  }
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  if (filters.priceType) query = query.eq("price_type", filters.priceType);
  if (filters.condition) query = query.eq("listing_condition", filters.condition);

  query = applyCategoryFilters(query, filters);

  const cleanQuery = filters.query?.trim();
  if (cleanQuery) {
    const normalized = normalizeArabicSearchTerm(cleanQuery).slice(0, 120);
    if (normalized && (await supportsNormalizedListingSearch(clientResult.data))) {
      query = query.ilike("search_text_normalized", `%${escapePostgrestSearchTerm(normalized)}%`);
    } else {
      const term = escapePostgrestSearchTerm(cleanQuery.slice(0, 120));
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
  }

  const sort = filters.sort ?? "latest";
  if (sort === "cheapest") {
    query = query
      .order("price", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
  } else if (sort === "expensive") {
    query = query
      .order("price", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
  } else if (sort === "featured") {
    query = query
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  if (cursor) {
    if (cursor.type === "latest") {
      const created_at = escapePostgrestFilterValue(cursor.created_at);
      const id = escapePostgrestFilterValue(cursor.id);
      query = query.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`);
    } else if (cursor.type === "featured") {
      const created_at = escapePostgrestFilterValue(cursor.created_at);
      const id = escapePostgrestFilterValue(cursor.id);
      if (cursor.is_featured) {
        query = query.or(
          `is_featured.eq.false,and(is_featured.eq.true,created_at.lt.${created_at}),and(is_featured.eq.true,created_at.eq.${created_at},id.lt.${id})`,
        );
      } else {
        query = query.or(
          `and(is_featured.eq.false,created_at.lt.${created_at}),and(is_featured.eq.false,created_at.eq.${created_at},id.lt.${id})`,
        );
      }
    } else if (cursor.type === "cheapest" || cursor.type === "expensive") {
      const id = escapePostgrestFilterValue(cursor.id);
      if (cursor.price === null) {
        query = query.or(`and(price.is.null,id.gt.${id})`);
      } else {
        const price = escapePostgrestFilterValue(String(cursor.price));
        const operator = cursor.type === "cheapest" ? "gt" : "lt";
        query = query.or(
          `price.${operator}.${price},price.is.null,and(price.eq.${price},id.gt.${id})`,
        );
      }
    } else {
      return { ok: false, error: { code: "validation_error", message: "Invalid cursor type." } };
    }
  }

  const safePageSize = Math.max(1, Math.min(pageSize, 50));
  const { data, error } = await query.limit(safePageSize + 1);
  if (error) return { ok: false, error: mapError(error) };

  const listings = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    sanitizePublicListing(mapListing(row, references.categories, references.governorates)),
  );

  const nextCursor: ListingCursor | null =
    listings.length > safePageSize
      ? ({
          type:
            sort === "cheapest"
              ? "cheapest"
              : sort === "expensive"
                ? "expensive"
                : sort === "featured"
                  ? "featured"
                  : "latest",
          id: listings[safePageSize - 1].id,
          ...(sort === "cheapest" || sort === "expensive"
            ? { price: listings[safePageSize - 1].price }
            : {}),
          ...(sort === "featured"
            ? {
                is_featured: listings[safePageSize - 1].isFeatured,
                created_at: listings[safePageSize - 1].createdAt,
              }
            : {}),
          ...(sort === "latest" ? { created_at: listings[safePageSize - 1].createdAt } : {}),
        } as ListingCursor)
      : null;
  const pagedItems = nextCursor ? listings.slice(0, safePageSize) : listings;

  return {
    ok: true,
    data: {
      items: await hydrateListingsWithPrimaryImages(clientResult.data, pagedItems),
      nextCursor,
      pageSize: safePageSize,
    },
  };
}

async function hydrateSavedTaxonomyFilter(client: SupabaseClient, filters: ListingFilters) {
  if (!filters.taxonomyNodeId || filters.taxonomyNodeIds?.length) return filters;
  const { data, error } = await client
    .from("taxonomy_nodes")
    .select(
      "id,parent_id,slug,name_ar,name_en,description_ar,description_en,icon_key,sort_order,depth,is_active,is_leaf,filter_schema_key,classification_key,classification_value,legacy_category_id,legacy_subcategory_id",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return filters;

  const index = buildTaxonomyIndex(
    ((data ?? []) as Record<string, unknown>[]).map(mapTaxonomyNode),
  );
  const node = findTaxonomyNode(index, filters.taxonomyNodeId);
  if (!node) return filters;
  const scope = resolveTaxonomyFilterScope(index, node);
  return {
    ...filters,
    taxonomyNodeIds: scope.taxonomyNodeIds,
    taxonomyLegacyScopes: scope.legacyScopes,
  };
}

async function resolveCanonicalTaxonomyListingIds(
  client: SupabaseClient,
  taxonomyNodeIds?: string[],
): Promise<ClassifiedsResult<string[] | null>> {
  const ids = [...new Set((taxonomyNodeIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { ok: true, data: null };

  const { data, error } = await client
    .from("listing_taxonomy_assignments")
    .select("listing_id")
    .in("taxonomy_node_id", ids);
  if (error) {
    const mapped = mapError(error);
    return mapped.code === "schema_missing"
      ? { ok: true, data: null }
      : { ok: false, error: mapped };
  }
  return {
    ok: true,
    data: [
      ...new Set(
        ((data ?? []) as Record<string, unknown>[])
          .map((row) => rowString(row, "listing_id"))
          .filter(Boolean),
      ),
    ],
  };
}

function buildTaxonomyFilterExpression(
  listingIds: string[] | null,
  scopes?: ListingFilters["taxonomyLegacyScopes"],
) {
  if (listingIds === null && !scopes?.length) return null;
  const clauses: string[] = [];
  if (listingIds?.length) {
    clauses.push(`id.in.(${listingIds.map(escapePostgrestFilterValue).join(",")})`);
  }
  for (const scope of scopes ?? []) {
    const parts = [`category_id.eq.${escapePostgrestFilterValue(scope.categoryId)}`];
    if (scope.subcategoryId) {
      parts.push(`subcategory_id.eq.${escapePostgrestFilterValue(scope.subcategoryId)}`);
    }
    if (scope.propertyPurpose) {
      parts.push(
        `details->>listing_purpose.eq.${escapePostgrestFilterValue(scope.propertyPurpose)}`,
      );
    }
    if (scope.propertyType) {
      parts.push(`details->>property_type.eq.${escapePostgrestFilterValue(scope.propertyType)}`);
    }
    clauses.push(parts.length === 1 ? parts[0] : `and(${parts.join(",")})`);
  }
  return clauses.length > 0 ? clauses.join(",") : "id.is.null";
}

function applyCategoryFilters<
  T extends { eq: (...args: never[]) => T; ilike: (...args: never[]) => T },
>(source: T, filters: ListingFilters) {
  let query = source;
  const exactFilters: Array<[string, string | number | undefined]> = [
    ["details->>car_make", filters.carMake],
    ["details->>fuel_type", filters.fuelType],
    ["details->>transmission", filters.transmission],
    ["details->>listing_purpose", filters.taxonomyPropertyPurpose ?? filters.propertyPurpose],
    ["details->>property_type", filters.taxonomyPropertyType ?? filters.propertyType],
    ["details->>rental_duration", filters.rentalDuration],
    ["details->rooms", filters.rooms],
    ["details->>condition", filters.detailCondition],
    ["details->>employment_type", filters.employmentType],
    ["details->>salary_type", filters.salaryType],
  ];
  for (const [column, value] of exactFilters) {
    if (value !== undefined && value !== "") query = query.eq(column as never, value as never);
  }
  if (filters.carModel)
    query = query.ilike("details->>car_model" as never, filters.carModel as never);
  if (filters.electronicsBrand) {
    query = query.ilike("details->>electronics_brand" as never, filters.electronicsBrand as never);
  }
  return query;
}

export async function fetchListingDetail(
  id: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const listingId = id.trim();
  if (!listingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select(publicListingSelect)
    .eq("id", listingId)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter())
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان غير متاح أو لم تتم الموافقة عليه بعد." },
    };
  }

  const mappedListing = mapListing(
    data as Record<string, unknown>,
    references.categories,
    references.governorates,
  );
  const contactDetails = await readEnabledPublicContactDetails(
    clientResult.data,
    listingId,
    mappedListing.contactOptions,
  );
  const listing = sanitizePublicListing({
    ...mappedListing,
    details: { ...mappedListing.details, ...contactDetails },
  });
  const [hydratedListing] = await hydrateListingsWithPrimaryImages(clientResult.data, [listing]);
  return { ok: true, data: hydratedListing ?? listing };
}

export async function fetchOwnerListingDetail(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض تفاصيل الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error, "owner_listing_read") };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان غير متاح." },
    };
  }

  const listing = mapListing(
    data as Record<string, unknown>,
    references.categories,
    references.governorates,
  );
  const [hydratedListing] = await hydrateListingsWithPrimaryImages(clientResult.data, [listing]);
  return { ok: true, data: hydratedListing ?? listing };
}

export async function fetchCurrentUserListings(
  userId: string | null,
): Promise<ClassifiedsResult<ClassifiedListing[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض إعلاناتك." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data
    .from("listings")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error, "owner_listings_read") };
  const listings = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    mapListing(row, references.categories, references.governorates),
  );

  return { ok: true, data: await hydrateListingsWithPrimaryImages(clientResult.data, listings) };
}

export const OWNER_DELETABLE_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
] as const;

export type OwnerDeletableStatus = (typeof OWNER_DELETABLE_STATUSES)[number];

export function isOwnerDeletableStatus(status: string): status is OwnerDeletableStatus {
  return (OWNER_DELETABLE_STATUSES as readonly string[]).includes(status);
}

export async function deleteOwnerListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحذف الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", OWNER_DELETABLE_STATUSES)
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لا يمكن حذف هذا الإعلان حالياً.",
      },
    };
  }

  const { data: images, error: imagesError } = await clientResult.data
    .from("listing_images")
    .select("storage_path")
    .eq("listing_id", listingId);

  if (imagesError) return { ok: false, error: mapError(imagesError) };

  const paths = ((images ?? []) as Record<string, unknown>[])
    .map((row) => rowString(row, "storage_path"))
    .filter((path): path is string => Boolean(path));

  const { data: deletedData, error } = await clientResult.data
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", userId)
    .in("status", OWNER_DELETABLE_STATUSES)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };

  if (!deletedData) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "لم يتم حذف الإعلان. قد تكون الصلاحية مفقودة أو تم تغييره مسبقاً.",
      },
    };
  }

  if (paths.length > 0) {
    const storageResult = await clientResult.data.storage.from(listingImagesBucket).remove(paths);

    if (storageResult.error) {
      console.error("Failed to clean up storage images after listing delete", {
        listingId,
        error: storageResult.error,
      });
    }
  }

  return { ok: true, data: null };
}

async function signListingImages(
  client: SupabaseClient,
  images: ListingImage[],
): Promise<ListingImage[]> {
  const paths = [...new Set(images.map((image) => image.storagePath).filter(Boolean))] as string[];
  if (paths.length === 0) return images;

  const r2Paths = paths.filter(isR2ListingImagePath);
  const supabasePaths = paths.filter((path) => !isR2ListingImagePath(path));
  const urlsByPath = new Map<string, string>();

  if (supabasePaths.length > 0) {
    try {
      const { data, error } = await client.storage
        .from(listingImagesBucket)
        .createSignedUrls(supabasePaths, signedImageUrlExpiresInSeconds);

      if (!error && data) {
        for (const item of data) {
          if (item.path && item.signedUrl) urlsByPath.set(item.path, item.signedUrl);
        }
      }
    } catch {
      // Preserve any R2 URLs resolved below when legacy signing is unavailable.
    }
  }

  if (r2Paths.length > 0) {
    const accessToken = await readSupabaseAccessToken(client);
    const r2Urls = await signR2ListingImagePaths(r2Paths, accessToken);
    for (const [path, url] of r2Urls) urlsByPath.set(path, url);
  }

  return images.map((image) => {
    const signedUrl = image.storagePath ? urlsByPath.get(image.storagePath) : null;
    return signedUrl
      ? { ...image, publicUrl: signedUrl, signedUrlExpiresIn: signedImageUrlExpiresInSeconds }
      : image;
  });
}

async function readListingImagesByListingIds(
  client: SupabaseClient,
  listingIds: string[],
): Promise<ListingImage[]> {
  const ids = [...new Set(listingIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from("listing_images")
    .select("*")
    .in("listing_id", ids)
    .order("sort_order");

  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(mapImage);
}

export async function hydrateListingsWithPrimaryImages(
  client: SupabaseClient,
  listings: ClassifiedListing[],
): Promise<ClassifiedListing[]> {
  if (listings.length === 0) return listings;

  const images = await readListingImagesByListingIds(
    client,
    listings.map((listing) => listing.id),
  );
  if (images.length === 0) return listings;

  const primaryImages = selectPrimaryListingImages(images);
  const signedPrimaryImages = await signListingImages(client, primaryImages);
  const primaryImageByListing = new Map(
    signedPrimaryImages.map((image) => [image.listingId, image] as const),
  );

  return listings.map((listing) => ({
    ...listing,
    primaryImageUrl: primaryImageByListing.get(listing.id)?.publicUrl ?? null,
  }));
}

function buildNextCursor(sort: string, listing: ClassifiedListing): ListingCursor | null {
  if (!listing?.id) return null;
  if (sort === "cheapest") {
    return { type: "cheapest", price: listing.price, id: listing.id };
  }
  if (sort === "expensive") {
    return { type: "expensive", price: listing.price, id: listing.id };
  }
  if (sort === "featured") {
    return {
      type: "featured",
      is_featured: listing.isFeatured,
      created_at: listing.createdAt,
      id: listing.id,
    };
  }
  return { type: "latest", created_at: listing.createdAt, id: listing.id };
}

export async function createListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  const draftResult = await createListingWithStatus(userId, payload, "draft");
  if (!draftResult.ok) return draftResult;
  return submitCreatedListingForReview(userId, draftResult.data.id);
}

export async function createOwnerDraftListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return createListingWithStatus(userId, payload, "draft");
}

async function createListingWithStatus(
  userId: string | null,
  payload: CreateListingPayload,
  status: "draft" | "pending_review",
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لنشر إعلان حقيقي." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const title = payload.title.trim();
  const description = payload.description.trim();
  const contactName = payload.contactName?.trim() || null;

  if (
    !payload.categoryId.trim() ||
    (!payload.governorateId.trim() && !payload.districtAr?.trim().startsWith("@")) ||
    title.length < 4
  ) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "أكمل القسم والمحافظة والعنوان قبل إرسال الإعلان.",
      },
    };
  }

  if (payload.price !== null && (!Number.isFinite(payload.price) || payload.price < 0)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سعراً صحيحاً أو اترك السعر فارغاً." },
    };
  }

  const locationWrite = await resolveListingLocationWrite(
    clientResult.data,
    payload.governorateId,
    payload.districtAr,
  );
  if (!locationWrite.ok) return locationWrite;

  const insertPayload = {
    owner_id: userId,
    category_id: payload.categoryId,
    subcategory_id: payload.subcategoryId ?? null,
    governorate_id: locationWrite.data.governorateId,
    title,
    description,
    price: payload.price,
    price_type: payload.priceType,
    listing_condition: payload.condition,
    status,
    location_node_id: locationWrite.data.locationNodeId ?? null,
    district_ar: locationWrite.data.districtAr,
    contact_name: contactName,
    contact_options: payload.contactOptions,
    details: payload.details,
  };

  const { data, error } = await clientResult.data
    .from("listings")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapListing(data as Record<string, unknown>) };
}

async function submitCreatedListingForReview(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال الإعلان للمراجعة." },
    };
  }

  const normalizedListingId = listingId.trim();
  if (!normalizedListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data, error } = await clientResult.data.rpc("rawaj_submit_listing_for_review", {
    p_listing_id: normalizedListingId,
  });
  if (error) {
    const mapped = mapError(error, "owner_listing_submit");
    if (mapped.code === "schema_missing") {
      const refreshed = await fetchOwnerListingDetail(userId, normalizedListingId);
      if (refreshed.ok && refreshed.data.status === "pending_review") return refreshed;
    }
    return { ok: false, error: mapped };
  }

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row) {
    const listing = mapListing(row, references.categories, references.governorates);
    if (listing.status === "pending_review") return { ok: true, data: listing };
    return {
      ok: false,
      error: {
        code: "status_mismatch",
        message: "لم يؤكد الخادم انتقال الإعلان إلى قائمة المراجعة.",
        details: `Expected pending_review after submit RPC, received ${listing.status}.`,
        operation: "owner_listing_submit",
      },
    };
  }

  const refreshed = await fetchOwnerListingDetail(userId, normalizedListingId);
  if (refreshed.ok && refreshed.data.status === "pending_review") return refreshed;

  return {
    ok: false,
    error: {
      code: "unknown",
      message: "تم إرسال الطلب دون نتيجة إعلان قابلة للتحقق.",
      operation: "owner_listing_submit",
    },
  };
}

export async function uploadListingImage({
  userId,
  listing,
  file,
  sortOrder,
  altAr,
}: ListingImageUploadPayload): Promise<ClassifiedsResult<ListingImage>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لرفع صور الإعلان." },
    };
  }

  if (listing.ownerId !== userId) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكنك رفع صور لإعلان لا تملكه." },
    };
  }

  if (!["draft", "rejected"].includes(listing.status)) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل صور إعلان بعد اعتماده." },
    };
  }

  const validation = validateImageFile(file);
  if (!validation.ok) {
    return { ok: false, error: { code: "validation_error", message: validation.error! } };
  }

  const preparedFile = await prepareListingImageForUpload(file);
  const preparedValidation = validateImageFile(preparedFile);
  if (!preparedValidation.ok) {
    return {
      ok: false,
      error: { code: "validation_error", message: preparedValidation.error! },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: existingListing, error: existingListingError } = await clientResult.data
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", listing.id)
    .eq("owner_id", userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();

  if (existingListingError) return { ok: false, error: mapError(existingListingError) };
  if (!existingListing) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكن تعديل صور هذا الإعلان." },
    };
  }

  const storagePath = buildListingImagePath(userId, listing.id, preparedFile.name);

  const uploadResult = await clientResult.data.storage
    .from(listingImagesBucket)
    .upload(storagePath, preparedFile, {
      cacheControl: "31536000",
      contentType: preparedFile.type,
      upsert: false,
    });

  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const { data, error } = await clientResult.data
    .from("listing_images")
    .insert({
      listing_id: listing.id,
      storage_path: storagePath,
      alt_ar: altAr ?? listing.title,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) {
    await clientResult.data.storage.from(listingImagesBucket).remove([storagePath]);
    return { ok: false, error: mapError(error) };
  }

  const [image] = await signListingImages(clientResult.data, [
    mapImage(data as Record<string, unknown>),
  ]);
  return { ok: true, data: image ?? mapImage(data as Record<string, unknown>) };
}

export async function deleteListingImage(
  userId: string | null,
  listingId: string,
  image: ListingImage,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحذف صورة الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: existing, error: existingError } = await clientResult.data
    .from("listings")
    .select("owner_id, status")
    .eq("id", listingId)
    .maybeSingle();

  if (existingError) return { ok: false, error: mapError(existingError) };
  if (!existing || existing.owner_id !== userId) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكنك حذف صور إعلان لا تملكه." },
    };
  }

  if (existing.status !== "draft" && existing.status !== "rejected") {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا يمكنك حذف صور إعلان لا تملكه." },
    };
  }

  const { data: storedImage, error: imageError } = await clientResult.data
    .from("listing_images")
    .select("id, listing_id, storage_path")
    .eq("id", image.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (imageError) return { ok: false, error: mapError(imageError) };
  if (!storedImage) {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر تحديد صورة الإعلان." },
    };
  }

  const storagePath = rowNullableString(storedImage as Record<string, unknown>, "storage_path");
  const { data: deletedImage, error } = await clientResult.data
    .from("listing_images")
    .delete()
    .eq("id", image.id)
    .eq("listing_id", listingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error) };
  if (!deletedImage) {
    return {
      ok: false,
      error: {
        code: "not_found",
        message: "لم يتم حذف صورة الإعلان. قد تكون تغيّرت أو حُذفت مسبقًا.",
      },
    };
  }

  if (storagePath) {
    const storageResult = await clientResult.data.storage
      .from(listingImagesBucket)
      .remove([storagePath]);
    if (storageResult.error) {
      console.error("Failed to clean up storage image after listing image delete", {
        listingId,
        imageId: image.id,
        error: storageResult.error,
      });
    }
  }

  return { ok: true, data: null };
}

export async function fetchListingImages(
  listingId: string,
): Promise<ClassifiedsResult<ListingImage[]>> {
  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد صور الإعلان." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_images")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order");

  if (error) return { ok: false, error: mapError(error) };
  const images = ((data ?? []) as Record<string, unknown>[]).map(mapImage);
  return { ok: true, data: await signListingImages(clientResult.data, images) };
}
