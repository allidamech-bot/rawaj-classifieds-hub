import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  EmptyState,
  PageContainer,
  PageTransition,
} from "@/components/shell/spatial-primitives";
import { CategoryWorlds } from "@/features/home/CategoryWorlds";
import { DiscoveryHero } from "@/features/home/DiscoveryHero";
import { FeaturedListingShowcase } from "@/features/home/FeaturedListingShowcase";
import { HomeTrustStrip } from "@/features/home/HomeTrustStrip";
import { LatestDiscovery } from "@/features/home/LatestDiscovery";
import { fetchPublicCategories, fetchPublicListings } from "@/lib/classifieds-api";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

const HOME_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const HOME_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة منظمة وواضحة.";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [listingsResult, categoriesResult] = await Promise.all([
      fetchPublicListings({}, null, 18),
      fetchPublicCategories(),
    ]);

    return {
      listings: listingsResult.ok ? listingsResult.data.items : [],
      categories: categoriesResult.ok ? categoriesResult.data : [],
      listingLoadFailed: !listingsResult.ok,
    };
  },
  head: () => createSeo({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const { listings, categories, listingLoadFailed } = Route.useLoaderData();
  const [searchValue, setSearchValue] = useState("");

  const featuredListings = listings.filter((listing) => listing.isFeatured).slice(0, 4);
  const featuredListingIds = new Set(featuredListings.map((listing) => listing.id));
  const latestListings = listings
    .filter((listing) => !featuredListingIds.has(listing.id))
    .slice(0, 12);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchValue.trim();
    void navigate({ to: "/listings", search: q ? { q } : {} });
  }

  return (
    <>
      <AppHeader />
      <PageTransition>
        <PageContainer className="rawaj-home-v3 py-3 sm:py-5 lg:py-7">
          <DiscoveryHero
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            onSubmit={handleSearch}
            text={text}
          />

          <CategoryWorlds categories={categories} language={language} text={text} />

          {listingLoadFailed ? (
            <EmptyState
              className="rawaj-home-load-state"
              title={text("تعذر تحميل إعلانات السوق", "Marketplace listings could not be loaded")}
              description={text(
                "الأقسام ما زالت متاحة. حاول فتح السوق مرة أخرى بعد قليل.",
                "Categories remain available. Try opening the marketplace again shortly.",
              )}
            />
          ) : (
            <>
              {featuredListings.length > 0 ? (
                <FeaturedListingShowcase listings={featuredListings} />
              ) : null}
              <LatestDiscovery listings={latestListings} text={text} />
            </>
          )}

          <HomeTrustStrip text={text} />
        </PageContainer>
      </PageTransition>
    </>
  );
}
