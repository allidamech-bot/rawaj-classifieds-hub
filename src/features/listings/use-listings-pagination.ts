import { useCallback, useRef, useState } from "react";
import { fetchPublicListings } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError, ListingCursor } from "@/lib/classifieds-types";
import {
  isFilterDraftSessionActive,
  useFilterDraftSessionActive,
} from "@/features/search/filter-draft-session";
import { buildListingFilters, type ListingFilterInputs } from "./listings-filters";

export interface ListingsPaginationInputs extends ListingFilterInputs {
  nextCursor: ListingCursor | null;
  hasPriceContradiction: boolean;
  filterVersionRef: React.MutableRefObject<number>;
  onItems: (items: ClassifiedListing[]) => void;
  onCursor: (cursor: ListingCursor | null) => void;
  onError: (error: ClassifiedsError) => void;
}

export interface ListingsPagination {
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

export function useListingsPagination(inputs: ListingsPaginationInputs): ListingsPagination {
  const {
    nextCursor,
    hasPriceContradiction,
    filterVersionRef,
    onItems,
    onCursor,
    onError,
    selectedCategoryId,
    taxonomyFilterScope,
    effectiveSubcategoryId,
    taxonomyListingSearch,
    taxonomyOwnsPropertyPurpose,
    taxonomyOwnsPropertyType,
    propertyPurpose,
    propertyType,
    govId,
    districtAr,
    parsedPriceMin,
    parsedPriceMax,
    priceType,
    globalCondition,
    carMake,
    carModel,
    fuelType,
    transmission,
    rooms,
    rentalDuration,
    electronicsBrand,
    detailCondition,
    employmentType,
    salaryType,
    withPhotos,
    debouncedQ,
    sort,
  } = inputs;
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const filterDraftActive = useFilterDraftSessionActive();

  const loadMore = useCallback(async () => {
    if (filterDraftActive || isFilterDraftSessionActive()) return;
    if (!nextCursor || loadingMoreRef.current) return;
    if (hasPriceContradiction) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const activeVersion = filterVersionRef.current;

    const result = await fetchPublicListings(
      buildListingFilters({
        taxonomyFilterScope,
        selectedCategoryId,
        effectiveSubcategoryId,
        taxonomyListingSearch,
        taxonomyOwnsPropertyPurpose,
        taxonomyOwnsPropertyType,
        propertyPurpose,
        propertyType,
        govId,
        districtAr,
        parsedPriceMin,
        parsedPriceMax,
        priceType,
        globalCondition,
        carMake,
        carModel,
        fuelType,
        transmission,
        rooms,
        rentalDuration,
        electronicsBrand,
        detailCondition,
        employmentType,
        salaryType,
        withPhotos,
        debouncedQ,
        sort,
      }),
      nextCursor,
      30,
    );

    if (isFilterDraftSessionActive() || activeVersion !== filterVersionRef.current) {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    if (!result.ok) {
      onError(result.error);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    onItems(result.data.items);
    onCursor(result.data.nextCursor);
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, [
    filterDraftActive,
    nextCursor,
    hasPriceContradiction,
    filterVersionRef,
    onItems,
    onCursor,
    onError,
    selectedCategoryId,
    taxonomyFilterScope,
    effectiveSubcategoryId,
    taxonomyListingSearch?.taxonomyLegacySubcategoryId,
    govId,
    districtAr,
    parsedPriceMin,
    parsedPriceMax,
    priceType,
    globalCondition,
    carMake,
    carModel,
    fuelType,
    transmission,
    propertyPurpose,
    propertyType,
    taxonomyOwnsPropertyPurpose,
    taxonomyListingSearch?.property_purpose,
    taxonomyOwnsPropertyType,
    taxonomyListingSearch?.property_type,
    rooms,
    rentalDuration,
    electronicsBrand,
    detailCondition,
    employmentType,
    salaryType,
    withPhotos,
    debouncedQ,
    sort,
  ]);

  return { loadingMore, loadMore };
}
