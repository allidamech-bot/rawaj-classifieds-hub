import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedSubcategory,
  ClassifiedsError,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  ListingCursor,
  ListingFilters,
  ListingImage,
  PaginatedListingsResponse,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import { requireCloudflarePublicApiBaseUrl } from "@/lib/public-data/config";
import type { LocationSearchResult } from "@/lib/api/location-taxonomy";
import type { LocationNode } from "@/lib/location-types";

export interface CloudflareReferenceBundle {
  categories: ClassifiedCategory[];
  subcategories: ClassifiedSubcategory[];
  governorates: ClassifiedGovernorate[];
  taxonomyNodes: TaxonomyNode[];
}

export interface CloudflarePublicAdPlacement {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  priority: number;
}

export interface CloudflareListingDetailBundle {
  listing: ClassifiedListing;
  images: ListingImage[];
}

interface ApiEnvelope<T> {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: string;
  };
}

const REQUEST_TIMEOUT_MS = 12_000;
const REFERENCE_CACHE_TTL_MS = 5 * 60_000;
let referenceCache: {
  expiresAt: number;
  promise: Promise<ClassifiedsResult<CloudflareReferenceBundle>>;
} | null = null;

export async function fetchCloudflareReferences(): Promise<
  ClassifiedsResult<CloudflareReferenceBundle>
> {
  const now = Date.now();
  if (referenceCache && referenceCache.expiresAt > now) return referenceCache.promise;

  const promise = requestJson<CloudflareReferenceBundle>("/v1/references").then((result) => {
    if (!result.ok && referenceCache?.promise === promise) referenceCache = null;
    return result;
  });
  referenceCache = { expiresAt: now + REFERENCE_CACHE_TTL_MS, promise };
  return promise;
}

export async function fetchCloudflareAdPlacements(
  placementPage: string,
  device: "mobile" | "desktop",
): Promise<ClassifiedsResult<CloudflarePublicAdPlacement[]>> {
  return requestJson<CloudflarePublicAdPlacement[]>("/v1/ad-placements", {
    page: placementPage,
    device,
  }).then((result) =>
    result.ok
      ? {
          ok: true,
          data: result.data.map((placement) => ({
            ...placement,
            imageUrl: absoluteMediaUrl(placement.imageUrl),
          })),
        }
      : result,
  );
}

export async function fetchCloudflareListings(
  filters: ListingFilters = {},
  cursor: ListingCursor | null = null,
  pageSize = 30,
): Promise<ClassifiedsResult<PaginatedListingsResponse<ClassifiedListing>>> {
  const sort = filters.sort ?? "latest";
  const taxonomyNodeIds = [
    ...new Set(
      [
        ...(filters.taxonomyNodeIds ?? []),
        ...(filters.taxonomyNodeId ? [filters.taxonomyNodeId] : []),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const legacyScopes = (filters.taxonomyLegacyScopes ?? []).map((scope) =>
    base64UrlEncode(JSON.stringify(scope)),
  );

  const query: Record<string, string | number | boolean | string[] | null | undefined> = {
    categoryId: filters.categoryId,
    subcategoryId: filters.subcategoryId,
    governorateId: filters.governorateId,
    districtAr: filters.districtAr,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    priceType: filters.priceType,
    condition: filters.condition,
    withPhotos: filters.withPhotos,
    q: filters.query,
    sort,
    pageSize: Math.max(1, Math.min(pageSize, 50)),
    taxonomyNodeId: taxonomyNodeIds,
    legacyScope: legacyScopes,
    taxonomyLegacySubcategoryId: filters.taxonomyLegacySubcategoryId,
    carMake: filters.carMake,
    carModel: filters.carModel,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    fuelType: filters.fuelType,
    transmission: filters.transmission,
    propertyPurpose: filters.propertyPurpose,
    propertyType: filters.propertyType,
    taxonomyPropertyPurpose: filters.taxonomyPropertyPurpose,
    taxonomyPropertyType: filters.taxonomyPropertyType,
    rooms: filters.rooms,
    rentalDuration: filters.rentalDuration,
    electronicsBrand: filters.electronicsBrand,
    detailCondition: filters.detailCondition,
    employmentType: filters.employmentType,
    salaryType: filters.salaryType,
    attrs:
      filters.attributeFilters && Object.keys(filters.attributeFilters).length > 0
        ? base64UrlEncode(JSON.stringify(filters.attributeFilters))
        : null,
    cursor: cursor ? encodeWorkerCursor(cursor, sort) : null,
  };

  const result = await requestJson<{
    items: ClassifiedListing[];
    nextCursor: string | null;
    pageSize: number;
  }>("/v1/listings", query);
  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      items: result.data.items.map(normalizeListingMedia),
      nextCursor: decodeWorkerCursor(result.data.nextCursor),
      pageSize: result.data.pageSize,
    },
  };
}

export async function fetchCloudflareListingDetail(
  listingId: string,
): Promise<ClassifiedsResult<CloudflareListingDetailBundle>> {
  const cleanId = listingId.trim();
  if (!cleanId) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "معرّف الإعلان غير صالح.",
        operation: "cloudflare_public_listing_detail",
      },
    };
  }

  const result = await requestJson<CloudflareListingDetailBundle>(
    `/v1/listings/${encodeURIComponent(cleanId)}`,
  );
  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      listing: normalizeListingMedia(result.data.listing),
      images: result.data.images.map((image) => ({
        ...image,
        publicUrl: image.publicUrl ? absoluteMediaUrl(image.publicUrl) : null,
      })),
    },
  };
}

export function fetchCloudflareLocationRoots(
  country = "SA",
): Promise<ClassifiedsResult<LocationNode[]>> {
  return requestJson<LocationNode[]>("/v1/locations/roots", { country });
}

export function fetchCloudflareLocationChildren(
  parentId: string,
): Promise<ClassifiedsResult<LocationNode[]>> {
  return requestJson<LocationNode[]>(`/v1/locations/${encodeURIComponent(parentId)}/children`);
}

export function fetchCloudflareLocationPath(
  nodeId: string,
): Promise<ClassifiedsResult<LocationNode[]>> {
  return requestJson<LocationNode[]>(`/v1/locations/${encodeURIComponent(nodeId)}`);
}

export function fetchCloudflareLocationDescendantIds(
  nodeId: string,
): Promise<ClassifiedsResult<string[]>> {
  return requestJson<string[]>(`/v1/locations/${encodeURIComponent(nodeId)}`, {
    include: "descendants",
  });
}

export function searchCloudflareLocations(
  query: string,
  limit = 12,
): Promise<ClassifiedsResult<LocationSearchResult[]>> {
  return requestJson<LocationSearchResult[]>("/v1/locations/search", { q: query, limit });
}

export function fetchCloudflareListingFacets<T>(
  query: Record<string, unknown>,
): Promise<ClassifiedsResult<T>> {
  const parameters: Record<string, string | number | boolean | string[] | null | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "attributeFilters" && value && typeof value === "object") {
      parameters.attrs = base64UrlEncode(JSON.stringify(value));
    } else if (Array.isArray(value)) {
      parameters[key] = value.filter((item): item is string => typeof item === "string");
    } else if (["string", "number", "boolean"].includes(typeof value)) {
      parameters[key] = value as string | number | boolean;
    }
  }
  return requestJson<T>("/v1/listing-facets", parameters);
}

export function fetchCloudflareNearbyListings<T>(
  query: Record<string, unknown>,
): Promise<ClassifiedsResult<T>> {
  const parameters: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (["string", "number", "boolean"].includes(typeof value)) {
      parameters[key] = value as string | number | boolean;
    }
  }
  return requestJson<T>("/v1/listings/nearby", parameters);
}

export function fetchCloudflareSitemapReferences(): Promise<
  ClassifiedsResult<{ categories: Array<{ slug: string }>; governorates: Array<{ slug: string }> }>
> {
  return requestJson("/v1/sitemap/references");
}

export function fetchCloudflareSitemapCount(): Promise<ClassifiedsResult<{ count: number }>> {
  return requestJson("/v1/sitemap/count");
}

export function fetchCloudflareSitemapListings(
  page: number,
  pageSize: number,
): Promise<ClassifiedsResult<Array<{ id: string; ownerId: string; updatedAt: string }>>> {
  return requestJson("/v1/sitemap/listings", { page, pageSize });
}

async function requestJson<T>(
  path: string,
  query?: Record<string, string | number | boolean | string[] | null | undefined>,
): Promise<ClassifiedsResult<T>> {
  const baseResult = requireCloudflarePublicApiBaseUrl();
  if (!baseResult.ok) return baseResult;

  const url = new URL(path, `${baseResult.data}/`);
  appendQuery(url.searchParams, query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok) {
      return {
        ok: false,
        error: mapApiError(response.status, payload?.error, url.pathname),
      };
    }

    if (!payload || payload.data === undefined) {
      return {
        ok: false,
        error: {
          code: "unknown",
          message: "استجابة خدمة البيانات غير مكتملة.",
          operation: `cloudflare_public_api:${url.pathname}`,
        },
      };
    }

    return { ok: true, data: payload.data };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      ok: false,
      error: {
        code: timedOut ? "rate_limited" : "unknown",
        message: timedOut
          ? "استغرقت خدمة البيانات وقتًا أطول من المتوقع. حاول مرة أخرى."
          : "تعذر الاتصال بخدمة بيانات رَوَاج.",
        details: error instanceof Error ? error.message : String(error),
        operation: `cloudflare_public_api:${url.pathname}`,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function appendQuery(
  params: URLSearchParams,
  query?: Record<string, string | number | boolean | string[] | null | undefined>,
): void {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item) params.append(key, item);
      continue;
    }
    params.set(key, String(value));
  }
}

function mapApiError(
  status: number,
  source: ApiEnvelope<never>["error"],
  path: string,
): ClassifiedsError {
  const sourceCode = source?.code ?? "";
  const code: ClassifiedsErrorCode =
    status === 404 || sourceCode === "not_found"
      ? "not_found"
      : status === 400 || sourceCode === "validation_error"
        ? "validation_error"
        : status === 401
          ? "auth_required"
          : status === 403
            ? "permission_denied"
            : status === 429
              ? "rate_limited"
              : status === 503 || sourceCode === "database_unavailable"
                ? "setup_required"
                : "unknown";

  return {
    code,
    message:
      source?.message?.trim() ||
      (status >= 500 ? "خدمة بيانات رَوَاج غير متاحة مؤقتًا." : "تعذر تحميل البيانات المطلوبة."),
    details: source?.details,
    operation: `cloudflare_public_api:${path}`,
  };
}

function normalizeListingMedia(listing: ClassifiedListing): ClassifiedListing {
  return {
    ...listing,
    primaryImageUrl: listing.primaryImageUrl
      ? absoluteMediaUrl(listing.primaryImageUrl)
      : listing.primaryImageUrl,
  };
}

function absoluteMediaUrl(value: string): string {
  const baseResult = requireCloudflarePublicApiBaseUrl();
  if (!baseResult.ok) return value;
  try {
    return new URL(value, `${baseResult.data}/`).toString();
  } catch {
    return value;
  }
}

function encodeWorkerCursor(
  cursor: ListingCursor,
  sort: NonNullable<ListingFilters["sort"]>,
): string {
  const payload = {
    sort,
    id: cursor.id,
    ...(cursor.type === "latest" || cursor.type === "featured"
      ? { createdAt: cursor.created_at }
      : {}),
    ...(cursor.type === "featured" ? { isFeatured: cursor.is_featured } : {}),
    ...(cursor.type === "cheapest" || cursor.type === "expensive" ? { price: cursor.price } : {}),
  };
  return base64UrlEncode(JSON.stringify(payload));
}

function decodeWorkerCursor(value: string | null): ListingCursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(base64UrlDecode(value)) as Record<string, unknown>;
    const id = typeof cursor.id === "string" ? cursor.id : "";
    const sort = cursor.sort;
    if (!id) return null;

    if (sort === "latest" && typeof cursor.createdAt === "string") {
      return { type: "latest", id, created_at: cursor.createdAt };
    }
    if (sort === "featured" && typeof cursor.createdAt === "string") {
      return {
        type: "featured",
        id,
        created_at: cursor.createdAt,
        is_featured: cursor.isFeatured === true,
      };
    }
    if (sort === "cheapest" || sort === "expensive") {
      const price = typeof cursor.price === "number" || cursor.price === null ? cursor.price : null;
      return { type: sort, id, price };
    }
    return null;
  } catch {
    return null;
  }
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
