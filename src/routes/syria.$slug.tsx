import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { MarketplaceLandingPage } from "@/features/seo/MarketplaceLandingPage";
import { requirePublicMarketplaceLandingData } from "@/lib/api/marketplace-landing-load-guard";
import { fetchPublicGovernorates, fetchPublicListings } from "@/lib/classifieds-api";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/syria/$slug")({
  loader: async ({ params }) => {
    const governorates = requirePublicMarketplaceLandingData(
      await fetchPublicGovernorates(),
      "public_governorates_read",
    );
    const governorate = governorates.find((item) => item.slug === params.slug && item.isActive);
    if (!governorate) throw notFound();

    const listings = requirePublicMarketplaceLandingData(
      await fetchPublicListings({ governorateId: governorate.id }, null, 12),
      "public_governorate_listings_read",
    );
    return {
      governorate,
      listings: listings.items,
    };
  },
  head: ({ loaderData }) =>
    createSeo({
      title: loaderData
        ? `إعلانات ${loaderData.governorate.nameAr} | RAWAJ / رواج`
        : "محافظة غير متاحة | RAWAJ / رواج",
      description: loaderData
        ? `تصفح أحدث الإعلانات المعتمدة في محافظة ${loaderData.governorate.nameAr} على رواج، من العقارات والسيارات إلى المنتجات والخدمات.`
        : "هذه المحافظة غير متاحة على رواج.",
      path: loaderData ? `/syria/${loaderData.governorate.slug}` : "/listings",
      noindex: !loaderData,
    }),
  component: GovernorateLandingPage,
});

function GovernorateLandingPage() {
  const { governorate, listings } = Route.useLoaderData();
  const { text } = useUiPreferences();
  const titleEn = governorate.slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <>
      <PageHeader title={text(governorate.nameAr, titleEn)} to="/listings" />
      <MarketplaceLandingPage
        kind="governorate"
        titleAr={`إعلانات ${governorate.nameAr}`}
        titleEn={`Listings in ${titleEn}`}
        descriptionAr={`تصفح أحدث الإعلانات المنشورة في محافظة ${governorate.nameAr} على رواج، وابحث ضمن العقارات والسيارات والمنتجات والخدمات المحلية.`}
        descriptionEn={`Browse the latest marketplace listings in ${titleEn}, including property, vehicles, products, and local services.`}
        listings={listings}
        browseSearch={{ governorate: governorate.id }}
      />
    </>
  );
}
