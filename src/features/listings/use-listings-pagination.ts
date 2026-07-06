import { useCallback, useRef, useState } from "react";
import { fetchPublicListings } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError, ListingCursor } from "@/lib/classifieds-types";
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
    ...filterInputs
  } = inputs;
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    if (hasPriceContradiction) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const activeVersion = filterVersionRef.current;

    const result = await fetchPublicListings(buildListingFilters(filterInputs), nextCursor, 30);

    if (activeVersion !== filterVersionRef.current) {
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
    nextCursor,
    hasPriceContradiction,
    filterVersionRef,
    onItems,
    onCursor,
    onError,
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
    filterInputs.taxonomyListingSearch?.property_purpose,
    filterInputs.taxonomyOwnsPropertyType,
    filterInputs.taxonomyListingSearch?.property_type,
    filterInputs.rooms,
    filterInputs.rentalDuration,
    filterInputs.electronicsBrand,
    filterInputs.detailCondition,
    filterInputs.employmentType,
    filterInputs.salaryType,
    filterInputs.debouncedQ,
    filterInputs.sort,
  ]);

  return { loadingMore, loadMore };
}
