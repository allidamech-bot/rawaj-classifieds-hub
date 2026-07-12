import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedsResult,
  ClassifiedSubcategory,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import {
  getClient,
  mapError,
  rowArray,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
  normalizePlaceholder,
} from "@/lib/api/shared";

export function mapCategory(row: Record<string, unknown>): ClassifiedCategory {
  return {
    id: rowString(row, "id"),
    slug: rowString(row, "slug"),
    nameAr: rowString(row, "name_ar"),
    hintAr: rowNullableString(row, "hint_ar"),
    placeholder: normalizePlaceholder(rowString(row, "placeholder", "misc")),
    sortOrder: rowNumber(row, "sort_order"),
    isActive: rowBoolean(row, "is_active", true),
  };
}

export function mapGovernorate(row: Record<string, unknown>): ClassifiedGovernorate {
  return {
    id: rowString(row, "id"),
    slug: rowString(row, "slug"),
    nameAr: rowString(row, "name_ar"),
    districtsAr: rowArray(row, "districts_ar"),
    sortOrder: rowNumber(row, "sort_order"),
    isActive: rowBoolean(row, "is_active", true),
  };
}

export function mapSubcategory(row: Record<string, unknown>): ClassifiedSubcategory {
  return {
    id: rowString(row, "id"),
    categoryId: rowString(row, "category_id"),
    nameAr: rowString(row, "name_ar"),
    nameEn: rowNullableString(row, "name_en"),
    sortOrder: rowNumber(row, "sort_order"),
  };
}

export function mapTaxonomyNode(row: Record<string, unknown>): TaxonomyNode {
  return {
    id: rowString(row, "id"),
    parentId: rowNullableString(row, "parent_id"),
    slug: rowString(row, "slug"),
    nameAr: rowString(row, "name_ar"),
    nameEn: rowNullableString(row, "name_en"),
    descriptionAr: rowNullableString(row, "description_ar"),
    descriptionEn: rowNullableString(row, "description_en"),
    iconKey: rowNullableString(row, "icon_key"),
    sortOrder: rowNumber(row, "sort_order"),
    depth: rowNumber(row, "depth"),
    isActive: rowBoolean(row, "is_active", true),
    isLeaf: rowBoolean(row, "is_leaf"),
    filterSchemaKey: rowNullableString(row, "filter_schema_key"),
    classificationKey: rowNullableString(row, "classification_key"),
    classificationValue: rowNullableString(row, "classification_value"),
    legacyCategoryId: rowNullableString(row, "legacy_category_id"),
    legacySubcategoryId: rowNullableString(row, "legacy_subcategory_id"),
  };
}

async function enrichGovernoratesWithLocationPaths(
  client: SupabaseClient,
  governorates: ClassifiedGovernorate[],
): Promise<ClassifiedGovernorate[]> {
  const { data, error } = await client.rpc("rawaj_location_option_paths", { country: "SY" });
  if (error || !data) return governorates;

  const labelsByGovernorate = new Map<string, string[]>();
  for (const row of data as Record<string, unknown>[]) {
    const governorateId = rowString(row, "legacy_governorate_id");
    const label = rowString(row, "label_ar").trim();
    if (!governorateId || !label) continue;
    const current = labelsByGovernorate.get(governorateId) ?? [];
    if (!current.includes(label)) current.push(label);
    labelsByGovernorate.set(governorateId, current);
  }

  return governorates.map((governorate) => {
    const canonicalLabels = labelsByGovernorate.get(governorate.id) ?? [];
    return canonicalLabels.length === 0
      ? governorate
      : {
          ...governorate,
          districtsAr: [...new Set([...canonicalLabels, ...governorate.districtsAr])],
        };
  });
}

interface PublicReferenceCacheEntry<T> {
  expiresAt: number;
  promise: Promise<ClassifiedsResult<T>>;
}

const publicReferenceCacheTtlMs = 5 * 60 * 1000;
const publicCategoryCache = new WeakMap<
  SupabaseClient,
  PublicReferenceCacheEntry<ClassifiedCategory[]>
>();
const publicGovernorateCache = new WeakMap<
  SupabaseClient,
  PublicReferenceCacheEntry<ClassifiedGovernorate[]>
>();

async function readCachedPublicReference<T>(
  client: SupabaseClient,
  cache: WeakMap<SupabaseClient, PublicReferenceCacheEntry<T>>,
  loader: () => Promise<ClassifiedsResult<T>>,
): Promise<ClassifiedsResult<T>> {
  const now = Date.now();
  const cached = cache.get(client);
  if (cached && cached.expiresAt > now) return cached.promise;

  const entry: PublicReferenceCacheEntry<T> = {
    expiresAt: now + publicReferenceCacheTtlMs,
    promise: loader(),
  };
  cache.set(client, entry);

  try {
    const result = await entry.promise;
    if (!result.ok && cache.get(client) === entry) cache.delete(client);
    return result;
  } catch (error) {
    if (cache.get(client) === entry) cache.delete(client);
    throw error;
  }
}

async function loadPublicCategories(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapCategory) };
}

async function readPublicCategories(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  return readCachedPublicReference(client, publicCategoryCache, () => loadPublicCategories(client));
}

async function loadPublicGovernorates(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedGovernorate[]>> {
  const { data, error } = await client
    .from("governorates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return { ok: false, error: mapError(error) };
  const governorates = ((data ?? []) as Record<string, unknown>[]).map(mapGovernorate);
  return {
    ok: true,
    data: await enrichGovernoratesWithLocationPaths(client, governorates),
  };
}

async function readPublicGovernorates(
  client: SupabaseClient,
): Promise<ClassifiedsResult<ClassifiedGovernorate[]>> {
  return readCachedPublicReference(client, publicGovernorateCache, () =>
    loadPublicGovernorates(client),
  );
}

export async function readReferences(client: SupabaseClient) {
  const [categoriesResult, governoratesResult] = await Promise.all([
    readPublicCategories(client),
    readPublicGovernorates(client),
  ]);
  if (!categoriesResult.ok) return categoriesResult;
  if (!governoratesResult.ok) return governoratesResult;
  return {
    ok: true as const,
    categories: categoriesResult.data,
    governorates: governoratesResult.data,
  };
}

export async function fetchPublicCategories(): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  return readPublicCategories(clientResult.data);
}

export async function fetchPublicSubcategories(): Promise<
  ClassifiedsResult<ClassifiedSubcategory[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data
    .from("subcategories")
    .select("*")
    .order("sort_order");
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapSubcategory) };
}

export async function fetchPublicTaxonomyNodes(): Promise<ClassifiedsResult<TaxonomyNode[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data
    .from("taxonomy_nodes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name_ar", { ascending: true });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapTaxonomyNode) };
}

export async function fetchPublicGovernorates(): Promise<
  ClassifiedsResult<ClassifiedGovernorate[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  return readPublicGovernorates(clientResult.data);
}
