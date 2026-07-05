import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Clock, Filter, MapPin, Search, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { SectionHeader } from "@/components/SectionHeader";
import { fetchPublicListings } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

const HOME_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const HOME_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة منظمة وواضحة.";

export const Route = createFileRoute("/")({
  head: () => createSeo({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { text } = useUiPreferences();
  const [searchValue, setSearchValue] = useState("");
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const listingsResult = await fetchPublicListings();
      if (cancelled) return;
      if (!listingsResult.ok) setError(listingsResult.error);
      else setListings(listingsResult.data);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredListings = listings.filter((listing) => listing.isFeatured).slice(0, 6);
  const latestListings = listings.slice(0, 12);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchValue.trim();
    void navigate({ to: "/listings", search: q ? { q } : {} });
  }

  const currentSearchQuery = searchValue.trim();
  const listingSearch = (extra: { open_filters?: boolean } = {}) =>
    currentSearchQuery ? { q: currentSearchQuery, ...extra } : extra;

  return (
    <>
      <AppHeader />
      <main className="container-wide mobile-page-bottom pt-4 sm:pt-6 lg:pt-8">
        <section className="bg-card-warm p-4 hairline sm:p-5 lg:p-6">
          <p className="text-xs font-extrabold text-primary sm:text-sm">
            {text("سوق إعلانات مبوبة في سوريا", "Classifieds marketplace in Syria")}
          </p>
          <h1 className="mt-1 max-w-3xl text-2xl font-extrabold leading-[1.2] text-foreground sm:text-3xl lg:text-4xl">
            {text("ابحث عن حاجتك بوضوح", "Find what you need clearly")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            {text(
              "ابدأ بالبحث أو اختر قسماً، ثم انتقل إلى النتائج للتصفية حسب الموقع والسعر والتفاصيل.",
              "Start with search or a category, then refine by location, price, and details in results.",
            )}
          </p>
        </section>

        <section className="mt-4 bg-card p-3 hairline sm:p-4">
          <form
            onSubmit={handleSearch}
            className="flex items-stretch gap-2"
          >
            <label className="group flex min-h-11 flex-1 items-center gap-2 rounded-xl bg-muted-surface ps-2 pe-3 hairline focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
              <button
                type="submit"
                aria-label={text("بحث", "Search")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-primary focus:outline-none"
              >
                <Search className="h-4.5 w-4.5" />
              </button>
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                type="search"
                aria-label={text("ابحث في رواج", "Search RAWAJ")}
                placeholder={text(
                  "ابحث عن سيارة، جوال، عقار، خدمة...",
                  "Search for a car, phone, property, service...",
                )}
                className="w-full bg-transparent py-2 text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Link
              to="/listings"
              search={listingSearch({ open_filters: true })}
              aria-label={text("فلترة", "Filters")}
              title={text("فلترة", "Filters")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card text-foreground hairline transition hover:border-gold/60 hover:text-primary active:scale-[0.98]"
            >
              <Filter className="h-4.5 w-4.5" />
            </Link>
          </form>

        </section>

        {loading ? (
          <HomeState title={text("جاري تحميل الإعلانات", "Loading listings")} />
        ) : error ? (
          <HomeState
            title={text("تعذر تحميل بيانات السوق", "Could not load marketplace data")}
            body={error.message}
          />
        ) : (
          <>
            {featuredListings.length > 0 && (
              <ListingsSection
                title={text("إعلانات مميزة", "Featured listings")}
                subtitle={text(
                  "إعلانات مميزة متاحة حالياً بعد مراجعة الإدارة.",
                  "Currently available featured listings after admin review.",
                )}
                listings={featuredListings}
                empty=""
              />
            )}

            <ListingsSection
              title={text("أحدث الإعلانات", "Latest listings")}
              subtitle={text(
                "إعلانات معتمدة حديثاً من السوق.",
                "Recently reviewed marketplace listings.",
              )}
              listings={latestListings}
              empty={text("لا توجد إعلانات معتمدة للعرض.", "No reviewed listings to show.")}
            />
          </>
        )}

        <section className="mt-8 bg-card-warm p-4 hairline lg:mt-10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
            <h3 className="text-sm font-extrabold">{text("تعامل بأمان", "Trade safely")}</h3>
          </div>
          <ul className="mt-2 grid gap-1.5 text-xs leading-6 text-muted-foreground sm:grid-cols-3">
            <li>{text("كل إعلان يظهر بعد المراجعة.", "Listings appear after review.")}</li>
            <li>{text("افحص السلعة قبل الدفع.", "Inspect before paying.")}</li>
            <li>{text("قابل البائع في مكان عام وآمن.", "Meet in a public place.")}</li>
          </ul>
        </section>
      </main>
    </>
  );
}

function ListingsSection({
  title,
  subtitle,
  listings,
  empty,
}: {
  title: string;
  subtitle: string;
  listings: ClassifiedListing[];
  empty: string;
}) {
  const { text } = useUiPreferences();
  return (
    <section className="mt-8 lg:mt-10">
      <SectionHeader
        title={title}
        action={{ label: text("عرض الكل", "View all"), to: "/listings" }}
      />
      <p className="mb-4 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      {listings.length === 0 ? (
        <HomeState title={empty} compact />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {listings.map((listing) => (
            <HomeListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}

function HomeListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="block overflow-hidden bg-card hairline tap-card"
    >
      <div className="relative">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <div className="absolute top-2 start-2 flex flex-wrap gap-1">
          {listing.isFeatured && (
            <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
              {text("مميز", "Featured")}
            </span>
          )}
          <span className="rounded-md bg-muted-surface/95 px-2 py-0.5 text-[11px] font-semibold text-foreground">
            {text("إعلان مُراجع", "Reviewed listing")}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-lg font-extrabold text-foreground">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {governorateName(listing.governorateId, listing.governorateNameAr, language)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(listing.createdAt, language)}
          </span>
        </div>
        <p className="truncate text-[11px] font-semibold text-gold">
          {listing.categoryNameAr
            ? categoryName(listing.categoryId, listing.categoryNameAr, language)
            : listing.categoryId}
        </p>
      </div>
    </Link>
  );
}

function HomeState({
  title,
  body,
  compact = false,
}: {
  title: string;
  body?: string;
  compact?: boolean;
}) {
  return (
    <div className={`bg-card text-center hairline ${compact ? "p-5" : "mt-6 p-10"}`}>
      <p className="text-sm font-bold text-foreground">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </div>
  );
}

function formatDate(value: string, language: "ar" | "en") {
  if (!value) return language === "ar" ? "تاريخ غير محدد" : "Date unavailable";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
