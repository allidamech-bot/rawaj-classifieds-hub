import type { SupabaseClient } from "@supabase/supabase-js";

import { getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { publicSupabase } from "@/lib/supabase";

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
const metadataCache = new Map<
  string,
  { expiresAt: number; result: ClassifiedsResult<unknown> }
>();
const metadataRequests = new Map<string, Promise<ClassifiedsResult<unknown>>>();

export function invalidateTaxonomyMetadataCache(): void {
  metadataCache.clear();
  metadataRequests.clear();
}

export function fetchPublishedTaxonomy(): Promise<ClassifiedsResult<PublishedTaxonomy>> {
  return cachedRequest(
    "taxonomy:published",
    METADATA_CACHE_TTL_MS,
    async () => {
      const result = await callPublicRpc("rawaj_fetch_published_taxonomy_v1");
      if (!result.ok) return result;
      return { ok: true, data: parsePublishedTaxonomy(result.data) };
    },
  );
}

export function fetchPublishedLeafSchema(
  taxonomyNodeId: string,
): Promise<ClassifiedsResult<PublishedLeafSchema>> {
  const cleanNodeId = taxonomyNodeId.trim();
  if (!cleanNodeId) return Promise.resolve(validationFailure("تعذر تحديد القسم المطلوب."));

  return cachedRequest(
    `taxonomy:leaf:${cleanNodeId}`,
    METADATA_CACHE_TTL_MS,
    async () => {
      const result = await callPublicRpc("rawaj_fetch_published_leaf_schema_v1", {
        p_taxonomy_node_id: cleanNodeId,
      });
      if (!result.ok) return result;
      return { ok: true, data: parsePublishedLeafSchema(result.data) };
    },
  );
}

export function fetchVehicleMakes(
  query?: string | null,
  limit = 100,
): Promise<ClassifiedsResult<VehicleMakeMetadata[]>> {
  const cleanQuery = query?.trim() ?? "";
  const cleanLimit = clampInteger(limit, 1, 200, 100);

  return cachedRequest(
    `vehicle:makes:${cleanQuery.toLocaleLowerCase()}:${cleanLimit}`,
    REFERENCE_CACHE_TTL_MS,
    async () => {
      const result = await callPublicRpc("rawaj_fetch_vehicle_makes_v1", {
        p_query: cleanQuery || null,
        p_limit: cleanLimit,
      });
      if (!result.ok) return result;
      const payload = asRecord(result.data);
      return {
        ok: true,
        data: asRecordArray(payload.items).map(parseVehicleMake).filter(isPresent),
      };
    },
  );
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

  return cachedRequest(
    `vehicle:models:${cleanMakeId}:${cleanQuery.toLocaleLowerCase()}:${cleanYear ?? "all"}:${cleanLimit}`,
    REFERENCE_CACHE_TTL_MS,
    async () => {
      const result = await callPublicRpc("rawaj_fetch_vehicle_models_v1", {
        p_make_id: cleanMakeId,
        p_query: cleanQuery || null,
        p_year: cleanYear,
        p_limit: cleanLimit,
      });
      if (!result.ok) return result;
      const payload = asRecord(result.data);
      return {
        ok: true,
        data: asRecordArray(payload.items).map(parseVehicleModel).filter(isPresent),
      };
    },
  );
}

export function fetchVehicleModelChildren(
  modelId: string,
  year?: number | null,
): Promise<ClassifiedsResult<VehicleModelChildrenMetadata>> {
  const cleanModelId = modelId.trim();
  if (!cleanModelId) return Promise.resolve(validationFailure("اختر موديل السيارة أولًا."));

  const cleanYear = nullableInteger(year);
  return cachedRequest(
    `vehicle:children:${cleanModelId}:${cleanYear ?? "all"}`,
    REFERENCE_CACHE_TTL_MS,
    async () => {
      const result = await callPublicRpc("rawaj_fetch_vehicle_model_children_v1", {
        p_model_id: cleanModelId,
        p_year: cleanYear,
      });
      if (!result.ok) return result;
      return { ok: true, data: parseVehicleModelChildren(result.data) };
    },
  );
}

async function callPublicRpc(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<ClassifiedsResult<unknown>> {
  const clientResult = getPublicClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(functionName, args);
  if (error) return { ok: false, error: mapError(error, functionName) };
  return { ok: true, data };
}

function getPublicClient(): ClassifiedsResult<SupabaseClient> {
  if (publicSupabase) return { ok: true, data: publicSupabase };
  return getClient();
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
  const payload = asRecord(value);
  return {
    version: parseVersion(payload.version),
    nodes: asRecordArray(payload.nodes).map(parseTaxonomyNode).filter(isPresent),
  };
}

function parsePublishedLeafSchema(value: unknown): PublishedLeafSchema {
  const payload = asRecord(value);
  const leaf = parseTaxonomyNode(payload.leaf);
  return {
    found: booleanValue(payload.found),
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
    fields: asRecordArray(payload.fields).map(parseLeafField).filter(isPresent),
    conditionalRules: asRecordArray(payload.conditionalRules)
      .map(parseConditionalRule)
      .filter(isPresent),
  };
}

function parseVersion(value: unknown): TaxonomyVersionMetadata | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const number = numberValue(row.number);
  if (!id || number === null) return null;
  return { id, number, publishedAt: nullableString(row.publishedAt) };
}

function parseTaxonomyNode(value: unknown): PublishedTaxonomyNode | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const slug = stringValue(row.slug);
  const nameAr = stringValue(row.nameAr);
  if (!id || !slug || !nameAr) return null;

  return {
    id,
    parentId: nullableString(row.parentId),
    slug,
    nameAr,
    nameEn: nullableString(row.nameEn),
    descriptionAr: nullableString(row.descriptionAr),
    descriptionEn: nullableString(row.descriptionEn),
    iconKey: nullableString(row.iconKey),
    sortOrder: numberValue(row.sortOrder) ?? 0,
    depth: numberValue(row.depth) ?? 0,
    isLeaf: booleanValue(row.isLeaf),
    filterSchemaKey: nullableString(row.filterSchemaKey),
    displaySchemaKey: nullableString(row.displaySchemaKey),
    classificationKey: nullableString(row.classificationKey),
    classificationValue: nullableString(row.classificationValue),
    legacyCategoryId: nullableString(row.legacyCategoryId),
    legacySubcategoryId: nullableString(row.legacySubcategoryId),
    seoTitleAr: nullableString(row.seoTitleAr),
    seoTitleEn: nullableString(row.seoTitleEn),
    seoDescriptionAr: nullableString(row.seoDescriptionAr),
    seoDescriptionEn: nullableString(row.seoDescriptionEn),
  };
}

function parseLeafField(value: unknown): PublishedLeafField | null {
  const row = asRecord(value);
  const key = stringValue(row.key);
  const labelAr = stringValue(row.labelAr);
  const fieldType = stringValue(row.fieldType);
  if (!key || !labelAr || !fieldType) return null;

  return {
    key,
    groupKey: nullableString(row.groupKey),
    sortOrder: numberValue(row.sortOrder) ?? 0,
    required: booleanValue(row.required),
    searchable: booleanValue(row.searchable),
    filterable: booleanValue(row.filterable),
    displayable: booleanValue(row.displayable),
    displaySurfaces: stringArray(row.displaySurfaces),
    labelAr,
    labelEn: nullableString(row.labelEn),
    descriptionAr: nullableString(row.descriptionAr),
    descriptionEn: nullableString(row.descriptionEn),
    placeholderAr: nullableString(row.placeholderAr),
    placeholderEn: nullableString(row.placeholderEn),
    fieldType,
    unitKey: nullableString(row.unitKey),
    optionSetKey: nullableString(row.optionSetKey),
    dataProviderKey: nullableString(row.dataProviderKey),
    validation: asRecord(row.validation),
    defaultValue: row.defaultValue,
    sensitive: booleanValue(row.sensitive),
    options: asRecordArray(row.options).map(parseFieldOption).filter(isPresent),
  };
}

function parseFieldOption(value: unknown): TaxonomyFieldOption | null {
  const row = asRecord(value);
  const key = stringValue(row.key);
  const labelAr = stringValue(row.labelAr);
  if (!key || !labelAr) return null;
  return {
    key,
    labelAr,
    labelEn: nullableString(row.labelEn),
    aliases: stringArray(row.aliases),
    sortOrder: numberValue(row.sortOrder) ?? 0,
    metadata: asRecord(row.metadata),
  };
}

function parseConditionalRule(value: unknown): PublishedLeafConditionalRule | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const triggerFieldKey = stringValue(row.triggerFieldKey);
  const operator = stringValue(row.operator);
  const targetFieldKey = stringValue(row.targetFieldKey);
  const effect = stringValue(row.effect);
  if (!id || !triggerFieldKey || !operator || !targetFieldKey || !effect) return null;
  return {
    id,
    triggerFieldKey,
    operator,
    triggerValue: row.triggerValue,
    targetFieldKey,
    effect,
    priority: numberValue(row.priority) ?? 0,
  };
}

function parseVehicleMake(value: unknown): VehicleMakeMetadata | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const slug = stringValue(row.slug);
  const nameAr = stringValue(row.nameAr);
  const nameEn = stringValue(row.nameEn);
  if (!id || !slug || !nameAr || !nameEn) return null;
  return {
    id,
    slug,
    nameAr,
    nameEn,
    aliases: stringArray(row.aliases),
    countryCode: nullableString(row.countryCode),
    sortOrder: numberValue(row.sortOrder) ?? 0,
  };
}

function parseVehicleModel(value: unknown): VehicleModelMetadata | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const makeId = stringValue(row.makeId);
  const slug = stringValue(row.slug);
  const nameAr = stringValue(row.nameAr);
  const nameEn = stringValue(row.nameEn);
  if (!id || !makeId || !slug || !nameAr || !nameEn) return null;
  return {
    id,
    makeId,
    slug,
    nameAr,
    nameEn,
    aliases: stringArray(row.aliases),
    vehicleType: nullableString(row.vehicleType),
    startYear: numberValue(row.startYear),
    endYear: numberValue(row.endYear),
    sortOrder: numberValue(row.sortOrder) ?? 0,
  };
}

function parseVehicleModelChildren(value: unknown): VehicleModelChildrenMetadata {
  const payload = asRecord(value);
  const modelRow = asRecord(payload.model);
  const modelId = stringValue(modelRow.id);
  const makeId = stringValue(modelRow.makeId);
  const nameAr = stringValue(modelRow.nameAr);
  const nameEn = stringValue(modelRow.nameEn);

  return {
    found: booleanValue(payload.found),
    model:
      modelId && makeId && nameAr && nameEn
        ? { id: modelId, makeId, nameAr, nameEn }
        : null,
    generations: asRecordArray(payload.generations)
      .map(parseVehicleGeneration)
      .filter(isPresent),
    trims: asRecordArray(payload.trims).map(parseVehicleTrim).filter(isPresent),
  };
}

function parseVehicleGeneration(value: unknown): VehicleGenerationMetadata | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const modelId = stringValue(row.modelId);
  const nameAr = stringValue(row.nameAr);
  const nameEn = stringValue(row.nameEn);
  if (!id || !modelId || !nameAr || !nameEn) return null;
  return {
    id,
    modelId,
    nameAr,
    nameEn,
    startYear: numberValue(row.startYear),
    endYear: numberValue(row.endYear),
    sortOrder: numberValue(row.sortOrder) ?? 0,
  };
}

function parseVehicleTrim(value: unknown): VehicleTrimMetadata | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const modelId = stringValue(row.modelId);
  const nameAr = stringValue(row.nameAr);
  const nameEn = stringValue(row.nameEn);
  if (!id || !modelId || !nameAr || !nameEn) return null;
  return {
    id,
    modelId,
    generationId: nullableString(row.generationId),
    nameAr,
    nameEn,
    startYear: numberValue(row.startYear),
    endYear: numberValue(row.endYear),
    sortOrder: numberValue(row.sortOrder) ?? 0,
  };
}

function validationFailure<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nullableInteger(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const parsed = nullableInteger(value);
  if (parsed === null) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
