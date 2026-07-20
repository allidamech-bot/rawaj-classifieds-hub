import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fetchPublicListings, searchPublicSellers } from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingCursor,
  PublicSellerSearchResult,
} from "@/lib/classifieds-types";
import { useFilterDraftSessionActive } from "@/features/search/filter-draft-session";
import { buildListingFilters, type ListingFilterInputs } from "./listings-filters";

const listingsRouteApi = getRouteApi("/listings");

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
  totalCount: number | null;
  loading: boolean;
  filterVersionRef: React.MutableRefObject<number>;
  setItems: React.Dispatch<React.SetStateAction<ClassifiedListing[]>>;
  setNextCursor: React.Dispatch<React.SetStateAction<ListingCursor | null>>;
  setError: React.Dispatch<React.SetStateAction<ClassifiedsError | null>>;
}

export function useListingsResults(inputs: ListingsResultsInputs): ListingsResults {
  const loaderData = listingsRouteApi.useLoaderData();
  const initialResults = loaderData.results;
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

  const [items, setItems] = useState<ClassifiedListing[]>(initialResults.items);
  const [sellerResults, setSellerResults] = useState<PublicSellerSearchResult[]>(
    initialResults.sellerResults,
  );
  const [error, setError] = useState<ClassifiedsError | null>(initialResults.error);
  const [sellerSearchError, setSellerSearchError] = useState<ClassifiedsError | null>(
    initialResults.sellerSearchError,
  );
  const [nextCursor, setNextCursor] = useState<ListingCursor | null>(initialResults.nextCursor);
  const [totalCount, setTotalCount] = useState<number | null>(initialResults.totalCount);
  const [loading, setLoading] = useState(false);
  const filterVersionRef = useRef(0);
  const lastCompletedFilterKeyRef = useRef<string | null>(initialResults.filterKey);
  const filterDraftActive = useFilterDraftSessionActive();

  useEffect(() => {
    filterVersionRef.current += 1;
    lastCompletedFilterKeyRef.current = initialResults.filterKey;
    setItems(initialResults.items);
    setSellerResults(initialResults.sellerResults);
    setError(initialResults.error);
    setSellerSearchError(initialResults.sellerSearchError);
    setNextCursor(initialResults.nextCursor);
    setTotalCount(initialResults.totalCount);
    setLoading(false);
  }, [initialResults]);

  useEffect(() => {
    if (filterDraftActive) return;
    if (!referencesLoaded) return;
    if (hasInvalidCategory) return;
    if (hasInvalidSubcategory) return;
    if (hasPriceContradiction) return;

    const filters = buildListingFilters(filterInputs);
    const filterKey = JSON.stringify(filters);
    if (lastCompletedFilterKeyRef.current === filterKey) return;

    filterVersionRef.current += 1;
    const version = filterVersionRef.current;
    setNextCursor(null);
    setTotalCount(null);
    setLoading(true);
    setError(null);
    setItems([]);

    let cancelled = false;

    async function loadListings() {
      const [result, sellerResult] = await Promise.all([
        fetchPublicListings(filters, null, 30),
        searchPublicSellers(filterInputs.debouncedQ),
      ]);

      if (cancelled) return;
      if (version !== filterVersionRef.current) return;

      if (!result.ok) {
        setError(result.error);
        setItems([]);
        setNextCursor(null);
        setTotalCount(null);
      } else {
        lastCompletedFilterKeyRef.current = filterKey;
        setItems(result.data.items);
        setNextCursor(result.data.nextCursor);
        setTotalCount(result.data.totalCount ?? null);
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
    filterDraftActive,
    referencesLoaded,
    taxonomyAvailable,
    selectedTaxonomyNode,
    searchTaxonomy,
    hasInvalidCategory,
    hasInvalidSubcategory,
    hasPriceContradiction,
    filterInputs.selectedCategoryId,
    filterInputs.taxonomyFilterScope,
    filterInputs.effectiveSubcategoryId,
    filterInputs.govId,
    filterInputs.districtAr,
    filterInputs.parsedPriceMin,
    filterInputs.parsedPriceMax,
    filterInputs.priceType,
    filterInputs.globalCondition,
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
    filterInputs.attributeFilters,
  ]);

  return {
    items,
    sellerResults,
    error,
    sellerSearchError,
    nextCursor,
    totalCount,
    loading,
    filterVersionRef,
    setItems,
    setNextCursor,
    setError,
  };
}
