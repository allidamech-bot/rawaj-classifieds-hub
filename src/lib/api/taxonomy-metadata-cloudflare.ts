import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import {
  fetchPublishedLeafSchema as fetchPublishedLeafSchemaLegacy,
  fetchPublishedTaxonomy as fetchPublishedTaxonomyLegacy,
  fetchVehicleMakes as fetchVehicleMakesLegacy,
  fetchVehicleModelChildren as fetchVehicleModelChildrenLegacy,
  fetchVehicleModels as fetchVehicleModelsLegacy,
} from "./taxonomy-metadata";

export * from "./taxonomy-metadata";

import type {
  PublishedLeafSchema,
  PublishedTaxonomy,
  PublishedTaxonomyNode,
  VehicleMakeMetadata,
  VehicleModelChildrenMetadata,
  VehicleModelMetadata,
} from "./taxonomy-metadata";

function failure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}

export function fetchPublishedTaxonomy(): Promise<ClassifiedsResult<PublishedTaxonomy>> {
  if (!isCloudflarePublicDataProvider()) return fetchPublishedTaxonomyLegacy();
  return cloudflareApiRequest<{
    taxonomyNodes?: Array<Record<string, unknown>>;
  }>("/v1/references").then((result) => {
    if (!result.ok) return failure<PublishedTaxonomy>(result);
    const nodes = (result.data.taxonomyNodes ?? []).map(mapTaxonomyNode).filter(present);
    return { ok: true, data: { version: null, nodes } };
  });
}

export function fetchPublishedLeafSchema(
  taxonomyNodeId: string,
): Promise<ClassifiedsResult<PublishedLeafSchema>> {
  const cleanNodeId = taxonomyNodeId.trim();
  if (!cleanNodeId) {
    return Promise.resolve({
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد القسم المطلوب." },
    });
  }
  if (!isCloudflarePublicDataProvider()) return fetchPublishedLeafSchemaLegacy(cleanNodeId);
  return cloudflareApiRequest<PublishedLeafSchema>(
    `/v1/taxonomy/leaf/${encodeURIComponent(cleanNodeId)}`,
  ).then((result) => (result.ok ? { ok: true, data: result.data } : failure(result)));
}

export function fetchVehicleMakes(
  query?: string | null,
  limit = 100,
): Promise<ClassifiedsResult<VehicleMakeMetadata[]>> {
  if (!isCloudflarePublicDataProvider()) return fetchVehicleMakesLegacy(query, limit);
  const params = new URLSearchParams({ limit: String(limit) });
  if (query?.trim()) params.set("q", query.trim());
  return cloudflareApiRequest<{ items: VehicleMakeMetadata[] }>(
    `/v1/vehicles/makes?${params.toString()}`,
  ).then((result) => (result.ok ? { ok: true, data: result.data.items } : failure(result)));
}

export function fetchVehicleModels(
  makeId: string,
  options: { query?: string | null; year?: number | null; limit?: number } = {},
): Promise<ClassifiedsResult<VehicleModelMetadata[]>> {
  if (!isCloudflarePublicDataProvider()) return fetchVehicleModelsLegacy(makeId, options);
  const params = new URLSearchParams({
    makeId: makeId.trim(),
    limit: String(options.limit ?? 200),
  });
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.year !== null && options.year !== undefined) params.set("year", String(options.year));
  return cloudflareApiRequest<{ items: VehicleModelMetadata[] }>(
    `/v1/vehicles/models?${params.toString()}`,
  ).then((result) => (result.ok ? { ok: true, data: result.data.items } : failure(result)));
}

export function fetchVehicleModelChildren(
  modelId: string,
  year?: number | null,
): Promise<ClassifiedsResult<VehicleModelChildrenMetadata>> {
  if (!isCloudflarePublicDataProvider()) return fetchVehicleModelChildrenLegacy(modelId, year);
  const params = new URLSearchParams();
  if (year !== null && year !== undefined) params.set("year", String(year));
  const suffix = params.size ? `?${params.toString()}` : "";
  return cloudflareApiRequest<VehicleModelChildrenMetadata>(
    `/v1/vehicles/models/${encodeURIComponent(modelId.trim())}/children${suffix}`,
  ).then((result) => (result.ok ? { ok: true, data: result.data } : failure(result)));
}

function mapTaxonomyNode(row: Record<string, unknown>): PublishedTaxonomyNode | null {
  const id = text(row.id);
  const slug = text(row.slug);
  const nameAr = text(row.nameAr ?? row.name_ar);
  if (!id || !slug || !nameAr) return null;
  return {
    id,
    parentId: nullableText(row.parentId ?? row.parent_id),
    slug,
    nameAr,
    nameEn: nullableText(row.nameEn ?? row.name_en),
    descriptionAr: nullableText(row.descriptionAr ?? row.description_ar),
    descriptionEn: nullableText(row.descriptionEn ?? row.description_en),
    iconKey: nullableText(row.iconKey ?? row.icon_key),
    sortOrder: numberValue(row.sortOrder ?? row.sort_order),
    depth: numberValue(row.depth),
    isLeaf: booleanValue(row.isLeaf ?? row.is_leaf),
    filterSchemaKey: nullableText(row.filterSchemaKey ?? row.filter_schema_key),
    displaySchemaKey: nullableText(row.displaySchemaKey ?? row.display_schema_key),
    classificationKey: nullableText(row.classificationKey ?? row.classification_key),
    classificationValue: nullableText(row.classificationValue ?? row.classification_value),
    legacyCategoryId: nullableText(row.legacyCategoryId ?? row.legacy_category_id),
    legacySubcategoryId: nullableText(row.legacySubcategoryId ?? row.legacy_subcategory_id),
    seoTitleAr: null,
    seoTitleEn: null,
    seoDescriptionAr: null,
    seoDescriptionEn: null,
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}
function present<T>(value: T | null): value is T {
  return value !== null;
}
