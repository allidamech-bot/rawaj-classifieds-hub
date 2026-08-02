import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

const listingsRouteApi = getRouteApi("/listings");

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

interface BrowserReferenceRecovery {
  categories: ClassifiedCategory[];
  subcategories: ClassifiedSubcategory[];
  governorates: ClassifiedGovernorate[];
  taxonomyNodes: TaxonomyNode[];
  error: ClassifiedsError | null;
}

export function useListingsReferences(search: ListingsSearch): ListingsReferences {
  const { references } = listingsRouteApi.useLoaderData();
  const needsBrowserRecovery =
    Boolean(references.error) ||
    (references.categories.length === 0 && references.governorates.length === 0);
  const [browserRecovery, setBrowserRecovery] = useState<BrowserReferenceRecovery | null>(null);
  const [recovering, setRecovering] = useState(needsBrowserRecovery);

  useEffect(() => {
    if (!needsBrowserRecovery) {
      setBrowserRecovery(null);
      setRecovering(false);
      return;
    }

    let active = true;
    setRecovering(true);

    void Promise.all([
      fetchPublicCategories(),
      fetchPublicSubcategories(),
      fetchPublicGovernorates(),
      fetchPublicTaxonomyNodes(),
    ]).then(([categoriesResult, subcategoriesResult, governoratesResult, taxonomyResult]) => {
      if (!active) return;

      const requiredError = !categoriesResult.ok
        ? categoriesResult.error
        : !subcategoriesResult.ok
          ? subcategoriesResult.error
          : !governoratesResult.ok
            ? governoratesResult.error
            : null;

      setBrowserRecovery({
        categories: categoriesResult.ok ? categoriesResult.data : [],
        subcategories: subcategoriesResult.ok ? subcategoriesResult.data : [],
        governorates: governoratesResult.ok ? governoratesResult.data : [],
        taxonomyNodes: taxonomyResult.ok ? taxonomyResult.data : [],
        error: requiredError,
      });
      setRecovering(false);
    });

    return () => {
      active = false;
    };
  }, [needsBrowserRecovery]);

  const effectiveReferences = useMemo(
    () =>
      browserRecovery ?? {
        categories: references.categories,
        subcategories: references.subcategories,
        governorates: references.governorates,
        taxonomyNodes: references.taxonomyNodes,
        error: references.error,
      },
    [browserRecovery, references],
  );
  const [govId, setGovId] = useState(() =>
    resolveGovernorateId(effectiveReferences.governorates, search.gov),
  );

  useEffect(() => {
    setGovId(resolveGovernorateId(effectiveReferences.governorates, search.gov));
  }, [effectiveReferences.governorates, search.gov]);

  return {
    categories: effectiveReferences.categories,
    subcategories: effectiveReferences.subcategories,
    governorates: effectiveReferences.governorates,
    taxonomyNodes: effectiveReferences.taxonomyNodes,
    taxonomyAvailable: effectiveReferences.taxonomyNodes.length > 0,
    referencesLoaded: !recovering && !effectiveReferences.error,
    govId,
    setGovId,
    error: effectiveReferences.error,
    loading: recovering,
  };
}

function resolveGovernorateId(governorates: ClassifiedGovernorate[], searchValue?: string) {
  if (!searchValue) return "";
  return (
    governorates.find(
      (governorate) => governorate.id === searchValue || governorate.slug === searchValue,
    )?.id ?? ""
  );
}
