import { useEffect, useState } from "react";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedSubcategory,
  ClassifiedsError,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import type { ListingsSearch } from "./listings-search-schema";

export interface ListingsReferences {
  categories: ClassifiedCategory[];
  subcategories: ClassifiedSubcategory[];
  governorates: ClassifiedGovernorate[];
  taxonomyNodes: TaxonomyNode[];
  taxonomyAvailable: boolean;
  referencesLoaded: boolean;
  govId: string;
  setGovId: (value: string) => void;
  error: ClassifiedsError | null;
  loading: boolean;
}

export function useListingsReferences(search: ListingsSearch): ListingsReferences {
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [taxonomyAvailable, setTaxonomyAvailable] = useState(false);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [govId, setGovId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReferences() {
      setLoading(true);
      setError(null);

      const [categoriesResult, subcategoriesResult, governoratesResult, taxonomyResult] =
        await Promise.all([
          fetchPublicCategories(),
          fetchPublicSubcategories(),
          fetchPublicGovernorates(),
          fetchPublicTaxonomyNodes(),
        ]);

      if (cancelled) return;

      if (!categoriesResult.ok) {
        setError(categoriesResult.error);
        setLoading(false);
        return;
      }

      if (!subcategoriesResult.ok) {
        setError(subcategoriesResult.error);
        setLoading(false);
        return;
      }

      if (!governoratesResult.ok) {
        setError(governoratesResult.error);
        setLoading(false);
        return;
      }

      if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
        setError(taxonomyResult.error);
        setLoading(false);
        return;
      }

      setCategories(categoriesResult.data);
      setSubcategories(subcategoriesResult.data);
      setGovernorates(governoratesResult.data);
      setTaxonomyNodes(taxonomyResult.ok ? taxonomyResult.data : []);
      setTaxonomyAvailable(taxonomyResult.ok);
      setReferencesLoaded(true);
      setLoading(false);
    }

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!referencesLoaded) return;
    const selected = search.gov
      ? governorates.find((gov) => gov.id === search.gov || gov.slug === search.gov)
      : undefined;
    setGovId(selected?.id ?? "");
  }, [governorates, referencesLoaded, search.gov]);

  return {
    categories,
    subcategories,
    governorates,
    taxonomyNodes,
    taxonomyAvailable,
    referencesLoaded,
    govId,
    setGovId,
    error,
    loading,
  };
}
