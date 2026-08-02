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

  const taxonomyAvailable = taxonomyResult.ok && taxonomyResult.data.length > 0;
  const legacyCategoryFallback = !taxonomyAvailable && categoriesResult.ok;
  const categoryWorlds = taxonomyAvailable
    ? buildCanonicalHomeCategoryWorlds(taxonomyResult.data)
    : legacyCategoryFallback
      ? buildLegacyHomeCategoryWorlds(categoriesResult.data)
      : [];

  return {
    listings: listingsResult.ok ? listingsResult.data.items : [],
    categoryWorlds,
    taxonomyAvailable,
    legacyCategoryFallback,
    listingLoadFailed: !listingsResult.ok,
    categoryLoadFailed: !taxonomyAvailable && !categoriesResult.ok,
  };
}
