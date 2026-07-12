import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { MarketplaceLandingPage } from "@/features/seo/MarketplaceLandingPage";
import { fetchPublicCategories, fetchPublicListings } from "@/lib/classifieds-api";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const categoriesResult = await fetchPublicCategories();
    if (!categoriesResult.ok) throw notFound();
    const category = categoriesResult.data.find(
      (item) => item.slug === params.slug && item.isActive,
    );
    if (!category) throw notFound();

    const listingsResult = await fetchPublicListings({ categoryId: category.id }, null, 12);
    return {
      category,
      listings: listingsResult.ok ? listingsResult.data.items : [],
    };
  },
  head: ({ loaderData }) =>
    createSeo({
      title: loaderData
        ? `${loaderData.category.nameAr} للبيع في سوريا | RAWAJ / رواج`
        : "قسم غير متاح | RAWAJ / رواج",
      description: loaderData
        ? `تصفح أحدث إعلانات ${loaderData.category.nameAr} المعتمدة في سوريا على رواج، واعرض إعلانك مجاناً.`
        : "هذا القسم غير متاح على رواج.",
      path: loaderData ? `/category/${loaderData.category.slug}` : "/categories",
      noindex: !loaderData,
    }),
  component: CategoryLandingPage,
});

function CategoryLandingPage() {
  const { category, listings } = Route.useLoaderData();
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
        titleAr={`إعلانات ${category.nameAr} في سوريا`}
        titleEn={`${titleEn} listings in Syria`}
        descriptionAr={`اكتشف أحدث إعلانات ${category.nameAr} المنشورة والمعتمدة على رواج، وقارن الخيارات ثم تواصل مباشرة مع المعلن.`}
        descriptionEn={`Discover the latest verified ${titleEn.toLowerCase()} listings on RAWAJ and contact advertisers directly.`}
        listings={listings}
        browseSearch={{ category: category.slug }}
      />
    </>
  );
}
