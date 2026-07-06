import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronRight, Filter, Grid3X3, Search, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { RealListingCard } from "@/features/listings/listings-components";
import { fetchPublicCategories, fetchPublicListings } from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedListing,
  ClassifiedsError,
} from "@/lib/classifieds-types";
import { categoryName } from "@/lib/i18n";
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
  const { language, text } = useUiPreferences();
  const [searchValue, setSearchValue] = useState("");
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [listingsResult, categoriesResult] = await Promise.all([
        fetchPublicListings({}, null, 30),
        fetchPublicCategories(),
      ]);
      if (cancelled) return;
      if (!listingsResult.ok) setError(listingsResult.error);
      else setListings(listingsResult.data.items);
      if (categoriesResult.ok) setCategories(categoriesResult.data);
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
      <main className="home-container mobile-page-bottom pt-3 sm:pt-5 lg:pt-7">
        <section className="rounded-2xl bg-card p-3.5 shadow-soft hairline sm:p-5">
          <p className="mb-2 text-[11px] font-extrabold text-gold">
            {text("سوق سوريا للإعلانات المبوبة", "Syria classifieds marketplace")}
          </p>
          <form onSubmit={handleSearch} className="flex items-stretch gap-2">
            <label className="group flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-ivory-subtle hairline ps-3 pe-4 transition focus-within:border-gold focus-within:ring-[3px] focus-within:ring-gold/20">
              <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
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
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-primary px-4 text-xs font-extrabold text-primary-foreground transition hover:bg-primary/95 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-gold"
            >
              {text("بحث", "Search")}
            </button>
            <Link
              to="/listings"
              search={listingSearch({ open_filters: true })}
              aria-label={text("فلترة", "Filters")}
              title={text("فلترة", "Filters")}
              className="grid min-h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ivory-subtle hairline text-foreground transition hover:border-gold/60 hover:text-gold active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Filter className="h-4.5 w-4.5" />
            </Link>
          </form>
        </section>

        {categories.length > 0 && (
          <section className="mt-4" aria-label={text("اكتشاف سريع", "Quick discovery")}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-extrabold text-primary">
                {text("تصفح سريع", "Quick browse")}
              </h2>
              <Link
                to="/categories"
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary transition-colors hover:text-gold"
              >
                {text("كل الأقسام", "All categories")}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {categories.slice(0, 8).map((category) => (
                <Link
                  key={category.id}
                  to="/listings"
                  search={{ category: category.id }}
                  className="group flex min-h-16 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-ivory-subtle p-2 text-center hairline transition hover:border-gold/40 hover:bg-card active:scale-[0.98]"
                >
                  <Grid3X3 className="h-4 w-4 text-primary transition group-hover:text-gold" />
                  <span className="line-clamp-2 text-[11px] font-bold leading-tight text-foreground">
                    {categoryName(category.id, category.nameAr, language)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

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
                listings={featuredListings}
                empty=""
              />
            )}

            <ListingsSection
              title={text("أحدث الإعلانات", "Latest listings")}
              listings={latestListings}
              empty={text("لا توجد إعلانات معتمدة للعرض.", "No reviewed listings to show.")}
            />
          </>
        )}

        <section className="mt-6 rounded-2xl bg-card-warm p-3.5 hairline lg:mt-8">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-warning" />
            <h3 className="text-sm font-extrabold">{text("تعامل بأمان", "Trade safely")}</h3>
          </div>
          <ul className="mt-2 grid gap-1 text-xs leading-6 text-muted-foreground sm:grid-cols-3">
            <li>{text("تظهر الإعلانات بعد المراجعة.", "Listings appear after review.")}</li>
            <li>{text("افحص السلعة قبل الدفع.", "Inspect before paying.")}</li>
            <li>{text("قابل البائع في مكان عام.", "Meet in a public place.")}</li>
          </ul>
        </section>
      </main>
    </>
  );
}

function ListingsSection({
  title,
  listings,
  empty,
}: {
  title: string;
  listings: ClassifiedListing[];
  empty: string;
}) {
  const { text } = useUiPreferences();
  return (
    <section className="mt-6 first:mt-5 lg:mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-extrabold text-primary">{title}</h2>
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
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <RealListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </section>
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
    <div className={`bg-card text-center hairline ${compact ? "p-5" : "mt-6 p-8"}`}>
      <p className="text-sm font-bold text-foreground">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </div>
  );
}
