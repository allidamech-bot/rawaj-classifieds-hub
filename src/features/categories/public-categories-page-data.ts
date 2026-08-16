import "../../listings-results.css";
import "../../search-filters-v1.css";
import "../../search-filters-v2.css";
import {
  fetchPublicCategories,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedsError,
  ClassifiedSubcategory,
  TaxonomyNode,
} from "@/lib/classifieds-types";

export interface PublicCategoriesPageData {
  taxonomyNodes: TaxonomyNode[];
  taxonomyAvailable: boolean;
  categories: ClassifiedCategory[];
  subcategories: ClassifiedSubcategory[];
  error: ClassifiedsError | null;
}

export async function loadPublicCategoriesPageData(): Promise<PublicCategoriesPageData> {
  const [taxonomyResult, categoriesResult, subcategoriesResult] = await Promise.all([
    fetchPublicTaxonomyNodes(),
    fetchPublicCategories(),
    fetchPublicSubcategories(),
  ]);

  const taxonomyAvailable = taxonomyResult.ok && taxonomyResult.data.length > 0;
  const categoryError = !categoriesResult.ok
    ? categoriesResult.error
    : !subcategoriesResult.ok
      ? subcategoriesResult.error
      : null;
  const taxonomyError =
    !taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing"
      ? taxonomyResult.error
      : null;

  return {
    taxonomyNodes: taxonomyAvailable ? taxonomyResult.data : [],
    taxonomyAvailable,
    categories: categoriesResult.ok ? categoriesResult.data : [],
    subcategories: subcategoriesResult.ok ? subcategoriesResult.data : [],
    error: taxonomyAvailable ? null : (categoryError ?? taxonomyError),
  };
}
