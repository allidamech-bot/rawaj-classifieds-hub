import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export function useListingsReferences(search: ListingsSearch): ListingsReferences {
  const { references } = listingsRouteApi.useLoaderData();
  const [govId, setGovId] = useState(() => resolveGovernorateId(references.governorates, search.gov));

  useEffect(() => {
    setGovId(resolveGovernorateId(references.governorates, search.gov));
  }, [references.governorates, search.gov]);

  return {
    categories: references.categories,
    subcategories: references.subcategories,
    governorates: references.governorates,
    taxonomyNodes: references.taxonomyNodes,
    taxonomyAvailable: references.taxonomyAvailable,
    referencesLoaded: !references.error,
    govId,
    setGovId,
    error: references.error,
    loading: false,
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
