import { useEffect, useMemo, useRef, useState } from "react";
import type { ClassifiedsError } from "@/lib/classifieds-types";
import { fetchPublicListingFacets, type ListingFacetsResult } from "@/lib/api/listing-facets";
import type { ListingAttributeFilters } from "@/features/listings/listing-attribute-filter-state";

interface UseListingFacetsInputs {
  enabled: boolean;
  taxonomyNodeIds?: string[];
  attributeFilters: ListingAttributeFilters;
  governorateId?: string;
  priceMin?: number;
  priceMax?: number;
  query?: string;
}

interface FacetCacheEntry {
  data: ListingFacetsResult;
  expiresAt: number;
}

const FACET_CACHE_TTL_MS = 30_000;
const FACET_CACHE_MAX_ENTRIES = 50;
const facetCache = new Map<string, FacetCacheEntry>();

const emptyFacets: ListingFacetsResult = {
  taxonomyVersionId: null,
  totalCount: 0,
  facets: [],
};

function readCachedFacets(requestKey: string): ListingFacetsResult | null {
  const cached = facetCache.get(requestKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    facetCache.delete(requestKey);
    return null;
  }
  facetCache.delete(requestKey);
  facetCache.set(requestKey, cached);
  return cached.data;
}

function cacheFacets(requestKey: string, data: ListingFacetsResult) {
  facetCache.set(requestKey, {
    data,
    expiresAt: Date.now() + FACET_CACHE_TTL_MS,
  });
  while (facetCache.size > FACET_CACHE_MAX_ENTRIES) {
    const oldestKey = facetCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    facetCache.delete(oldestKey);
  }
}

export function useListingFacets(inputs: UseListingFacetsInputs) {
  const [data, setData] = useState<ListingFacetsResult>(emptyFacets);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [loading, setLoading] = useState(false);
  const requestVersionRef = useRef(0);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        enabled: inputs.enabled,
        taxonomyNodeIds: inputs.taxonomyNodeIds ?? [],
        attributeFilters: inputs.attributeFilters,
        governorateId: inputs.governorateId ?? "",
        priceMin: inputs.priceMin,
        priceMax: inputs.priceMax,
        query: inputs.query?.trim() ?? "",
      }),
    [
      inputs.attributeFilters,
      inputs.enabled,
      inputs.governorateId,
      inputs.priceMax,
      inputs.priceMin,
      inputs.query,
      inputs.taxonomyNodeIds,
    ],
  );

  useEffect(() => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    if (!inputs.enabled) {
      setData(emptyFacets);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = readCachedFacets(requestKey);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void fetchPublicListingFacets({
      taxonomyNodeIds: inputs.taxonomyNodeIds,
      attributeFilters: inputs.attributeFilters,
      governorateId: inputs.governorateId,
      priceMin: inputs.priceMin,
      priceMax: inputs.priceMax,
      query: inputs.query,
    }).then((result) => {
      if (requestVersionRef.current !== requestVersion) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      cacheFacets(requestKey, result.data);
      setData(result.data);
    });
  }, [requestKey]);

  return { data, error, loading };
}
