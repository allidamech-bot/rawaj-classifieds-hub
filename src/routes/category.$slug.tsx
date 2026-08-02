import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { MarketplaceLandingPage } from "@/features/seo/MarketplaceLandingPage";
import {
  fetchPublicCategories,
  fetchPublicListings,
  fetchPublicTaxonomyNodes,
} from "@/lib/classifieds-api";
import { requirePublicMarketplaceLandingData } from "@/lib/api/marketplace-landing-load-guard";
import { createSeo } from "@/lib/seo";
import {
  buildTaxonomyIndex,
  findLegacyCategoryTaxonomyNode,
  getTaxonomyPath,
  resolveTaxonomyListingSearch,
  taxonomyListingUrlSearch,
} from "@/lib/taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const [categoriesResult, taxonomyResult] = await Promise.all([
      fetchPublicCategories(),
      fetchPublicTaxonomyNodes(),
    ]);
    const categories = requirePublicMarketplaceLandingData(
      categoriesResult,
      "public_categories_read",
    );
    const category = categories.find((item) => item.slug === params.slug && item.isActive);
    if (!category) throw notFound();

    if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
      requirePublicMarketplaceLandingData(taxonomyResult, "public_taxonomy_read");
    }
    const taxonomyIndex = buildTaxonomyIndex(taxonomyResult.ok ? taxonomyResult.data : []);
    const taxonomyNode = findLegacyCategoryTaxonomyNode(taxonomyIndex, category.id);
    const taxonomyPath = getTaxonomyPath(taxonomyIndex, taxonomyNode);
    const taxonomySearch =
      taxonomyNode && taxonomyPath.length > 0
        ? resolveTaxonomyListingSearch(taxonomyNode, taxonomyPath)
        : null;
    const listingFilters = taxonomyNode
      ? { taxonomyNodeId: taxonomyNode.id, categoryId: category.id }
      : { categoryId: category.id };
    const listings = requirePublicMarketplaceLandingData(
      await fetchPublicListings(listingFilters, null, 12),
      "public_category_listings_read",
    );
    return {
      category,
      listings: listings.items,
      browseSearch: taxonomySearch
        ? taxonomyListingUrlSearch(taxonomySearch)
        : { category: category.id },
    };
  },
  head: ({ loaderData }) =>
    createSeo({
      title: loaderData
        ? `${loaderData.category.nameAr} للبيع في السعودية | RAWAJ / رواج`
        : "قسم غير متاح | RAWAJ / رواج",
      description: loaderData
        ? `تصفح أحدث إعلانات ${loaderData.category.nameAr} المعتمدة في السعودية على رواج، واعرض إعلانك مجاناً.`
        : "هذا القسم غير متاح على رواج.",
      path: loaderData ? `/category/${loaderData.category.slug}` : "/categories",
      noindex: !loaderData,
    }),
  component: CategoryLandingPage,
});

function CategoryLandingPage() {
  const { category, listings, browseSearch } = Route.useLoaderData();
  const { text } = useUiPreferences();
  const titleEn = category.slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <>
      <PageHeader title={text(category.nameAr, titleEn)} to="/categories" />
      <MarketplaceLandingPage
        kind="category"
        titleAr={`إعلانات ${category.nameAr} في السعودية`}
        titleEn={`${titleEn} listings in Saudi Arabia`}
        descriptionAr={`اكتشف أحدث إعلانات ${category.nameAr} المنشورة والمعتمدة على رواج، وقارن الخيارات ثم تواصل مباشرة مع المعلن.`}
        descriptionEn={`Discover the latest verified ${titleEn.toLowerCase()} listings on RAWAJ and contact advertisers directly.`}
        listings={listings}
        browseSearch={browseSearch}
      />
    </>
  );
}
