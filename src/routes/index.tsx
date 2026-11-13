import styles from "@/features/home/marketplace-home.module.css";
import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Car,
  ChevronLeft,
  Clock,
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
import { useState, type FormEvent, type ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
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
      <main className={styles.page} data-marketplace-home>
        <PageTransition>
          <div className={styles.container}>
            <HomeHero
              searchValue={searchValue}
              onSearchValueChange={setSearchValue}
              onSubmit={handleSearch}
              text={text}
            />

            {categoryLoadFailed ? (
              <EmptyState
                className={styles.empty}
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
                className={styles.empty}
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
              </>
            )}

            <div className="rawaj-signature-ad-placement">
              <PublicAdPlacementSlot placementPage="home" />
            </div>
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
    <section className={styles.hero} aria-labelledby="rawaj-signature-home-title">
      <div className="rawaj-signature-hero__content">
        <h1 id="rawaj-signature-home-title">
          {text("كل ما تبحث عنه… في رواج", "Everything you are looking for… on RAWAJ")}
        </h1>
      </div>

      <form className={styles.search} role="search" onSubmit={onSubmit}>
        <label htmlFor="rawaj-signature-search-input">
          <Search aria-hidden="true" />
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
            placeholder={text("ماذا تبحث عنه؟", "What are you looking for?")}
            aria-label={text("ابحث في رواج", "Search RAWAJ")}
          />
        </label>
        <button type="submit">{text("بحث", "Search")}</button>
      </form>
      <div className={styles.shortcuts}>
        <Link
          to="/listings"
          search={{ open_filters: true, q: searchValue.trim() || undefined }}
          className={styles.shortcut}
        >
          <MapPin aria-hidden="true" />
          <span>{text("الموقع: كل سوريا", "Location: All Syria")}</span>
        </Link>
        <Link to="/categories" className={styles.shortcut}>
          <Grid3X3 aria-hidden="true" />
          <span>{text("الأقسام", "Categories")}</span>
        </Link>
        <Link to="/add-listing" className={styles.shortcut}>
          <Plus aria-hidden="true" />
          <span>{text("أضف إعلانًا", "Post a listing")}</span>
        </Link>
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
  const [lead, ...supporting] = listings;

  return (
    <section className={styles.section} aria-labelledby="rawaj-signature-featured-title">
      <HomeSectionHeader
        title={
          <span id="rawaj-signature-featured-title">{text("مختارات رواج", "RAWAJ picks")}</span>
        }
        eyebrow={text("إعلانات بارزة تستحق المشاهدة", "Highlighted listings worth seeing")}
        action={
          <Link to="/listings">
            {text("عرض الكل", "View all")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />

      <div className={styles.featuredGrid}>
        <HomeLeadListingCard listing={lead} language={language} text={text} />
        {supporting.length > 0 ? (
          <div className={styles.stack}>
            {supporting.slice(0, 2).map((listing) => (
              <HomeSupportingListingCard
                key={listing.id}
                listing={listing}
                language={language}
                text={text}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HomeLeadListingCard({
  listing,
  language,
  text,
}: {
  listing: ClassifiedListing;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  return (
    <article className={styles.lead}>
      <Link to="/listings/$id" params={{ id: listing.id }}>
        <div className={styles.leadMedia}>
          <ListingCardImage
            src={listing.primaryImageUrl}
            alt={listing.title}
            placeholder={listing.categoryPlaceholder ?? "misc"}
            placeholderAspect="wide"
            loading="eager"
            fetchPriority="high"
            width={960}
            height={600}
          />
          {!listing.primaryImageUrl ? (
            <span className={styles.imageLabel}>{text("لا توجد صورة", "No image")}</span>
          ) : null}
          <span className={styles.featuredBadge}>
            {listing.isFeatured ? text("مميز", "Featured") : text("مختار", "Selected")}
          </span>
        </div>
        <div className={styles.body}>
          <span>{categoryName(listing.categoryId, listing.categoryNameAr, language)}</span>
          <h3>{listing.title}</h3>
          <strong>
            {formatPriceLocalized(
              listing.price ?? 0,
              listing.priceType,
              language,
              listing.currency,
            )}
          </strong>
          {listing.description ? <p>{listing.description}</p> : null}
          <div className={styles.metadata}>
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

function HomeSupportingListingCard({
  listing,
  language,
  text,
}: {
  listing: ClassifiedListing;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  return (
    <Link to="/listings/$id" params={{ id: listing.id }} className={styles.compact}>
      <div className={styles.thumbnail}>
        <ListingCardImage
          src={listing.primaryImageUrl}
          alt={listing.title}
          placeholder={listing.categoryPlaceholder ?? "misc"}
          placeholderAspect="wide"
          width={460}
          height={340}
        />
        {!listing.primaryImageUrl ? (
          <span className={styles.imageLabel}>{text("لا توجد صورة", "No image")}</span>
        ) : null}
      </div>
      <div className={styles.body}>
        <span>{categoryName(listing.categoryId, listing.categoryNameAr, language)}</span>
        <strong>{listing.title}</strong>
        <b>
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
        </b>
        <small>
          <MapPin aria-hidden="true" />
          {listingLocationDisplay(listing, language)}
        </small>
      </div>
      <ChevronLeft className={styles.arrow} aria-hidden="true" />
    </Link>
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
    <section className={styles.section} aria-labelledby="rawaj-signature-latest-title">
      <HomeSectionHeader
        title={<span id="rawaj-signature-latest-title">{text("وصل حديثًا", "Just arrived")}</span>}
        eyebrow={text("أحدث إعلانات السوق", "The market's latest listings")}
        action={
          <Link to="/listings">
            {text("عرض المزيد", "View more")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />

      {listings.length > 0 ? (
        <div className={styles.recentGrid}>
          {listings.map((listing) => (
            <Link
              key={listing.id}
              to="/listings/$id"
              params={{ id: listing.id }}
              className={styles.compact}
            >
              <div className={styles.thumbnail}>
                <ListingCardImage
                  src={listing.primaryImageUrl}
                  alt={listing.title}
                  placeholder={listing.categoryPlaceholder ?? "misc"}
                  placeholderAspect="wide"
                  width={420}
                  height={300}
                />
              </div>
              <div className={styles.body}>
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
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
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
    <section className={styles.section} aria-labelledby="rawaj-signature-categories-title">
      <HomeSectionHeader
        title={
          <span id="rawaj-signature-categories-title">
            {text("استكشف الأقسام", "Explore categories")}
          </span>
        }
        eyebrow={text("وصول أسرع لما تحتاجه", "A faster way to what you need")}
        action={
          <Link to="/categories">
            {text("كل الأقسام", "All categories")}
            <ChevronLeft aria-hidden="true" />
          </Link>
        }
      />
      <div className={styles.categoryGrid}>
        {worlds.slice(0, 6).map((world) => (
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
  const Icon = categoryIcons[world.iconKey ?? ""] ?? Grid3X3;
  const label = language === "en" ? world.nameEn || world.nameAr : world.nameAr;
  const content = (
    <>
      <span aria-hidden="true">
        <Icon />
      </span>
      <strong>{label}</strong>
    </>
  );
  const className = styles.category;

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
    <section className={styles.safety} aria-label={text("التعامل الآمن", "Safe trading")}>
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
  action,
}: {
  title: ReactNode;
  eyebrow: string;
  action: ReactNode;
}) {
  return (
    <header className={styles.sectionHeader}>
      <div>
        <small>{eyebrow}</small>
        <h2>{title}</h2>
      </div>
      <div>{action}</div>
    </header>
  );
}
