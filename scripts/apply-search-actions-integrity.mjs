import { readFile, rm, writeFile } from "node:fs/promises";

async function replace(path, pattern, replacement, label) {
  const source = await readFile(path, "utf8");
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected one match, found ${matches.length}`);
  await writeFile(path, source.replace(pattern, replacement));
}

await replace(
  "src/features/listings/use-listings-results.ts",
  /    async function loadListings\(\) \{[\s\S]*?\n    \}\n\n    void loadListings\(\);/,
  `    async function loadListings() {
      try {
        const [result, sellerResult] = await Promise.all([
          fetchPublicListings(filters, null, 30),
          searchPublicSellers(filterInputs.debouncedQ),
        ]);

        if (cancelled || version !== filterVersionRef.current) return;

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
      } catch (caught) {
        if (cancelled || version !== filterVersionRef.current) return;
        setItems([]);
        setNextCursor(null);
        setTotalCount(null);
        setSellerResults([]);
        setError({
          code: "unknown",
          message: caught instanceof Error ? caught.message : "تعذر تحميل نتائج البحث.",
          operation: "listings_search_load",
        });
      } finally {
        if (!cancelled && version === filterVersionRef.current) setLoading(false);
      }
    }

    void loadListings();`,
  "search result lifecycle",
);

await replace(
  "src/features/listings/use-listings-pagination.ts",
  /  const loadMore = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/,
  `  const loadMore = useCallback(async () => {
    if (filterDraftActive || isFilterDraftSessionActive()) return;
    if (!nextCursor || loadingMoreRef.current || hasPriceContradiction) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const activeVersion = filterVersionRef.current;

    try {
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
          attributeFilters,
        }),
        nextCursor,
        30,
      );

      if (isFilterDraftSessionActive() || activeVersion !== filterVersionRef.current) return;
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onItems(result.data.items);
      onCursor(result.data.nextCursor);
    } catch (caught) {
      if (!isFilterDraftSessionActive() && activeVersion === filterVersionRef.current) {
        onError({
          code: "unknown",
          message: caught instanceof Error ? caught.message : "تعذر تحميل المزيد من النتائج.",
          operation: "listings_search_load_more",
        });
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [`,
  "search pagination lifecycle",
);

await rm("scripts/apply-search-actions-integrity.mjs", { force: true });
