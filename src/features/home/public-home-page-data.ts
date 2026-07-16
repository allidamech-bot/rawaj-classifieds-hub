import {
  fetchPublicCategories,
  fetchPublicListings,
  fetchPublicTaxonomyNodes,
} from "@/lib/classifieds-api";
import {
  buildCanonicalHomeCategoryWorlds,
  buildLegacyHomeCategoryWorlds,
} from "@/features/home/home-category-discovery";

export async function loadPublicHomePageData() {
  const [listingsResult, taxonomyResult, categoriesResult] = await Promise.all([
    fetchPublicListings({}, null, 18),
    fetchPublicTaxonomyNodes(),
    fetchPublicCategories(),
  ]);

  const taxonomySchemaMissing =
    !taxonomyResult.ok && taxonomyResult.error.code === "schema_missing";
  const categoryWorlds = taxonomyResult.ok
    ? buildCanonicalHomeCategoryWorlds(taxonomyResult.data)
    : taxonomySchemaMissing && categoriesResult.ok
      ? buildLegacyHomeCategoryWorlds(categoriesResult.data)
      : [];

  return {
    listings: listingsResult.ok ? listingsResult.data.items : [],
    categoryWorlds,
    taxonomyAvailable: taxonomyResult.ok,
    legacyCategoryFallback: taxonomySchemaMissing,
    listingLoadFailed: !listingsResult.ok,
    categoryLoadFailed:
      (!taxonomyResult.ok && !taxonomySchemaMissing) ||
      (taxonomySchemaMissing && !categoriesResult.ok),
  };
}
