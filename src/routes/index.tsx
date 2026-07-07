import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  Briefcase,
  Building2,
  Car,
  ChevronRight,
  GraduationCap,
  Grid3X3,
  Laptop,
  MapPin,
  PawPrint,
  Search,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
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
      <main className="home-container mobile-page-bottom pt-2.5 sm:pt-5 lg:pt-7">
        <section className="relative overflow-hidden rounded-[1.75rem] bg-card p-3.5 hairline shadow-premium-sm sm:p-5 lg:p-7">
          <div
            className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
            aria-hidden="true"
          />
          <div className="relative z-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)] lg:items-end lg:gap-10">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/7 px-2.5 py-1 text-[10px] font-extrabold text-primary">
                <Sparkles className="h-3 w-3 text-brand-orange" />
                {text("سوق سوريا الحديث", "Syria's modern marketplace")}
              </p>
              <h1 className="mt-2 max-w-xl text-[1.35rem] font-extrabold leading-[1.35] text-primary sm:text-3xl lg:text-[2.2rem]">
                {text("ابحث. قارن. وتواصل بسهولة.", "Search, compare, and connect easily.")}
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-6 text-muted-foreground sm:text-sm">
                {text(
                  "إعلانات واضحة، وصول أسرع، وتجربة مصممة للجوال أولًا.",
                  "Clear listings, faster discovery, and a mobile-first experience.",
                )}
              </p>
            </div>

            <div className="mt-4 lg:mt-0">
              <form onSubmit={handleSearch} className="flex items-stretch gap-2">
                <label className="group flex min-h-13 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-border bg-background/70 ps-3.5 pe-4 text-foreground transition focus-within:border-brand-orange focus-within:bg-card focus-within:ring-[3px] focus-within:ring-brand-orange/20">
                  <Search className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} />
                  <input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    type="search"
                    aria-label={text("ابحث في رواج", "Search RAWAJ")}
                    placeholder={text(
                      "ماذا تبحث عنه؟ سيارة، عقار، جوال...",
                      "What are you looking for?",
                    )}
                    className="w-full bg-transparent py-3 text-sm font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground"
                  />
                </label>
                <button
                  type="submit"
                  aria-label={text("بحث", "Search")}
                  className="grid min-h-13 w-13 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft transition hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Search className="h-5 w-5" strokeWidth={2.1} />
                </button>
              </form>

              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-background/75 px-3 text-xs font-bold text-primary transition hover:bg-muted-surface"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-brand-orange" strokeWidth={1.9} />
                  <span className="truncate">{text("كل سوريا", "All Syria")}</span>
                  <span className="ms-auto text-[10px] font-bold text-muted-foreground">
                    {text("تغيير", "Change")}
                  </span>
                </Link>
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  aria-label={text("الفلاتر", "Filters")}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background/75 text-primary transition hover:bg-muted-surface"
                >
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={1.9} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {categories.length > 0 ? (
          <section className="mt-5" aria-label={text("الأقسام", "Categories")}>
            <SectionHeading
              title={text("تصفح الأقسام", "Browse categories")}
              actionLabel={text("عرض الكل", "View all")}
              actionTo="/categories"
            />
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:gap-3">
              {categories.slice(0, 6).map((category) => {
                const Icon = iconForCategoryPlaceholder(category.placeholder);
                return (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={{ category: category.id }}
                    className="group flex min-h-[5.8rem] flex-col items-center justify-center gap-2 rounded-2xl bg-card px-2 py-3 text-center hairline transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-soft active:scale-[0.98]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/7 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span className="line-clamp-1 text-[11px] font-extrabold leading-tight text-foreground sm:text-xs">
                      {categoryName(category.id, category.nameAr, language)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {loading ? (
          <HomeState title={text("جاري تحميل الإعلانات", "Loading listings")} />
        ) : error ? (
          <HomeState
            title={text("تعذر تحميل بيانات السوق", "Could not load marketplace data")}
            body={error.message}
          />
        ) : (
          <>
            {featuredListings.length > 0 ? (
              <ListingsSection
                title={text("مختارات مميزة", "Featured picks")}
                listings={featuredListings}
                empty=""
                mobileRail
              />
            ) : null}

            <ListingsSection
              title={text("أحدث الإعلانات", "Latest listings")}
              listings={latestListings}
              empty={text("لا توجد إعلانات معتمدة للعرض.", "No reviewed listings to show.")}
            />
          </>
        )}

        <section className="mt-6 rounded-[1.4rem] bg-primary p-4 text-primary-foreground shadow-premium-sm lg:mt-8 lg:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-gold ring-1 ring-white/10">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="text-sm font-extrabold">{text("تعامل بوعي", "Trade smart")}</h3>
              <p className="mt-1 text-[11px] leading-5 text-primary-foreground/70 sm:text-xs">
                {text(
                  "افحص السلعة قبل الدفع، وتواصل بوضوح، واختر مكانًا عامًا للقاء.",
                  "Inspect before paying, communicate clearly, and meet in a public place.",
                )}
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function ListingsSection({
  title,
  listings,
  empty,
  mobileRail = false,
}: {
  title: string;
  listings: ClassifiedListing[];
  empty: string;
  mobileRail?: boolean;
}) {
  const { text } = useUiPreferences();
  return (
    <section className="mt-6 first:mt-5 lg:mt-8">
      <SectionHeading
        title={title}
        actionLabel={text("عرض الكل", "View all")}
        actionTo="/listings"
      />
      {listings.length === 0 ? (
        <HomeState title={empty} compact />
      ) : mobileRail ? (
        <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <div key={listing.id} className="w-[10.8rem] shrink-0 snap-start sm:w-auto">
              <RealListingCard listing={listing} />
            </div>
          ))}
        </div>
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

function SectionHeading({
  title,
  actionLabel,
  actionTo,
}: {
  title: string;
  actionLabel: string;
  actionTo: "/categories" | "/listings";
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[1rem] font-extrabold text-primary sm:text-lg">{title}</h2>
      <Link
        to={actionTo}
        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-muted-foreground transition-colors hover:text-brand-orange"
      >
        {actionLabel}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </Link>
    </div>
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
    <div
      className={`rounded-2xl bg-card text-center hairline ${compact ? "p-5" : "mt-6 p-8"}`}
    >
      <p className="text-sm font-bold text-foreground">{title}</p>
      {body ? <p className="mt-1 text-xs text-muted-foreground">{body}</p> : null}
    </div>
  );
}
