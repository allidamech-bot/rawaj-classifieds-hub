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

const quickShortcuts: Array<{
  node: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: LucideIcon;
}> = [
  {
    node: "realestate",
    labelAr: "العقارات",
    labelEn: "Real estate",
    descriptionAr: "بيع وإيجار",
    descriptionEn: "Sale and rent",
    icon: Building2,
  },
  {
    node: "cars",
    labelAr: "السيارات",
    labelEn: "Cars",
    descriptionAr: "مركبات وقطع",
    descriptionEn: "Vehicles and parts",
    icon: Car,
  },
  {
    node: "electronics",
    labelAr: "الإلكترونيات",
    labelEn: "Electronics",
    descriptionAr: "أجهزة وتقنيات",
    descriptionEn: "Devices and tech",
    icon: Laptop,
  },
  {
    node: "services",
    labelAr: "الخدمات",
    labelEn: "Services",
    descriptionAr: "خبرات وأعمال",
    descriptionEn: "Skills and work",
    icon: Wrench,
  },
];

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
      <main className="rawaj-home-v2">
        <PageTransition>
          <div className="rawaj-home-v2__container">
            <HomeLocationBar text={text} />
            <HomeHero
              searchValue={searchValue}
              onSearchValueChange={setSearchValue}
              onSubmit={handleSearch}
              text={text}
            />
            <HomeQuickShortcuts text={text} />

            {categoryLoadFailed ? (
              <EmptyState
                className="rawaj-home-v2__load-state"
                title={text("تعذر تحميل أقسام السوق", "Marketplace categories could not be loaded")}
                description={text(
                  "الإعلانات ما زالت متاحة. أعد المحاولة لاستعادة التنقل السريع بين الأقسام.",
                  "Listings remain available. Try again to restore quick category navigation.",
                )}
                action={retryAction}
              />
            ) : (
              <HomeCategories worlds={categoryWorlds} language={language} text={text} />
            )}

            {listingLoadFailed ? (
              <EmptyState
                className="rawaj-home-v2__load-state"
                title={text("تعذر تحميل إعلانات السوق", "Marketplace listings could not be loaded")}
                description={text(
                  "الأقسام ما زالت متاحة. أعد المحاولة لتحميل أحدث الإعلانات.",
                  "Categories remain available. Try again to load the latest listings.",
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
                <HomePromotionBanner text={text} />
                <HomeLatestListings listings={latestListings} language={language} text={text} />
              </>
            )}

            <HomeSafetyStrip text={text} />
            <HomeMobileFooter text={text} />
          </div>
        </PageTransition>
      </main>
    </>
  );
}

function HomeLocationBar({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <div className="rawaj-home-location-row">
      <Link to="/listings" search={{ open_filters: true }} className="rawaj-home-location-pill">
        <MapPin aria-hidden="true" />
        <span>
          <small>{text("موقع التصفح", "Browse location")}</small>
          <strong>{text("كل سوريا", "All Syria")}</strong>
        </span>
        <ChevronLeft aria-hidden="true" />
      </Link>
    </div>
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
    <section className="rawaj-home-hero" aria-labelledby="rawaj-home-title">
      <div className="rawaj-home-hero__aurora" aria-hidden="true">
        <span data-wave="one" />
        <span data-wave="two" />
        <span data-wave="three" />
      </div>

      <div className="rawaj-home-hero__content">
        <span className="rawaj-home-hero__kicker">
          <Sparkles aria-hidden="true" />
          {text("بيع، اعرض، واكتشف", "Sell, post, and discover")}
        </span>
        <h1 id="rawaj-home-title">{text("كل ما تحتاجه… في رواج", "Everything you need… on RAWAJ")}</h1>
        <p>
          {text(
            "سوق سوري للأفراد والمتاجر والخدمات في مكان واحد.",
            "A Syrian marketplace for people, stores, and services in one place.",
          )}
        </p>

        <form className="rawaj-home-search" role="search" onSubmit={onSubmit}>
          <label htmlFor="rawaj-home-search-input">
            <Search aria-hidden="true" />
            <input
              id="rawaj-home-search-input"
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

        <div className="rawaj-home-hero__actions" aria-label={text("إجراءات رئيسية", "Primary actions")}>
          <Link to="/add-listing" className="rawaj-home-hero__primary-action">
            <Plus aria-hidden="true" />
            {text("أضف إعلان", "Post listing")}
          </Link>
          <Link to="/categories" className="rawaj-home-hero__secondary-action">
            <Grid3X3 aria-hidden="true" />
            {text("تصفح الأقسام", "Browse categories")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function HomeQuickShortcuts({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <nav className="rawaj-home-shortcuts" aria-label={text("أقسام سريعة", "Quick categories")}>
      {quickShortcuts.map((shortcut) => {
        const Icon = shortcut.icon;
        return (
          <Link key={shortcut.node} to="/categories" search={{ node: shortcut.node }}>
            <span aria-hidden="true">
              <Icon />
            </span>
            <div>
              <strong>{text(shortcut.labelAr, shortcut.labelEn)}</strong>
              <small>{text(shortcut.descriptionAr, shortcut.descriptionEn)}</small>
            </div>
            <ChevronLeft aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
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
    <section className="rawaj-home-section rawaj-home-categories" aria-labelledby="rawaj-home-categories-title">
      <HomeSectionHeader
        title={<span id="rawaj-home-categories-title">{text("كل الأقسام", "All categories")}</span>}
        eyebrow={text("اكتشف السوق", "Explore the market")}
        action={
          <Link to="/categories">
            {text("عرض الكل", "View all")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-home-categories__grid">
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
      <span className="rawaj-home-category-tile__icon" aria-hidden="true">
        <Icon />
      </span>
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      <ChevronLeft className="rawaj-home-category-tile__arrow" aria-hidden="true" />
    </>
  );
  const className = "rawaj-home-category-tile";

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
    <section className="rawaj-home-section rawaj-home-featured" aria-labelledby="rawaj-home-featured-title">
      <HomeSectionHeader
        title={<span id="rawaj-home-featured-title">{text("إعلانات مميزة", "Featured listings")}</span>}
        eyebrow={text("مختارات رواج", "RAWAJ picks")}
        action={
          <Link to="/listings">
            {text("عرض الكل", "View all")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className="rawaj-home-featured__grid">
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
    <article className="rawaj-home-listing-card" data-featured={listing.isFeatured || undefined}>
      <Link to="/listings/$id" params={{ id: listing.id }}>
        <div className="rawaj-home-listing-card__media">
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
            <span className="rawaj-home-listing-card__no-image">{text("لا توجد صورة", "No image")}</span>
          ) : null}
          <span className="rawaj-home-listing-card__favorite" aria-hidden="true">
            <Heart />
          </span>
          {listing.isFeatured ? (
            <span className="rawaj-home-listing-card__badge">{text("مميز", "Featured")}</span>
          ) : null}
        </div>
        <div className="rawaj-home-listing-card__body">
          <span className="rawaj-home-listing-card__category">
            {categoryName(listing.categoryId, listing.categoryNameAr, language)}
          </span>
          <h3>{listing.title}</h3>
          <strong className="rawaj-home-listing-card__price">
            {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
          </strong>
          <p>{listing.description}</p>
          <div className="rawaj-home-listing-card__meta">
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

function HomePromotionBanner({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <section className="rawaj-home-promotion" aria-label={text("الترويج في رواج", "Promote on RAWAJ")}>
      <span className="rawaj-home-promotion__icon" aria-hidden="true">
        <Megaphone />
      </span>
      <div>
        <small>{text("لأصحاب المتاجر والشركات", "For stores and businesses")}</small>
        <strong>{text("خلّي إعلانك يوصل لعدد أكبر", "Reach a wider audience")}</strong>
        <p>{text("مساحات ترويجية أنيقة داخل رواج عند توفرها.", "Elegant promotional placements when available.")}</p>
      </div>
      <Link to="/support">
        {text("تواصل معنا", "Contact us")}
        <ChevronLeft aria-hidden="true" />
      </Link>
    </section>
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
    <section className="rawaj-home-section rawaj-home-latest" aria-labelledby="rawaj-home-latest-title">
      <HomeSectionHeader
        title={<span id="rawaj-home-latest-title">{text("وصل حديثًا", "Just arrived")}</span>}
        eyebrow={text("أحدث الإعلانات", "Latest listings")}
        action={
          <Link to="/listings">
            {text("تصفح السوق", "Browse market")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />

      {listings.length > 0 ? (
        <div className="rawaj-home-latest__rail">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              to="/listings/$id"
              params={{ id: listing.id }}
              className="rawaj-home-mini-card"
            >
              <div className="rawaj-home-mini-card__media">
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
        <div className="rawaj-home-v2__empty">
          {text("لا توجد إعلانات معتمدة للعرض الآن.", "No reviewed listings are available right now.")}
        </div>
      )}
    </section>
  );
}

function HomeSafetyStrip({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <section className="rawaj-home-safety" aria-label={text("التعامل الآمن", "Safe trading")}>
      <span className="rawaj-home-safety__icon" aria-hidden="true">
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
    <footer className="rawaj-home-mobile-footer">
      <Link to="/" aria-label={text("رواج — الرئيسية", "RAWAJ — Home")}>
        <BrandLockup inverse />
      </Link>
      <p>{text("كل ما تحتاجه… في مكان واحد", "Everything you need, in one place")}</p>
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
    <header className="rawaj-home-section-header">
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      <div>{action}</div>
    </header>
  );
}
