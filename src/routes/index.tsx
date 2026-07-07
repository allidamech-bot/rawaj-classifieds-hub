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
      <main className="home-container mobile-page-bottom pt-3 sm:pt-5 lg:pt-7">
        <section className="rawaj-hero-surface rounded-[1.65rem] p-4 sm:rounded-[2rem] sm:p-6 lg:p-8">
          <div className="relative z-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(25rem,0.82fr)] lg:items-end lg:gap-12">
            <div className="ps-1 sm:ps-2">
              <p className="rawaj-eyebrow">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                {text("سوق سوريا الحديث", "Syria's modern marketplace")}
              </p>
              <h1 className="mt-2.5 max-w-xl text-[1.45rem] font-bold leading-[1.42] text-primary sm:text-[2rem] lg:text-[2.45rem] lg:leading-[1.35]">
                {text("ابحث عمّا يستحق. وتواصل بثقة.", "Find what matters. Connect with confidence.")}
              </h1>
              <p className="mt-2 max-w-xl text-[12px] leading-6 text-muted-foreground sm:text-sm sm:leading-7">
                {text(
                  "إعلانات أوضح، وصول أسرع، وتجربة هادئة صُممت للجوال أولًا.",
                  "Clearer listings, faster discovery, and a calm mobile-first experience.",
                )}
              </p>
            </div>

            <div className="mt-5 lg:mt-0">
              <form onSubmit={handleSearch} className="flex items-stretch gap-2">
                <label className="group flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-[1.1rem] border border-border/90 bg-card/88 ps-3.5 pe-4 text-foreground shadow-[0_8px_26px_rgba(16,43,70,0.055)] transition focus-within:border-brand-orange/70 focus-within:bg-card focus-within:ring-[3px] focus-within:ring-brand-orange/12">
                  <Search className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.85} />
                  <input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    type="search"
                    aria-label={text("ابحث في رواج", "Search RAWAJ")}
                    placeholder={text(
                      "ماذا تبحث عنه؟ سيارة، عقار، جوال...",
                      "What are you looking for?",
                    )}
                    className="w-full bg-transparent py-3 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
                  />
                </label>
                <button
                  type="submit"
                  aria-label={text("بحث", "Search")}
                  className="rawaj-button-primary grid min-h-14 w-14 shrink-0 place-items-center rounded-[1.1rem] p-0"
                >
                  <Search className="h-5 w-5" strokeWidth={2} />
                </button>
              </form>

              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/70 bg-card/72 px-3 text-[11px] font-semibold text-primary transition hover:bg-card"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-brand-orange" strokeWidth={1.85} />
                  <span className="truncate">{text("كل سوريا", "All Syria")}</span>
                  <span className="ms-auto text-[9px] font-semibold text-muted-foreground">
                    {text("تغيير", "Change")}
                  </span>
                </Link>
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  aria-label={text("الفلاتر", "Filters")}
                  className="rawaj-icon-button h-10 w-10 shrink-0 rounded-xl"
                >
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={1.85} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {categories.length > 0 ? (
          <section className="mt-6" aria-label={text("الأقسام", "Categories")}>
            <SectionHeading
              title={text("تصفح الأقسام", "Browse categories")}
              actionLabel={text("عرض الكل", "View all")}
              actionTo="/categories"
            />
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 lg:gap-3.5">
              {categories.slice(0, 6).map((category) => {
                const Icon = iconForCategoryPlaceholder(category.placeholder);
                return (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={{ category: category.id }}
                    className="group rawaj-surface tap-card flex min-h-[6.2rem] flex-col items-center justify-center gap-2 rounded-[1.15rem] px-2 py-3.5 text-center hover:-translate-y-0.5 hover:border-gold/50 active:scale-[0.985]"
                  >
                    <span className="category-tile h-10 w-10 transition duration-200 group-hover:border-gold/45 group-hover:text-brand-orange sm:h-11 sm:w-11">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="line-clamp-1 text-[10.5px] font-semibold leading-tight text-foreground sm:text-[11.5px]">
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

        <section className="relative mt-7 overflow-hidden rounded-[1.5rem] bg-primary p-4 text-primary-foreground shadow-premium-sm lg:mt-9 lg:p-5">
          <span className="absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-brand-orange to-gold" />
          <span className="absolute -end-16 -top-16 h-40 w-40 rounded-full bg-gold/8 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/8 text-gold ring-1 ring-white/10">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-sm font-bold">{text("تعامل بوعي", "Trade smart")}</h3>
              <p className="mt-1 text-[11px] leading-5 text-primary-foreground/72 sm:text-xs">
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
    <section className="mt-7 first:mt-6 lg:mt-9">
      <SectionHeading
        title={title}
        actionLabel={text("عرض الكل", "View all")}
        actionTo="/listings"
      />
      {listings.length === 0 ? (
        <HomeState title={empty} compact />
      ) : mobileRail ? (
        <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <div key={listing.id} className="w-[11rem] shrink-0 snap-start sm:w-auto">
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
    <div className="mb-3.5 flex items-end justify-between gap-3">
      <div>
        <span className="mb-1 block h-0.5 w-7 rounded-full bg-gradient-to-r from-brand-orange to-gold" />
        <h2 className="rawaj-section-title">{title}</h2>
      </div>
      <Link
        to={actionTo}
        className="inline-flex items-center gap-1 pb-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-brand-orange sm:text-[11px]"
      >
        {actionLabel}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={1.8} />
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
      className={`rawaj-surface rounded-[1.25rem] text-center ${compact ? "p-5" : "mt-7 p-8"}`}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p> : null}
    </div>
  );
}
