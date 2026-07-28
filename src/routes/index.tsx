import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Car,
  ChevronLeft,
  Clock,
  Grid3X3,
  Heart,
  Laptop,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Sofa,
  Sparkles,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { EmptyState, PageTransition } from "@/components/shell/spatial-primitives";
import { Button } from "@/components/ui/button";
import type { HomeCategoryWorld } from "@/features/home/home-category-discovery";
import { selectDiverseListings } from "@/features/home/home-listing-selection";
import { loadPublicHomePageData } from "@/features/home/public-home-page-data";
import { ListingCardImage } from "@/features/listings/cards/ListingCardImage";
import { formatDate } from "@/features/listings/listings-components";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

import "../rawaj-home-approved.css";
import "../rawaj-home-final.css";

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
    7,
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
      <main className="rawaj-lux-home">
        <PageTransition>
          <div className="rawaj-lux-home__container">
            <HomeHero
              searchValue={searchValue}
              onSearchValueChange={setSearchValue}
              onSubmit={handleSearch}
              text={text}
            />

            {listingLoadFailed ? (
              <EmptyState
                className="rawaj-lux-home__load-state"
                title={text("تعذر تحميل إعلانات السوق", "Marketplace listings could not be loaded")}
                description={text(
                  "أعد المحاولة لتحميل أحدث الإعلانات المعتمدة.",
                  "Try again to load the latest reviewed listings.",
                )}
                action={retryAction}
              />
            ) : (
              <>
                <HomeFeaturedListings
                  listings={featuredListings}
                  language={language}
                  text={text}
                />
                <HomeLatestListings listings={latestListings} language={language} text={text} />
                <div className="rawaj-lux-ad-placement">
                  <PublicAdPlacementSlot placementPage="home" />
                </div>
              </>
            )}

            {categoryLoadFailed ? (
              <EmptyState
                className="rawaj-lux-home__load-state"
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

            <HomeSafetyStrip text={text} />
            <HomeMobileFooter text={text} />
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
    <section className="rawaj-lux-hero" aria-labelledby="rawaj-lux-home-title">
      <div className="rawaj-lux-hero__aurora" aria-hidden="true">
        <span data-wave="one" />
        <span data-wave="two" />
        <span data-wave="three" />
      </div>

      <div className="rawaj-lux-hero__content">
        <span className="rawaj-lux-hero__kicker">
          <Sparkles aria-hidden="true" />
          {text("السوق السوري الأقرب إليك", "Your closest Syrian marketplace")}
        </span>
        <h1 id="rawaj-lux-home-title">
          {text("كل ما تبحث عنه… في رواج", "Everything you are looking for… on RAWAJ")}
        </h1>
        <p>
          {text(
            "إعلانات الأفراد والمتاجر والخدمات في مكان واحد.",
            "Listings from people, stores, and service providers in one place.",
          )}
        </p>

        <Link
          to="/listings"
          search={{ open_filters: true }}
          className="rawaj-lux-location"
          aria-label={text("اختيار موقع التصفح", "Choose browse location")}
        >
          <MapPin aria-hidden="true" />
          <span>{text("كل سوريا", "All Syria")}</span>
          <ChevronLeft aria-hidden="true" />
        </Link>

        <form className="rawaj-lux-search" role="search" onSubmit={onSubmit}>
          <label htmlFor="rawaj-lux-search-input">
            <Search aria-hidden="true" />
            <input
              id="rawaj-lux-search-input"
              name="q"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              dir="auto"
              value={searchValue}
              onChange={(event) => onSearchValueChange(event.target.value)}
              placeholder={text("ماذا تبحث عنه؟", "What are you looking for?")}
              aria-label={text("ابحث في رواج", "Search RAWAJ")}
            />
          </label>
          <button type="submit">{text("بحث", "Search")}</button>
        </form>

        <div className="rawaj-lux-hero__actions" aria-label={text("إجراءات رئيسية", "Primary actions")}>
          <Link to="/add-listing" className="rawaj-lux-hero__primary-action">
            <Plus aria-hidden="true" />
            {text("أضف إعلانًا", "Post a listing")}
          </Link>
          <Link to="/listings" className="rawaj-lux-hero__secondary-action">
            <Grid3X3 aria-hidden="true" />
            {text("استكشف السوق", "Explore the market")}
          </Link>
        </div>
      </div>
    </section>
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
  if (listings.length === 0) return null;

  return (
    <section className="rawaj-lux-section rawaj-lux-featured" aria-labelledby="rawaj-lux-featured-title">
      <HomeSectionHeader
        title={<span id="rawaj-lux-featured-title">{text("مختارات رواج", "RAWAJ picks")}</span>}
        eyebrow={text("إعلانات بارزة تستحق المشاهدة", "Highlighted listings worth seeing")}
        action={
          <Link to="/listings">
            {text("عرض الكل", "View all")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-lux-featured__grid">
        {listings.slice(0, 3).map((listing, index) => (
          <HomeListingCard
            key={listing.id}
            listing={listing}
            language={language}
            text={text}
            priority={index === 0}
          />
        ))}
      </div>
    </section>
  );
}

function HomeListingCard({
  listing,
  language,
  text,
  priority = false,
}: {
  listing: ClassifiedListing;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
  priority?: boolean;
}) {
  return (
    <article className="rawaj-lux-listing-card" data-featured={listing.isFeatured || undefined}>
      <Link to="/listings/$id" params={{ id: listing.id }}>
        <div className="rawaj-lux-listing-card__media">
          <ListingCardImage
            src={listing.primaryImageUrl}
            alt={listing.title}
            placeholder={listing.categoryPlaceholder ?? "misc"}
            placeholderAspect="wide"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            width={960}
            height={600}
          />
          {!listing.primaryImageUrl ? (
            <span className="rawaj-lux-listing-card__no-image">{text("لا توجد صورة", "No image")}</span>
          ) : null}
          <span className="rawaj-lux-listing-card__favorite" aria-hidden="true">
            <Heart />
          </span>
          {listing.isFeatured ? (
            <span className="rawaj-lux-listing-card__badge">{text("مميز", "Featured")}</span>
          ) : null}
        </div>
        <div className="rawaj-lux-listing-card__body">
          <span className="rawaj-lux-listing-card__category">
            {categoryName(listing.categoryId, listing.categoryNameAr, language)}
          </span>
          <h3>{listing.title}</h3>
          <strong className="rawaj-lux-listing-card__price">
            {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
          </strong>
          {listing.description ? <p>{listing.description}</p> : null}
          <div className="rawaj-lux-listing-card__meta">
            <span>
              <MapPin aria-hidden="true" />
              {listingLocationDisplay(listing, language)}
            </span>
            <span>
              <Clock aria-hidden="true" />
              {formatDate(listing.createdAt, language)}
            </span>
          </div>
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
    <section className="rawaj-lux-section rawaj-lux-latest" aria-labelledby="rawaj-lux-latest-title">
      <HomeSectionHeader
        title={<span id="rawaj-lux-latest-title">{text("وصل حديثًا", "Just arrived")}</span>}
        eyebrow={text("أحدث إعلانات السوق", "The market's latest listings")}
        action={
          <Link to="/listings">
            {text("عرض المزيد", "View more")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />

      {listings.length > 0 ? (
        <div className="rawaj-lux-latest__list">
          {listings.slice(0, 6).map((listing) => (
            <Link
              key={listing.id}
              to="/listings/$id"
              params={{ id: listing.id }}
              className="rawaj-lux-compact-card"
            >
              <div className="rawaj-lux-compact-card__media">
                <ListingCardImage
                  src={listing.primaryImageUrl}
                  alt={listing.title}
                  placeholder={listing.categoryPlaceholder ?? "misc"}
                  placeholderAspect="wide"
                  width={420}
                  height={300}
                />
              </div>
              <div className="rawaj-lux-compact-card__body">
                <span>{categoryName(listing.categoryId, listing.categoryNameAr, language)}</span>
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
              <ChevronLeft className="rawaj-lux-compact-card__arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="rawaj-lux-home__empty">
          {text("لا توجد إعلانات معتمدة للعرض الآن.", "No reviewed listings are available right now.")}
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
    <section className="rawaj-lux-section rawaj-lux-categories" aria-labelledby="rawaj-lux-categories-title">
      <HomeSectionHeader
        title={<span id="rawaj-lux-categories-title">{text("استكشف حسب القسم", "Explore by category")}</span>}
        eyebrow={text("وصول أسرع لما تحتاجه", "A faster way to what you need")}
        action={
          <Link to="/categories">
            {text("كل الأقسام", "All categories")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-lux-categories__grid">
        {worlds.slice(0, 6).map((world) => (
          <HomeCategoryTile key={world.id} world={world} language={language} text={text} />
        ))}
      </div>
    </section>
  );
}

function HomeCategoryTile({
  world,
  language,
  text,
}: {
  world: HomeCategoryWorld;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  const Icon = categoryIcons[world.iconKey ?? ""] ?? Grid3X3;
  const label = language === "en" ? world.nameEn || world.nameAr : world.nameAr;
  const description =
    language === "en"
      ? world.descriptionEn || world.descriptionAr || text("استكشف الإعلانات", "Explore listings")
      : world.descriptionAr || text("استكشف الإعلانات", "Explore listings");
  const content = (
    <>
      <span className="rawaj-lux-category-tile__icon" aria-hidden="true">
        <Icon />
      </span>
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <ChevronLeft className="rawaj-lux-category-tile__arrow" aria-hidden="true" />
    </>
  );
  const className = "rawaj-lux-category-tile";

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
    <section className="rawaj-lux-safety" aria-label={text("التعامل الآمن", "Safe trading")}>
      <span className="rawaj-lux-safety__icon" aria-hidden="true">
        <ShieldCheck />
      </span>
      <div>
        <strong>{text("تعامل بأمان", "Trade safely")}</strong>
        <p>{text("افحص السلعة قبل الدفع، وقابل البائع في مكان آمن.", "Inspect before paying and meet safely.")}</p>
      </div>
      <Link to="/safety">
        {text("دليل الأمان", "Safety guide")}
        <ChevronLeft aria-hidden="true" />
      </Link>
    </section>
  );
}

function HomeMobileFooter({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <footer className="rawaj-lux-mobile-footer">
      <Link to="/" aria-label={text("رواج — الرئيسية", "RAWAJ — Home")}>
        <BrandLockup inverse />
      </Link>
      <p>{text("سوقك الأقرب لكل ما تحتاجه", "Your closest market for everything you need")}</p>
      <nav aria-label={text("روابط التذييل", "Footer links")}>
        <Link to="/more">{text("من نحن", "About")}</Link>
        <Link to="/support">{text("تواصل", "Contact")}</Link>
        <Link to="/privacy">{text("الخصوصية", "Privacy")}</Link>
        <Link to="/terms">{text("الشروط", "Terms")}</Link>
      </nav>
      <small>rawa-j.com</small>
    </footer>
  );
}

function HomeSectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: ReactNode;
  eyebrow: string;
  action: ReactNode;
}) {
  return (
    <header className="rawaj-lux-section-header">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      <div>{action}</div>
    </header>
  );
}
