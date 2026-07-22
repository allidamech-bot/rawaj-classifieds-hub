import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState, PageContainer, PageTransition } from "@/components/shell/spatial-primitives";
import { Button } from "@/components/ui/button";
import { CategoryWorlds } from "@/features/home/CategoryWorlds";
import { DiscoveryHero } from "@/features/home/DiscoveryHero";
import { FeaturedListingShowcase } from "@/features/home/FeaturedListingShowcase";
import { HomeTrustStrip } from "@/features/home/HomeTrustStrip";
import { LatestDiscovery } from "@/features/home/LatestDiscovery";
import { selectDiverseListings } from "@/features/home/home-listing-selection";
import { loadPublicHomePageData } from "@/features/home/public-home-page-data";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

const HOME_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const HOME_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة منظمة وواضحة.";

export const Route = createFileRoute("/")({
  loader: loadPublicHomePageData,
  head: () => createSeo({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { language, text } = useUiPreferences();
  const { listings, categoryWorlds, listingLoadFailed, categoryLoadFailed } = Route.useLoaderData();
  const [searchValue, setSearchValue] = useState("");

  const featuredListings = selectDiverseListings(
    listings.filter((listing) => listing.isFeatured),
    4,
    1,
  );
  const featuredListingIds = new Set(featuredListings.map((listing) => listing.id));
  const latestListings = selectDiverseListings(
    listings.filter((listing) => !featuredListingIds.has(listing.id)),
    12,
    2,
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchValue.trim();
    void navigate({ to: "/listings", search: q ? { q } : {} });
  }

  const retryAction = (
    <Button onClick={() => void router.invalidate()}>{text("إعادة المحاولة", "Try again")}</Button>
  );

  return (
    <>
      <AppHeader />
      <div
        role="status"
        aria-live="polite"
        className="border-y border-amber-300/70 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 sm:text-base"
      >
        الموقع قيد التطوير لمدة 24 ساعة.
      </div>
      <main className="rawaj-home-v3-main">
        <PageTransition>
          <PageContainer className="rawaj-home-v3 rawaj-content-stack py-3 sm:py-5 lg:py-7">
            <DiscoveryHero
              searchValue={searchValue}
              onSearchValueChange={setSearchValue}
              onSubmit={handleSearch}
              text={text}
            />

            {categoryLoadFailed ? (
              <EmptyState
                className="rawaj-home-load-state"
                title={text("تعذر تحميل أقسام السوق", "Marketplace categories could not be loaded")}
                description={text(
                  "الإعلانات ما زالت متاحة. أعد المحاولة لاستعادة التنقل السريع بين الأقسام.",
                  "Listings remain available. Try again to restore quick category navigation.",
                )}
                action={retryAction}
              />
            ) : (
              <CategoryWorlds worlds={categoryWorlds} language={language} text={text} />
            )}

            {listingLoadFailed ? (
              <EmptyState
                className="rawaj-home-load-state"
                title={text("تعذر تحميل إعلانات السوق", "Marketplace listings could not be loaded")}
                description={text(
                  "الأقسام ما زالت متاحة. أعد المحاولة لتحميل أحدث الإعلانات.",
                  "Categories remain available. Try again to load the latest listings.",
                )}
                action={retryAction}
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
      </main>
    </>
  );
}
