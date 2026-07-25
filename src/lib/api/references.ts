import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedsResult,
  ClassifiedSubcategory,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import {
  rowArray,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
  normalizePlaceholder,
} from "@/lib/api/shared";
import { fetchCloudflareReferences } from "@/lib/public-data/cloudflare-client";

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

/**
 * Compatibility signature for callers that previously passed a database client.
 * The argument is deliberately ignored: references always come from Cloudflare.
 */
export async function readReferences(_retiredClient?: unknown) {
  const result = await fetchCloudflareReferences();
  if (!result.ok) return result;
  return {
    ok: true as const,
    categories: result.data.categories,
    governorates: result.data.governorates,
  };
}

export async function fetchPublicCategories(): Promise<ClassifiedsResult<ClassifiedCategory[]>> {
  const result = await fetchCloudflareReferences();
  return result.ok ? { ok: true, data: result.data.categories } : result;
}

export async function fetchPublicSubcategories(): Promise<
  ClassifiedsResult<ClassifiedSubcategory[]>
> {
  const result = await fetchCloudflareReferences();
  return result.ok ? { ok: true, data: result.data.subcategories } : result;
}

export async function fetchPublicTaxonomyNodes(): Promise<ClassifiedsResult<TaxonomyNode[]>> {
  const result = await fetchCloudflareReferences();
  return result.ok ? { ok: true, data: result.data.taxonomyNodes } : result;
}

export async function fetchPublicGovernorates(): Promise<
  ClassifiedsResult<ClassifiedGovernorate[]>
> {
  const result = await fetchCloudflareReferences();
  return result.ok ? { ok: true, data: result.data.governorates } : result;
}
