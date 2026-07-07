import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Briefcase,
  Building2,
  Car,
  ChevronRight,
  Filter,
  GraduationCap,
  Grid3X3,
  Laptop,
  PawPrint,
  Search,
  ShieldAlert,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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

const categoryIcons: Record<string, LucideIcon> = {
  car: Car,
  realestate: Building2,
  phone: Smartphone,
  electronics: Laptop,
  furniture: Building2,
  job: Briefcase,
  service: Wrench,
  fashion: Shirt,
  food: Utensils,
  animals: PawPrint,
  education: GraduationCap,
  business: Store,
  misc: Sparkles,
};

function iconForCategoryPlaceholder(placeholder: string | null | undefined): LucideIcon {
  if (placeholder && categoryIcons[placeholder]) return categoryIcons[placeholder];
  return Grid3X3;
}

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
        <section className="hero-navy relative overflow-hidden rounded-3xl p-4 shadow-premium sm:p-6 lg:p-8">
          <div className="relative z-10">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold ring-1 ring-white/15">
              <Sparkles className="h-3 w-3" />
              {text("سوق سوريا للإعلانات المبوبة", "Syria classifieds marketplace")}
            </p>
            <h1 className="text-[1.35rem] font-extrabold leading-tight text-primary-foreground sm:text-3xl lg:text-4xl">
              {text(
                "اعثر على كل ما تحتاجه في سوريا",
                "Find everything you need in Syria",
              )}
              <span className="block text-brand-orange">
                {text("بطريقة منظمة وموثوقة", "in one organized marketplace")}
              </span>
            </h1>

            <form onSubmit={handleSearch} className="mt-4 flex items-stretch gap-2 sm:mt-5">
              <label className="group flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/95 ps-3 pe-4 text-foreground shadow-soft transition focus-within:ring-[3px] focus-within:ring-brand-orange">
                <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  type="search"
                  aria-label={text("ابحث في رواج", "Search RAWAJ")}
                  placeholder={text(
                    "سيارة، جوال، عقار، خدمة...",
                    "Car, phone, property, service...",
                  )}
                  className="w-full bg-transparent py-2.5 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-brand-orange px-4 text-xs font-extrabold shadow-soft transition hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white"
              >
                {text("بحث", "Search")}
              </button>
              <Link
                to="/listings"
                search={listingSearch({ open_filters: true })}
                aria-label={text("فلترة", "Filters")}
                title={text("فلترة", "Filters")}
                className="grid min-h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-primary-foreground ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 hover:text-gold active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white"
              >
                <Filter className="h-4.5 w-4.5" />
              </Link>
            </form>
          </div>
          {/* Geometric decor plane */}
          <span
            className="pointer-events-none absolute -end-16 -top-16 z-0 h-52 w-52 rotate-12 rounded-3xl opacity-30"
            style={{
              background:
                "linear-gradient(140deg, rgba(224,118,43,0.6), rgba(224,118,43,0) 70%)",
            }}
            aria-hidden="true"
          />
        </section>

        {categories.length > 0 && (
          <section className="mt-5" aria-label={text("اكتشاف سريع", "Quick discovery")}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-extrabold text-primary">
                {text("تصفح سريع", "Quick browse")}
              </h2>
              <Link
                to="/categories"
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary transition-colors hover:text-brand-orange"
              >
                {text("كل الأقسام", "All categories")}
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </div>
            <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
              {categories.slice(0, 10).map((category) => {
                const Icon = iconForCategoryPlaceholder(category.placeholder);
                return (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={{ category: category.id }}
                    className="group snap-start flex min-h-20 w-[88px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl bg-card p-2 text-center hairline shadow-soft transition hover:-translate-y-0.5 hover:border-brand-orange/40 active:scale-[0.98]"
                  >
                    <span className="category-tile transition group-hover:text-brand-orange">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="line-clamp-2 text-[11px] font-bold leading-tight text-foreground">
                      {categoryName(category.id, category.nameAr, language)}
                    </span>
                  </Link>
                );
              })}
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

        <section className="mt-6 rounded-2xl bg-card p-4 hairline shadow-soft lg:mt-8">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-orange/12 text-brand-orange">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-extrabold text-primary">{text("تعامل بأمان", "Trade safely")}</h3>
          </div>
          <ul className="mt-3 grid gap-1 text-xs leading-6 text-muted-foreground sm:grid-cols-3">
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
        <div className="listing-card-grid">
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
