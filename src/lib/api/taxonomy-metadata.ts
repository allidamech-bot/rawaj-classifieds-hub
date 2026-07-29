import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export interface TaxonomyVersionMetadata {
  id: string;
  number: number;
  publishedAt: string | null;
}

export interface PublishedTaxonomyNode {
  id: string;
  parentId: string | null;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  iconKey: string | null;
  sortOrder: number;
  depth: number;
  isLeaf: boolean;
  filterSchemaKey: string | null;
  displaySchemaKey: string | null;
  classificationKey: string | null;
  classificationValue: string | null;
  legacyCategoryId: string | null;
  legacySubcategoryId: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
}

export interface PublishedTaxonomy {
  version: TaxonomyVersionMetadata | null;
  nodes: PublishedTaxonomyNode[];
}

export interface TaxonomyFieldOption {
  key: string;
  labelAr: string;
  labelEn: string | null;
  aliases: string[];
  sortOrder: number;
  metadata: Record<string, unknown>;
}

export interface PublishedLeafField {
  key: string;
  groupKey: string | null;
  sortOrder: number;
  required: boolean;
  searchable: boolean;
  filterable: boolean;
  displayable: boolean;
  displaySurfaces: string[];
  labelAr: string;
  labelEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  placeholderAr: string | null;
  placeholderEn: string | null;
  fieldType: string;
  unitKey: string | null;
  optionSetKey: string | null;
  dataProviderKey: string | null;
  validation: Record<string, unknown>;
  defaultValue: unknown;
  sensitive: boolean;
  options: TaxonomyFieldOption[];
}

export interface PublishedLeafConditionalRule {
  id: string;
  triggerFieldKey: string;
  operator: string;
  triggerValue: unknown;
  targetFieldKey: string;
  effect: string;
  priority: number;
}

export interface PublishedLeafSchema {
  found: boolean;
  version: TaxonomyVersionMetadata | null;
  leaf: Pick<
    PublishedTaxonomyNode,
    | "id"
    | "parentId"
    | "slug"
    | "nameAr"
    | "nameEn"
    | "descriptionAr"
    | "descriptionEn"
    | "iconKey"
    | "filterSchemaKey"
    | "displaySchemaKey"
    | "classificationKey"
    | "classificationValue"
  > | null;
  fields: PublishedLeafField[];
  conditionalRules: PublishedLeafConditionalRule[];
}

export interface VehicleMakeMetadata {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  aliases: string[];
  countryCode: string | null;
  sortOrder: number;
}

export interface VehicleModelMetadata {
  id: string;
  makeId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  aliases: string[];
  vehicleType: string | null;
  startYear: number | null;
  endYear: number | null;
  sortOrder: number;
}

export interface VehicleGenerationMetadata {
  id: string;
  modelId: string;
  nameAr: string;
  nameEn: string;
  startYear: number | null;
  endYear: number | null;
  sortOrder: number;
}

export interface VehicleTrimMetadata {
  id: string;
  modelId: string;
  generationId: string | null;
  nameAr: string;
  nameEn: string;
  startYear: number | null;
  endYear: number | null;
  sortOrder: number;
}

export interface VehicleModelChildrenMetadata {
  found: boolean;
  model: {
    id: string;
    makeId: string;
    nameAr: string;
    nameEn: string;
  } | null;
  generations: VehicleGenerationMetadata[];
  trims: VehicleTrimMetadata[];
}

const METADATA_CACHE_TTL_MS = 5 * 60_000;
const REFERENCE_CACHE_TTL_MS = 10 * 60_000;
const metadataCache = new Map<string, { expiresAt: number; result: ClassifiedsResult<unknown> }>();
const metadataRequests = new Map<string, Promise<ClassifiedsResult<unknown>>>();

export function invalidateTaxonomyMetadataCache(): void {
  metadataCache.clear();
  metadataRequests.clear();
}

export function fetchPublishedTaxonomy(): Promise<ClassifiedsResult<PublishedTaxonomy>> {
  return cachedRequest("taxonomy:published", METADATA_CACHE_TTL_MS, async () => {
    const result = await cloudflareApiRequest<{ taxonomyNodes?: unknown[] }>("/v1/references");
    if (!result.ok) return apiFailure(result);
    return {
      ok: true,
      data: {
        version: null,
        nodes: records(result.data.taxonomyNodes).map(parseTaxonomyNode).filter(present),
      },
    };
  });
}

export function fetchPublishedLeafSchema(
  taxonomyNodeId: string,
): Promise<ClassifiedsResult<PublishedLeafSchema>> {
  const cleanNodeId = taxonomyNodeId.trim();
  if (!cleanNodeId) return Promise.resolve(validationFailure("تعذر تحديد القسم المطلوب."));

  return cachedRequest(`taxonomy:leaf:${cleanNodeId}`, METADATA_CACHE_TTL_MS, async () => {
    const result = await cloudflareApiRequest<unknown>(
      `/v1/taxonomy/leaf/${encodeURIComponent(cleanNodeId)}`,
    );
    if (!result.ok) return apiFailure(result);
    return { ok: true, data: parsePublishedLeafSchema(result.data) };
  });
}

export function fetchVehicleMakes(
  query?: string | null,
  limit = 100,
): Promise<ClassifiedsResult<VehicleMakeMetadata[]>> {
  const cleanQuery = query?.trim() ?? "";
  const cleanLimit = clampInteger(limit, 1, 200, 100);
  const cacheKey = `vehicle:makes:${cleanQuery.toLocaleLowerCase()}:${cleanLimit}`;

  return cachedRequest(cacheKey, REFERENCE_CACHE_TTL_MS, async () => {
    const params = new URLSearchParams({ limit: String(cleanLimit) });
    if (cleanQuery) params.set("q", cleanQuery);
    const result = await cloudflareApiRequest<unknown>(`/v1/vehicles/makes?${params.toString()}`);
    if (!result.ok) return apiFailure(result);
    return {
      ok: true,
      data: records(record(result.data).items).map(parseVehicleMake).filter(present),
    };
  });
}

export function fetchVehicleModels(
  makeId: string,
  options: { query?: string | null; year?: number | null; limit?: number } = {},
): Promise<ClassifiedsResult<VehicleModelMetadata[]>> {
  const cleanMakeId = makeId.trim();
  if (!cleanMakeId) return Promise.resolve(validationFailure("اختر شركة السيارة أولًا."));

  const cleanQuery = options.query?.trim() ?? "";
  const cleanYear = nullableInteger(options.year);
  const cleanLimit = clampInteger(options.limit, 1, 300, 200);
  const cacheKey = [
    "vehicle:models",
    cleanMakeId,
    cleanQuery.toLocaleLowerCase(),
    cleanYear ?? "all",
    cleanLimit,
  ].join(":");

  return cachedRequest(cacheKey, REFERENCE_CACHE_TTL_MS, async () => {
    const params = new URLSearchParams({ makeId: cleanMakeId, limit: String(cleanLimit) });
    if (cleanQuery) params.set("q", cleanQuery);
    if (cleanYear !== null) params.set("year", String(cleanYear));
    const result = await cloudflareApiRequest<unknown>(`/v1/vehicles/models?${params.toString()}`);
    if (!result.ok) return apiFailure(result);
    return {
      ok: true,
      data: records(record(result.data).items).map(parseVehicleModel).filter(present),
    };
  });
}

export function fetchVehicleModelChildren(
  modelId: string,
  year?: number | null,
): Promise<ClassifiedsResult<VehicleModelChildrenMetadata>> {
  const cleanModelId = modelId.trim();
  if (!cleanModelId) return Promise.resolve(validationFailure("اختر موديل السيارة أولًا."));

  const cleanYear = nullableInteger(year);
  const cacheKey = `vehicle:children:${cleanModelId}:${cleanYear ?? "all"}`;
  return cachedRequest(cacheKey, REFERENCE_CACHE_TTL_MS, async () => {
    const params = new URLSearchParams();
    if (cleanYear !== null) params.set("year", String(cleanYear));
    const suffix = params.size ? `?${params.toString()}` : "";
    const result = await cloudflareApiRequest<unknown>(
      `/v1/vehicles/models/${encodeURIComponent(cleanModelId)}/children${suffix}`,
    );
    if (!result.ok) return apiFailure(result);
    return { ok: true, data: parseVehicleModelChildren(result.data) };
  });
}

function apiFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: result.code as ClassifiedsErrorCode,
      message: result.error,
    },
  };
}

function cachedRequest<T>(
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<ClassifiedsResult<T>>,
): Promise<ClassifiedsResult<T>> {
  const cached = metadataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.result as ClassifiedsResult<T>);
  }

  const pending = metadataRequests.get(cacheKey);
  if (pending) return pending as Promise<ClassifiedsResult<T>>;

  const request = loader()
    .then((result) => {
      if (result.ok) {
        metadataCache.set(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          result: result as ClassifiedsResult<unknown>,
        });
      }
      return result;
    })
    .finally(() => metadataRequests.delete(cacheKey));

  metadataRequests.set(cacheKey, request as Promise<ClassifiedsResult<unknown>>);
  return request;
}

function parsePublishedTaxonomy(value: unknown): PublishedTaxonomy {
  const payload = record(value);
  return {
    version: parseVersion(payload.version),
    nodes: records(payload.nodes).map(parseTaxonomyNode).filter(present),
  };
}

function parsePublishedLeafSchema(value: unknown): PublishedLeafSchema {
  const payload = record(value);
  const leaf = parseTaxonomyNode(payload.leaf);
  return {
    found: bool(payload.found),
    version: parseVersion(payload.version),
    leaf: leaf
      ? {
          id: leaf.id,
          parentId: leaf.parentId,
          slug: leaf.slug,
          nameAr: leaf.nameAr,
          nameEn: leaf.nameEn,
          descriptionAr: leaf.descriptionAr,
          descriptionEn: leaf.descriptionEn,
          iconKey: leaf.iconKey,
          filterSchemaKey: leaf.filterSchemaKey,
          displaySchemaKey: leaf.displaySchemaKey,
          classificationKey: leaf.classificationKey,
          classificationValue: leaf.classificationValue,
        }
      : null,
    fields: records(payload.fields).map(parseLeafField).filter(present),
    conditionalRules: records(payload.conditionalRules).map(parseConditionalRule).filter(present),
  };
}

function parseVersion(value: unknown): TaxonomyVersionMetadata | null {
  const row = record(value);
  const id = text(row.id);
  const versionNumber = numeric(row.number);
  return id && versionNumber !== null
    ? { id, number: versionNumber, publishedAt: nullableText(row.publishedAt) }
    : null;
}

function parseTaxonomyNode(value: unknown): PublishedTaxonomyNode | null {
  const row = record(value);
  const id = text(row.id);
  const slug = text(row.slug);
  const nameAr = text(row.nameAr);
  if (!id || !slug || !nameAr) return null;

  return {
    id,
    parentId: nullableText(row.parentId),
    slug,
    nameAr,
    nameEn: nullableText(row.nameEn),
    descriptionAr: nullableText(row.descriptionAr),
    descriptionEn: nullableText(row.descriptionEn),
    iconKey: nullableText(row.iconKey),
    sortOrder: numeric(row.sortOrder) ?? 0,
    depth: numeric(row.depth) ?? 0,
    isLeaf: bool(row.isLeaf),
    filterSchemaKey: nullableText(row.filterSchemaKey),
    displaySchemaKey: nullableText(row.displaySchemaKey),
    classificationKey: nullableText(row.classificationKey),
    classificationValue: nullableText(row.classificationValue),
    legacyCategoryId: nullableText(row.legacyCategoryId),
    legacySubcategoryId: nullableText(row.legacySubcategoryId),
    seoTitleAr: nullableText(row.seoTitleAr),
    seoTitleEn: nullableText(row.seoTitleEn),
    seoDescriptionAr: nullableText(row.seoDescriptionAr),
    seoDescriptionEn: nullableText(row.seoDescriptionEn),
  };
}

function parseLeafField(value: unknown): PublishedLeafField | null {
  const row = record(value);
  const key = text(row.key);
  const labelAr = text(row.labelAr);
  const fieldType = text(row.fieldType);
  if (!key || !labelAr || !fieldType) return null;

  return {
    key,
    groupKey: nullableText(row.groupKey),
    sortOrder: numeric(row.sortOrder) ?? 0,
    required: bool(row.required),
    searchable: bool(row.searchable),
    filterable: bool(row.filterable),
    displayable: bool(row.displayable),
    displaySurfaces: textArray(row.displaySurfaces),
    labelAr,
    labelEn: nullableText(row.labelEn),
    descriptionAr: nullableText(row.descriptionAr),
    descriptionEn: nullableText(row.descriptionEn),
    placeholderAr: nullableText(row.placeholderAr),
    placeholderEn: nullableText(row.placeholderEn),
    fieldType,
    unitKey: nullableText(row.unitKey),
    optionSetKey: nullableText(row.optionSetKey),
    dataProviderKey: nullableText(row.dataProviderKey),
    validation: record(row.validation),
    defaultValue: row.defaultValue,
    sensitive: bool(row.sensitive),
    options: records(row.options).map(parseFieldOption).filter(present),
  };
}

function parseFieldOption(value: unknown): TaxonomyFieldOption | null {
  const row = record(value);
  const key = text(row.key);
  const labelAr = text(row.labelAr);
  if (!key || !labelAr) return null;
  return {
    key,
    labelAr,
    labelEn: nullableText(row.labelEn),
    aliases: textArray(row.aliases),
    sortOrder: numeric(row.sortOrder) ?? 0,
    metadata: record(row.metadata),
  };
}

function parseConditionalRule(value: unknown): PublishedLeafConditionalRule | null {
  const row = record(value);
  const id = text(row.id);
  const triggerFieldKey = text(row.triggerFieldKey);
  const operator = text(row.operator);
  const targetFieldKey = text(row.targetFieldKey);
  const effect = text(row.effect);
  if (!id || !triggerFieldKey || !operator || !targetFieldKey || !effect) return null;
  return {
    id,
    triggerFieldKey,
    operator,
    triggerValue: row.triggerValue,
    targetFieldKey,
    effect,
    priority: numeric(row.priority) ?? 0,
  };
}

function parseVehicleMake(value: unknown): VehicleMakeMetadata | null {
  const row = record(value);
  const id = text(row.id);
  const slug = text(row.slug);
  const nameAr = text(row.nameAr);
  const nameEn = text(row.nameEn);
  if (!id || !slug || !nameAr || !nameEn) return null;
  return {
    id,
    slug,
    nameAr,
    nameEn,
    aliases: textArray(row.aliases),
    countryCode: nullableText(row.countryCode),
    sortOrder: numeric(row.sortOrder) ?? 0,
  };
}

function parseVehicleModel(value: unknown): VehicleModelMetadata | null {
  const row = record(value);
  const id = text(row.id);
  const makeId = text(row.makeId);
  const slug = text(row.slug);
  const nameAr = text(row.nameAr);
  const nameEn = text(row.nameEn);
  if (!id || !makeId || !slug || !nameAr || !nameEn) return null;
  return {
    id,
    makeId,
    slug,
    nameAr,
    nameEn,
    aliases: textArray(row.aliases),
    vehicleType: nullableText(row.vehicleType),
    startYear: numeric(row.startYear),
    endYear: numeric(row.endYear),
    sortOrder: numeric(row.sortOrder) ?? 0,
  };
}

function parseVehicleModelChildren(value: unknown): VehicleModelChildrenMetadata {
  const payload = record(value);
  const modelRow = record(payload.model);
  const id = text(modelRow.id);
  const makeId = text(modelRow.makeId);
  const nameAr = text(modelRow.nameAr);
  const nameEn = text(modelRow.nameEn);
  const model = id && makeId && nameAr && nameEn ? { id, makeId, nameAr, nameEn } : null;

  return {
    found: bool(payload.found),
    model,
    generations: records(payload.generations).map(parseVehicleGeneration).filter(present),
    trims: records(payload.trims).map(parseVehicleTrim).filter(present),
  };
}

function parseVehicleGeneration(value: unknown): VehicleGenerationMetadata | null {
  const row = record(value);
  const id = text(row.id);
  const modelId = text(row.modelId);
  const nameAr = text(row.nameAr);
  const nameEn = text(row.nameEn);
  if (!id || !modelId || !nameAr || !nameEn) return null;
  return {
    id,
    modelId,
    nameAr,
    nameEn,
    startYear: numeric(row.startYear),
    endYear: numeric(row.endYear),
    sortOrder: numeric(row.sortOrder) ?? 0,
  };
}

function parseVehicleTrim(value: unknown): VehicleTrimMetadata | null {
  const row = record(value);
  const id = text(row.id);
  const modelId = text(row.modelId);
  const nameAr = text(row.nameAr);
  const nameEn = text(row.nameEn);
  if (!id || !modelId || !nameAr || !nameEn) return null;
  return {
    id,
    modelId,
    generationId: nullableText(row.generationId),
    nameAr,
    nameEn,
    startYear: numeric(row.startYear),
    endYear: numeric(row.endYear),
    sortOrder: numeric(row.sortOrder) ?? 0,
  };
}

function validationFailure<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableInteger(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function bool(value: unknown): boolean {
  return value === true;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = nullableInteger(value);
  if (parsed === null) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function present<T>(value: T | null): value is T {
  return value !== null;
}
