import { useEffect, useRef, useState } from "react";
import { fetchPublicListings, searchPublicSellers } from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingCursor,
  PaginatedListingsResponse,
  PublicSellerSearchResult,
} from "@/lib/classifieds-types";
import { buildListingFilters, type ListingFilterInputs } from "./listings-filters";

export interface ListingsResultsInputs extends ListingFilterInputs {
  referencesLoaded: boolean;
  taxonomyAvailable: boolean;
  selectedTaxonomyNode: unknown;
  searchTaxonomy?: string;
  hasInvalidCategory: boolean;
  hasInvalidSubcategory: boolean;
  hasPriceContradiction: boolean;
}

export interface ListingsResults {
  items: ClassifiedListing[];
  sellerResults: PublicSellerSearchResult[];
  error: ClassifiedsError | null;
  sellerSearchError: ClassifiedsError | null;
  nextCursor: ListingCursor | null;
  loading: boolean;
  filterVersionRef: React.MutableRefObject<number>;
  setItems: React.Dispatch<React.SetStateAction<ClassifiedListing[]>>;
  setNextCursor: React.Dispatch<React.SetStateAction<ListingCursor | null>>;
  setError: React.Dispatch<React.SetStateAction<ClassifiedsError | null>>;
}

export function useListingsResults(inputs: ListingsResultsInputs): ListingsResults {
  const {
    referencesLoaded,
    taxonomyAvailable,
    selectedTaxonomyNode,
    searchTaxonomy,
    hasInvalidCategory,
    hasInvalidSubcategory,
    hasPriceContradiction,
    ...filterInputs
  } = inputs;

  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [sellerResults, setSellerResults] = useState<PublicSellerSearchResult[]>([]);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [sellerSearchError, setSellerSearchError] = useState<ClassifiedsError | null>(null);
  const [nextCursor, setNextCursor] = useState<ListingCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const filterVersionRef = useRef(0);

  useEffect(() => {
    if (!referencesLoaded) return;
    if (taxonomyAvailable && searchTaxonomy && !selectedTaxonomyNode) return;
    if (hasInvalidCategory) return;
    if (hasInvalidSubcategory) return;
    if (hasPriceContradiction) return;

    filterVersionRef.current += 1;
    const version = filterVersionRef.current;
    setNextCursor(null);
    setLoading(true);
    setError(null);
    setItems([]);

    let cancelled = false;

    async function loadListings() {
      const [result, sellerResult] = await Promise.all([
        fetchPublicListings(buildListingFilters(filterInputs), null, 30),
        searchPublicSellers(filterInputs.debouncedQ),
      ]);

      if (cancelled) return;
      if (version !== filterVersionRef.current) return;

      if (!result.ok) {
        setError(result.error);
        setItems([]);
        setNextCursor(null);
      } else {
        setItems(result.data.items);
        setNextCursor(result.data.nextCursor);
      }

      if (sellerResult.ok) {
        setSellerResults(sellerResult.data);
        setSellerSearchError(null);
      } else {
        setSellerResults([]);
        setSellerSearchError(sellerResult.error);
      }

      setLoading(false);
    }

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, [
    referencesLoaded,
    taxonomyAvailable,
    selectedTaxonomyNode,
    searchTaxonomy,
    hasInvalidCategory,
    hasInvalidSubcategory,
    hasPriceContradiction,
    filterInputs.selectedCategoryId,
    filterInputs.effectiveSubcategoryId,
    filterInputs.govId,
    filterInputs.districtAr,
    filterInputs.parsedPriceMin,
    filterInputs.parsedPriceMax,
    filterInputs.carMake,
    filterInputs.carModel,
    filterInputs.fuelType,
    filterInputs.transmission,
    filterInputs.propertyPurpose,
    filterInputs.propertyType,
    filterInputs.taxonomyOwnsPropertyPurpose,
    filterInputs.taxonomyOwnsPropertyType,
    filterInputs.taxonomyListingSearch?.taxonomyLegacySubcategoryId,
    filterInputs.taxonomyListingSearch?.property_purpose,
    filterInputs.taxonomyListingSearch?.property_type,
    filterInputs.rooms,
    filterInputs.rentalDuration,
    filterInputs.electronicsBrand,
    filterInputs.detailCondition,
    filterInputs.employmentType,
    filterInputs.salaryType,
    filterInputs.withPhotos,
    filterInputs.debouncedQ,
    filterInputs.sort,
  ]);

  return {
    items,
    sellerResults,
    error,
    sellerSearchError,
    nextCursor,
    loading,
    filterVersionRef,
    setItems,
    setNextCursor,
    setError,
  };
}
