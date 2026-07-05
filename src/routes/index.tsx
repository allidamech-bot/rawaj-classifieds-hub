import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Clock, ChevronRight, Filter, MapPin, Search, ShieldAlert } from "lucide-react";
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
      const listingsResult = await fetchPublicListings({}, null, 30);
      if (cancelled) return;
      if (!listingsResult.ok) setError(listingsResult.error);
      else setListings(listingsResult.data.items);
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
      <main className="home-container mobile-page-bottom pt-4 sm:pt-6 lg:pt-8">
        <section className="relative overflow-hidden rounded-[1.25rem] bg-ivory-subtle hairline p-5 sm:p-7 lg:p-8">
          <span
            className="pointer-events-none absolute -top-24 -start-24 h-64 w-64 rounded-full bg-gold/[0.07] blur-3xl"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -bottom-28 -end-16 h-72 w-72 rounded-full bg-primary/[0.04] blur-3xl"
            aria-hidden="true"
          />
          <p className="relative text-[11px] font-extrabold tracking-[0.22em] text-gold sm:text-xs">
            {text("سوق إعلانات مبوبة في سوريا", "Classifieds marketplace in Syria")}
          </p>
          <h1 className="relative mt-2 max-w-3xl text-[1.65rem] font-extrabold leading-[1.15] text-primary sm:text-3xl lg:text-[2.05rem]">
            {text("ابحث عن حاجتك بوضوح", "Find what you need clearly")}
          </h1>
          <p className="relative mt-2.5 max-w-2xl text-[13px] leading-7 text-muted-foreground sm:text-sm">
            {text(
              "ابدأ بالبحث، ثم استخدم الفلاتر للوصول إلى النتائج حسب الموقع والسعر والتفاصيل.",
              "Start with search, then use filters to refine results by location, price, and details.",
            )}
          </p>
        </section>

        <section className="mt-3.5 sm:mt-4">
          <form onSubmit={handleSearch} className="flex items-stretch gap-2">
            <label className="group flex min-h-11 flex-1 items-center gap-2 rounded-2xl bg-ivory-subtle hairline ps-3 pe-4 transition focus-within:border-gold focus-within:ring-[3px] focus-within:ring-gold/20 has-focus-visible:ring-[3px] has-focus-visible:ring-gold/20">
              <button
                type="submit"
                aria-label={text("بحث", "Search")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-gold/10 hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:text-gold"
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
                className="w-full bg-transparent py-2.5 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Link
              to="/listings"
              search={listingSearch({ open_filters: true })}
              aria-label={text("فلترة", "Filters")}
              title={text("فلترة", "Filters")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ivory-subtle hairline text-foreground transition hover:border-gold/60 hover:text-gold active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-gold"
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
    <section className="mt-8 first:mt-0 lg:mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-extrabold text-primary">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        <Link
          to="/listings"
          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary transition-colors hover:text-gold"
        >
          {text("عرض الكل", "View all")} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>
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
      className="group block overflow-hidden rounded-2xl bg-card hairline shadow-premium-sm transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-premium active:scale-[0.99]"
    >
      <div className="relative">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent"
          aria-hidden="true"
        />
        {listing.isFeatured && (
          <div className="absolute top-2.5 start-2.5 flex flex-wrap gap-1">
            <span className="rounded-lg bg-white/95 px-2 py-0.5 text-[10px] font-bold text-gold shadow-sm">
              {text("مميز", "Featured")}
            </span>
          </div>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
          {listing.title}
        </h3>
        <div className="mt-1.5 text-base font-extrabold text-primary">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-gold/80" />
            {governorateName(listing.governorateId, listing.governorateNameAr, language)}
          </span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border" />
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-gold/80" />
            {formatDate(listing.createdAt, language)}
          </span>
        </div>
        <p className="truncate text-[11px] font-extrabold text-primary/70">
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
