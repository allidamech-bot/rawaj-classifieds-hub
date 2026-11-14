import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Car,
  ChevronLeft,
  Clock,
  Crown,
  LayoutGrid,
  Grid3X3,
  Laptop,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Sofa,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
import { EmptyState, PageTransition } from "@/components/shell/spatial-primitives";
import { Button } from "@/components/ui/button";
import type { HomeCategoryWorld } from "@/features/home/home-category-discovery";
import { selectDiverseListings } from "@/features/home/home-listing-selection";
import { loadPublicHomePageData } from "@/features/home/public-home-page-data";
import { HomeFavoriteButton } from "@/features/home/HomeFavoriteButton";
import { ListingCardImage } from "@/features/listings/cards/ListingCardImage";
import { formatDate } from "@/features/listings/listings-components";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

import "../rawaj-home-signature-v2.css";

const HOME_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const HOME_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة منظمة وواضحة.";

const categoryIcons: Record<string, LucideIcon> = {
  car: Car,
  realestate: Building2,
  phone: Smartphone,
  electronics: Laptop,
  furniture: Sofa,
  job: Briefcase,
  service: Wrench,
  business: Store,
};

const categoryArt: Record<string, string> = {
  car: "car",
  vehicles: "car",
  realestate: "house",
  home: "house",
  building: "house",
  phone: "phone",
  smartphone: "phone",
  furniture: "sofa",
  sofa: "sofa",
  electronics: "laptop",
  laptop: "laptop",
  job: "briefcase",
  briefcase: "briefcase",
  pets: "paw",
  paw: "paw",
  misc: "more",
};

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

  const featuredPool = [
    ...listings.filter((listing) => listing.isFeatured),
    ...listings.filter((listing) => !listing.isFeatured),
  ];
  const featuredListings = selectDiverseListings(featuredPool, 3, 1);
  const featuredListingIds = new Set(featuredListings.map((listing) => listing.id));
  const latestListings = selectDiverseListings(
    listings.filter((listing) => !featuredListingIds.has(listing.id)),
    5,
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
      <main className="rawaj-signature-home">
        <PageTransition>
          <div className="rawaj-signature-home__container">
            <HomeHero
              searchValue={searchValue}
              onSearchValueChange={setSearchValue}
              onSubmit={handleSearch}
              text={text}
            />
            {categoryLoadFailed ? (
              <EmptyState
                className="rawaj-signature-home__load-state"
                title={text("تعذر تحميل أقسام السوق", "Marketplace categories could not be loaded")}
                description={text(
                  "الإعلانات ما زالت متاحة. أعد المحاولة لاستعادة تصفح الأقسام.",
                  "Listings remain available. Try again to restore category browsing.",
                )}
                action={retryAction}
              />
            ) : (
              <HomeCategories worlds={categoryWorlds} language={language} text={text} />
            )}

            {listingLoadFailed ? (
              <EmptyState
                className="rawaj-signature-home__load-state"
                title={text("تعذر تحميل إعلانات السوق", "Marketplace listings could not be loaded")}
                description={text(
                  "أعد المحاولة لتحميل أحدث الإعلانات المعتمدة.",
                  "Try again to load the latest reviewed listings.",
                )}
                action={retryAction}
              />
            ) : (
              <>
                <HomeFeaturedListings listings={featuredListings} language={language} text={text} />
                <HomeLatestListings listings={latestListings} language={language} text={text} />
                <div className="rawaj-signature-ad-placement">
                  <PublicAdPlacementSlot placementPage="home" />
                </div>
              </>
            )}

            <HomeTrustRow text={text} />
            <HomeSafetyStrip text={text} />
          </div>
        </PageTransition>
      </main>
    </>
  );
}

interface HomeHeroProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  text: (ar: string, en: string) => string;
}

function HomeHero({ searchValue, onSearchValueChange, onSubmit, text }: HomeHeroProps) {
  return (
    <section className="rawaj-signature-hero" aria-labelledby="rawaj-signature-home-title">
      <div className="rawaj-signature-hero__content">
        <h1 id="rawaj-signature-home-title" className="rawaj-signature-hero__tagline">
          {text("سوق الإعلانات المبوبة في سوريا", "Syria’s classifieds marketplace")}
        </h1>

        <div className="rawaj-signature-hero__utility">
          <Link
            to="/listings"
            search={{ open_filters: true }}
            className="rawaj-signature-location"
            aria-label={text("اختيار موقع التصفح", "Choose browse location")}
          >
            <MapPin aria-hidden="true" />
            <span>{text("كل سوريا", "All Syria")}</span>
            <ChevronLeft aria-hidden="true" />
          </Link>

          <Link to="/add-listing" className="rawaj-signature-hero__primary-action">
            <Plus aria-hidden="true" />
            {text("أضف إعلانًا", "Post a listing")}
          </Link>
        </div>
      </div>

      <form className="rawaj-signature-search" role="search" onSubmit={onSubmit}>
        <input
          id="rawaj-signature-search-input"
          name="q"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          dir="auto"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          placeholder={text(
            "ابحث عن سيارة، شقة، هاتف، أو أي شيء…",
            "Find a car, an apartment, a phone…",
          )}
          aria-label={text("ابحث في رواج", "Search RAWAJ")}
        />
        <button type="submit" aria-label={text("بحث", "Search")}>
          <Search aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}

function HomeTrustRow({ text }: { text: (ar: string, en: string) => string }) {
  const items = [
    { icon: Plus, ar: "نشر مجاني", en: "Free posting" },
    { icon: Store, ar: "أفراد ومتاجر", en: "People and stores" },
    { icon: MapPin, ar: "جميع المحافظات", en: "All governorates" },
  ];

  return (
    <div className="rawaj-signature-trust-row" aria-label={text("مزايا رواج", "RAWAJ benefits")}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <span key={item.ar}>
            <Icon aria-hidden="true" />
            {text(item.ar, item.en)}
          </span>
        );
      })}
    </div>
  );
}

function HomeFeaturedListings({
  listings,
  language,
  text,
}: {
  listings: ClassifiedListing[];
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  const [viewportRef, carousel] = useEmblaCarousel({
    direction: language === "ar" ? "rtl" : "ltr",
    loop: listings.length > 2,
    containScroll: false,
  });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!carousel) return;
    const update = () => setSelected(carousel.selectedScrollSnap());
    update();
    carousel.on("select", update).on("reInit", update);
    return () => {
      carousel.off("select", update).off("reInit", update);
    };
  }, [carousel]);

  if (listings.length === 0) return null;

  return (
    <section
      className="rawaj-signature-section rawaj-signature-featured"
      aria-labelledby="rawaj-signature-featured-title"
    >
      <HomeSectionHeader
        title={
          <span id="rawaj-signature-featured-title">
            {text("إعلانات مميزة", "Featured listings")}
          </span>
        }
        icon={Crown}
        eyebrow={text("أفضل العروض المختارة لك", "Top picks for you")}
        action={
          <Link to="/listings">
            {text("عرض المزيد", "View more")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-signature-featured__viewport" ref={viewportRef}>
        <div className="rawaj-signature-featured__layout">
          {listings.map((listing, index) => (
            <HomeLeadListingCard
              key={listing.id}
              listing={listing}
              language={language}
              text={text}
              eager={index === 0}
            />
          ))}
        </div>
      </div>
      {listings.length > 1 ? (
        <div
          className="rawaj-signature-featured__dots"
          aria-label={text("اختيار إعلان مميز", "Choose a featured listing")}
        >
          {listings.map((listing, index) => (
            <button
              key={listing.id}
              type="button"
              aria-label={text(`عرض ${listing.title}`, `Show ${listing.title}`)}
              aria-current={selected === index ? "true" : undefined}
              onClick={() =>
                carousel?.scrollTo(
                  index,
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches,
                )
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function HomeLeadListingCard({
  listing,
  language,
  text,
  eager,
}: {
  listing: ClassifiedListing;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
  eager: boolean;
}) {
  return (
    <article className="rawaj-signature-lead-card">
      <Link to="/listings/$id" params={{ id: listing.id }}>
        <div className="rawaj-signature-lead-card__media">
          <ListingCardImage
            src={listing.primaryImageUrl}
            alt={listing.title}
            placeholder={listing.categoryPlaceholder ?? "misc"}
            placeholderAspect="wide"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            width={960}
            height={600}
          />
          {!listing.primaryImageUrl ? (
            <span className="rawaj-signature-no-image">{text("لا توجد صورة", "No image")}</span>
          ) : null}
          <span className="rawaj-signature-featured-badge">
            <Crown aria-hidden="true" />
            {listing.isFeatured ? text("مميز", "Featured") : text("مختار", "Selected")}
          </span>
        </div>
        <div className="rawaj-signature-lead-card__body">
          <h3>{listing.title}</h3>
          <small>
            <MapPin aria-hidden="true" />
            {listingLocationDisplay(listing, language)}
          </small>
          <strong>
            {formatPriceLocalized(
              listing.price ?? 0,
              listing.priceType,
              language,
              listing.currency,
            )}
          </strong>
          <span className="sr-only">
            {categoryName(listing.categoryId, listing.categoryNameAr, language)} ·{" "}
            {formatDate(listing.createdAt, language)}
          </span>
        </div>
      </Link>
    </article>
  );
}

function HomeLatestListings({
  listings,
  language,
  text,
}: {
  listings: ClassifiedListing[];
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  return (
    <section
      className="rawaj-signature-section rawaj-signature-latest"
      aria-labelledby="rawaj-signature-latest-title"
    >
      <HomeSectionHeader
        title={
          <span id="rawaj-signature-latest-title">{text("أحدث الإعلانات", "Latest listings")}</span>
        }
        icon={Clock}
        eyebrow={text("أحدث إعلانات السوق", "The market's latest listings")}
        action={
          <Link to="/listings">
            {text("عرض المزيد", "View more")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />

      {listings.length > 0 ? (
        <div className="rawaj-signature-latest__list">
          {listings.map((listing) => (
            <article key={listing.id} className="rawaj-signature-latest-card">
              <Link to="/listings/$id" params={{ id: listing.id }}>
                <div className="rawaj-signature-latest-card__media">
                  <ListingCardImage
                    src={listing.primaryImageUrl}
                    alt={listing.title}
                    placeholder={listing.categoryPlaceholder ?? "misc"}
                    placeholderAspect="wide"
                    width={420}
                    height={300}
                  />
                  {listing.condition === "new" || listing.condition === "like_new" ? (
                    <span
                      className="rawaj-signature-condition"
                      data-new={listing.condition === "new"}
                    >
                      {listing.condition === "new"
                        ? text("جديد", "New")
                        : text("كالجديد", "Like new")}
                    </span>
                  ) : null}
                </div>
                <div className="rawaj-signature-latest-card__body">
                  <span className="sr-only">
                    {categoryName(listing.categoryId, listing.categoryNameAr, language)}
                  </span>
                  <strong>{listing.title}</strong>
                  <b>
                    {formatPriceLocalized(
                      listing.price ?? 0,
                      listing.priceType,
                      language,
                      listing.currency,
                    )}
                  </b>
                  <small>
                    <MapPin aria-hidden="true" />
                    {listingLocationDisplay(listing, language)}
                  </small>
                </div>
              </Link>
              <HomeFavoriteButton listing={listing} />
            </article>
          ))}
        </div>
      ) : (
        <div className="rawaj-signature-home__empty">
          {text(
            "لا توجد إعلانات معتمدة للعرض الآن.",
            "No reviewed listings are available right now.",
          )}
        </div>
      )}
    </section>
  );
}

function HomeCategories({
  worlds,
  language,
  text,
}: {
  worlds: HomeCategoryWorld[];
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  if (worlds.length === 0) return null;

  return (
    <section
      className="rawaj-signature-section rawaj-signature-categories"
      aria-labelledby="rawaj-signature-categories-title"
    >
      <HomeSectionHeader
        title={
          <span id="rawaj-signature-categories-title">
            {text("الأقسام الرئيسية", "Main categories")}
          </span>
        }
        icon={LayoutGrid}
        action={
          <Link to="/categories">
            {text("عرض جميع الأقسام", "All categories")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-signature-categories__rail">
        {worlds.map((world) => (
          <HomeCategoryTile key={world.id} world={world} language={language} />
        ))}
      </div>
    </section>
  );
}

function HomeCategoryTile({
  world,
  language,
}: {
  world: HomeCategoryWorld;
  language: "ar" | "en";
}) {
  const iconKey = world.iconKey ?? "";
  const art = categoryArt[iconKey];
  const Icon = categoryIcons[iconKey] ?? Grid3X3;
  const label = language === "en" ? world.nameEn || world.nameAr : world.nameAr;
  const content = (
    <>
      <span aria-hidden="true">
        {art ? <img src={`/brand/home/${art}.webp`} alt="" width={80} height={48} /> : <Icon />}
      </span>
      <strong>{label}</strong>
    </>
  );
  const className = "rawaj-signature-category-chip";

  if (world.target.kind === "legacy") {
    return (
      <Link to="/category/$slug" params={{ slug: world.target.slug }} className={className}>
        {content}
      </Link>
    );
  }

  if (world.target.kind === "directory") {
    return (
      <Link to="/categories" search={{ node: world.target.node }} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Link to="/listings" search={world.target.search} className={className}>
      {content}
    </Link>
  );
}

function HomeSafetyStrip({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <section className="rawaj-signature-safety" aria-label={text("التعامل الآمن", "Safe trading")}>
      <ShieldCheck aria-hidden="true" />
      <span>
        <strong>{text("تعامل بأمان", "Trade safely")}</strong>
        <small>
          {text(
            "افحص السلعة قبل الدفع وقابل البائع في مكان آمن.",
            "Inspect before paying and meet safely.",
          )}
        </small>
      </span>
      <Link to="/safety">{text("الدليل", "Guide")}</Link>
    </section>
  );
}

function HomeSectionHeader({
  title,
  eyebrow,
  icon: Icon,
  action,
}: {
  title: ReactNode;
  eyebrow?: string;
  icon: LucideIcon;
  action: ReactNode;
}) {
  return (
    <header className="rawaj-signature-section-header">
      <div className="rawaj-signature-section-header__title">
        <Icon aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          {eyebrow ? <small>{eyebrow}</small> : null}
        </div>
      </div>
      <div>{action}</div>
    </header>
  );
}
