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
  Megaphone,
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

const categoryTones = ["coral", "cyan", "violet", "blue", "mint", "amber"] as const;

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
    3,
    1,
  );
  const featuredListingIds = new Set(featuredListings.map((listing) => listing.id));
  const latestListings = selectDiverseListings(
    listings.filter((listing) => !featuredListingIds.has(listing.id)),
    8,
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
      <main className="rawaj-approved-home">
        <PageTransition>
          <div className="rawaj-approved-home__container">
            <ApprovedHero
              searchValue={searchValue}
              onSearchValueChange={setSearchValue}
              onSubmit={handleSearch}
              text={text}
            />

            {categoryLoadFailed ? (
              <EmptyState
                className="rawaj-approved-home__load-state"
                title={text("تعذر تحميل أقسام السوق", "Marketplace categories could not be loaded")}
                description={text(
                  "الإعلانات ما زالت متاحة. أعد المحاولة لاستعادة التنقل السريع بين الأقسام.",
                  "Listings remain available. Try again to restore quick category navigation.",
                )}
                action={retryAction}
              />
            ) : (
              <ApprovedCategories worlds={categoryWorlds} language={language} text={text} />
            )}

            <ApprovedAdBanner text={text} />

            {listingLoadFailed ? (
              <EmptyState
                className="rawaj-approved-home__load-state"
                title={text("تعذر تحميل إعلانات السوق", "Marketplace listings could not be loaded")}
                description={text(
                  "الأقسام ما زالت متاحة. أعد المحاولة لتحميل أحدث الإعلانات.",
                  "Categories remain available. Try again to load the latest listings.",
                )}
                action={retryAction}
              />
            ) : (
              <>
                <ApprovedFeaturedListings
                  listings={featuredListings}
                  language={language}
                  text={text}
                />
                <ApprovedLatestListings listings={latestListings} language={language} text={text} />
              </>
            )}

            <ApprovedSafetyStrip text={text} />
            <ApprovedMobileFooter text={text} />
          </div>
        </PageTransition>
      </main>
    </>
  );
}

interface ApprovedHeroProps {
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  text: (ar: string, en: string) => string;
}

function ApprovedHero({ searchValue, onSearchValueChange, onSubmit, text }: ApprovedHeroProps) {
  return (
    <section className="rawaj-approved-hero" aria-labelledby="rawaj-approved-home-title">
      <div className="rawaj-approved-hero__aurora" aria-hidden="true">
        <span data-wave="one" />
        <span data-wave="two" />
        <span data-wave="three" />
      </div>

      <div className="rawaj-approved-hero__content">
        <span className="rawaj-approved-hero__kicker">
          <Sparkles aria-hidden="true" />
          {text("السوق الأقرب إليك", "Your closest marketplace")}
        </span>
        <h1 id="rawaj-approved-home-title">{text("أهلًا بك في رواج", "Welcome to RAWAJ")}</h1>
        <p>
          {text(
            "السوق العربي للإعلانات المبوبة في سوريا — بيع، اعرض، واكتشف بسهولة.",
            "Syria's Arabic classifieds marketplace — sell, post, and discover with ease.",
          )}
        </p>

        <form className="rawaj-approved-search" role="search" onSubmit={onSubmit}>
          <label htmlFor="rawaj-approved-search-input">
            <Search aria-hidden="true" />
            <input
              id="rawaj-approved-search-input"
              name="q"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              dir="auto"
              value={searchValue}
              onChange={(event) => onSearchValueChange(event.target.value)}
              placeholder={text("ابحث عن أي شيء...", "Search for anything...")}
              aria-label={text("ابحث في رواج", "Search RAWAJ")}
            />
          </label>
          <button type="submit">{text("بحث", "Search")}</button>
        </form>

        <div className="rawaj-approved-hero__actions" aria-label={text("إجراءات سريعة", "Quick actions")}>
          <Link to="/add-listing" className="rawaj-approved-hero__primary-action">
            <Plus aria-hidden="true" />
            {text("أضف إعلان", "Post listing")}
          </Link>
          <Link to="/categories">
            <Grid3X3 aria-hidden="true" />
            {text("تصفح الأقسام", "Browse categories")}
          </Link>
          <Link to="/listings" search={{ q: "عقار" }}>
            <Building2 aria-hidden="true" />
            {text("العقارات", "Real estate")}
          </Link>
          <Link to="/listings" search={{ q: "سيارة" }}>
            <Car aria-hidden="true" />
            {text("السيارات", "Cars")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function ApprovedCategories({
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
      className="rawaj-approved-section rawaj-approved-categories"
      aria-labelledby="rawaj-approved-categories-title"
    >
      <ApprovedSectionHeader
        title={<span id="rawaj-approved-categories-title">{text("تصفح الفئات", "Browse categories")}</span>}
        action={
          <Link to="/categories">
            {text("عرض الكل", "View all")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-approved-categories__grid">
        {worlds.slice(0, 6).map((world, index) => (
          <ApprovedCategoryTile
            key={world.id}
            world={world}
            language={language}
            tone={categoryTones[index % categoryTones.length]}
            text={text}
          />
        ))}
      </div>
    </section>
  );
}

function ApprovedCategoryTile({
  world,
  language,
  tone,
  text,
}: {
  world: HomeCategoryWorld;
  language: "ar" | "en";
  tone: (typeof categoryTones)[number];
  text: (ar: string, en: string) => string;
}) {
  const Icon = categoryIcons[world.iconKey ?? ""] ?? Grid3X3;
  const label = language === "en" ? world.nameEn || world.nameAr : world.nameAr;
  const content = (
    <>
      <span className="rawaj-approved-category-tile__icon" aria-hidden="true">
        <Icon />
      </span>
      <strong>{label}</strong>
      <small>{text("استكشف الإعلانات", "Explore listings")}</small>
    </>
  );
  const className = "rawaj-approved-category-tile";

  if (world.target.kind === "legacy") {
    return (
      <Link
        to="/category/$slug"
        params={{ slug: world.target.slug }}
        className={className}
        data-tone={tone}
      >
        {content}
      </Link>
    );
  }

  if (world.target.kind === "directory") {
    return (
      <Link
        to="/categories"
        search={{ node: world.target.node }}
        className={className}
        data-tone={tone}
      >
        {content}
      </Link>
    );
  }

  return (
    <Link to="/listings" search={world.target.search} className={className} data-tone={tone}>
      {content}
    </Link>
  );
}

function ApprovedAdBanner({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <section className="rawaj-approved-ad" aria-label={text("مساحة إعلانية", "Advertising space")}>
      <div className="rawaj-approved-ad__art" aria-hidden="true">
        <span />
        <Megaphone />
      </div>
      <div className="rawaj-approved-ad__copy">
        <strong>{text("مساحة إعلانية مميزة", "Premium advertising space")}</strong>
        <p>
          {text(
            "روّج إعلانك ووصل إلى جمهور أكبر داخل رواج.",
            "Promote your listing to a wider RAWAJ audience.",
          )}
        </p>
        <Link to="/support">{text("تواصل معنا", "Contact us")}</Link>
      </div>
      <div className="rawaj-approved-ad__slot" aria-hidden="true">
        <span>{text("مساحة إعلانية", "Ad space")}</span>
        <small>728 × 90</small>
      </div>
    </section>
  );
}

function ApprovedFeaturedListings({
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
    <section
      className="rawaj-approved-section rawaj-approved-featured"
      aria-labelledby="rawaj-approved-featured-title"
    >
      <ApprovedSectionHeader
        title={<span id="rawaj-approved-featured-title">{text("إعلانات مميزة", "Featured listings")}</span>}
        action={
          <Link to="/listings">
            {text("عرض الكل", "View all")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-approved-featured__grid">
        {listings.slice(0, 3).map((listing, index) => (
          <ApprovedListingCard
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

function ApprovedListingCard({
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
    <article className="rawaj-approved-listing-card" data-featured={listing.isFeatured || undefined}>
      <Link to="/listings/$id" params={{ id: listing.id }}>
        <div className="rawaj-approved-listing-card__media">
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
          <span className="rawaj-approved-listing-card__favorite" aria-hidden="true">
            <Heart />
          </span>
          {listing.isFeatured ? (
            <span className="rawaj-approved-listing-card__badge">{text("مميز", "Featured")}</span>
          ) : null}
        </div>
        <div className="rawaj-approved-listing-card__body">
          <div className="rawaj-approved-listing-card__heading">
            <div>
              <span>{categoryName(listing.categoryId, listing.categoryNameAr, language)}</span>
              <h3>{listing.title}</h3>
            </div>
            <strong>
              {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
            </strong>
          </div>
          <p>{listing.description}</p>
          <div className="rawaj-approved-listing-card__meta">
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

function ApprovedLatestListings({
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
      className="rawaj-approved-section rawaj-approved-latest"
      aria-labelledby="rawaj-approved-latest-title"
    >
      <ApprovedSectionHeader
        title={<span id="rawaj-approved-latest-title">{text("وصل حديثًا", "Just arrived")}</span>}
        action={
          <Link to="/listings">
            {text("تصفح السوق", "Browse market")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />

      {listings.length > 0 ? (
        <div className="rawaj-approved-latest__rail">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              to="/listings/$id"
              params={{ id: listing.id }}
              className="rawaj-approved-mini-card"
            >
              <div className="rawaj-approved-mini-card__media">
                <ListingCardImage
                  src={listing.primaryImageUrl}
                  alt={listing.title}
                  placeholder={listing.categoryPlaceholder ?? "misc"}
                  placeholderAspect="wide"
                  width={360}
                  height={240}
                />
              </div>
              <div>
                <span>{categoryName(listing.categoryId, listing.categoryNameAr, language)}</span>
                <strong>{listing.title}</strong>
                <small>
                  {formatPriceLocalized(
                    listing.price ?? 0,
                    listing.priceType,
                    language,
                    listing.currency,
                  )}
                </small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rawaj-approved-home__empty">
          {text(
            "لا توجد إعلانات معتمدة للعرض الآن.",
            "No reviewed listings are available right now.",
          )}
        </div>
      )}
    </section>
  );
}

function ApprovedSafetyStrip({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <section className="rawaj-approved-safety" aria-label={text("التعامل الآمن", "Safe trading")}>
      <span className="rawaj-approved-safety__icon" aria-hidden="true">
        <ShieldCheck />
      </span>
      <div>
        <strong>{text("تعامل بأمان", "Trade safely")}</strong>
        <p>
          {text(
            "افحص السلعة قبل الدفع، وقابل البائع في مكان آمن.",
            "Inspect before paying and meet in a safe place.",
          )}
        </p>
      </div>
      <Link to="/safety">
        {text("دليل الأمان", "Safety guide")}
        <ChevronLeft aria-hidden="true" />
      </Link>
    </section>
  );
}

function ApprovedMobileFooter({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <footer className="rawaj-approved-mobile-footer">
      <Link to="/" aria-label={text("رواج — الرئيسية", "RAWAJ — Home")}>
        <BrandLockup inverse />
      </Link>
      <p>{text("كل ما تحتاجه... في مكان واحد", "Everything you need, in one place")}</p>
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

function ApprovedSectionHeader({ title, action }: { title: ReactNode; action: ReactNode }) {
  return (
    <header className="rawaj-approved-section-header">
      <h2>{title}</h2>
      <div>{action}</div>
    </header>
  );
}
