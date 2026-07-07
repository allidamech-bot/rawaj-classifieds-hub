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

const categoryWorlds = [
  "rawaj-world-orange",
  "rawaj-world-indigo",
  "rawaj-world-emerald",
  "rawaj-world-plum",
  "rawaj-world-gold",
  "rawaj-world-orange",
];

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
        <section className="rawaj-home-stage">
          <div className="relative z-10 grid min-h-[18rem] gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.82fr)] lg:items-end lg:gap-12 lg:p-9">
            <div className="self-end">
              <p className="rawaj-signature-kicker text-gold">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                {text("سوق سوريا الحديث", "Syria's modern marketplace")}
              </p>
              <h1 className="mt-3 max-w-xl text-[1.65rem] font-extrabold leading-[1.36] text-[#fffaf0] sm:text-[2.25rem] lg:text-[2.8rem]">
                {text(
                  "ابحث عمّا يستحق. وتواصل بثقة.",
                  "Find what matters. Connect with confidence.",
                )}
              </h1>
              <p className="mt-3 max-w-xl text-[12px] leading-6 text-[#fffaf0]/68 sm:text-sm sm:leading-7">
                {text(
                  "إعلانات أوضح، وصول أسرع، وتجربة مصممة لتوصلك لما تحتاجه بدون تشويش.",
                  "Clearer listings, faster discovery, and a focused path to what you need.",
                )}
              </p>
            </div>

            <div className="rawaj-home-search-shell">
              <form onSubmit={handleSearch} className="flex items-stretch gap-2">
                <label className="group flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-[1.05rem] bg-white ps-3.5 pe-4 text-foreground shadow-[0_14px_34px_rgba(8,24,42,0.16)] ring-1 ring-white/50 transition focus-within:ring-[3px] focus-within:ring-brand-orange/28">
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
                    className="w-full bg-transparent py-3 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
                  />
                </label>
                <button
                  type="submit"
                  aria-label={text("بحث", "Search")}
                  className="grid min-h-14 w-14 shrink-0 place-items-center rounded-[1.05rem] bg-brand-orange text-white shadow-[0_14px_34px_rgba(232,111,50,0.28)] transition hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Search className="h-5 w-5" strokeWidth={2} />
                </button>
              </form>

              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/9 px-3 text-[11px] font-semibold text-[#fffaf0] ring-1 ring-white/10 transition hover:bg-white/13"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.9} />
                  <span className="truncate">{text("كل سوريا", "All Syria")}</span>
                  <span className="ms-auto text-[9px] font-semibold text-[#fffaf0]/52">
                    {text("تغيير", "Change")}
                  </span>
                </Link>
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  aria-label={text("الفلاتر", "Filters")}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/9 text-[#fffaf0] ring-1 ring-white/10 transition hover:bg-white/13"
                >
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={1.9} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {categories.length > 0 ? (
          <section className="mt-7" aria-label={text("الأقسام", "Categories")}>
            <SectionHeading
              kicker={text("اكتشف السوق", "Explore the market")}
              title={text("تصفح الأقسام", "Browse categories")}
              actionLabel={text("عرض الكل", "View all")}
              actionTo="/categories"
            />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3.5">
              {categories.slice(0, 6).map((category, index) => {
                const Icon = iconForCategoryPlaceholder(category.placeholder);
                return (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={{ category: category.id }}
                    className={`group rawaj-color-card ${categoryWorlds[index]} rawaj-home-category-card`}
                  >
                    <div className="relative z-10 flex items-center gap-3 lg:flex-col lg:items-start">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(16,43,70,0.14)] transition group-hover:-translate-y-0.5 group-hover:bg-brand-orange">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <span className="line-clamp-1 text-[11px] font-bold text-foreground sm:text-[12px]">
                          {categoryName(category.id, category.nameAr, language)}
                        </span>
                        <span className="mt-1 block text-[9px] font-semibold text-muted-foreground">
                          {text("عرض النتائج", "View listings")}
                        </span>
                      </div>
                    </div>
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
                kicker={text("مختارات رواج", "RAWAJ picks")}
                title={text("مختارات مميزة", "Featured picks")}
                listings={featuredListings}
                empty=""
                mobileRail
                tone="indigo"
              />
            ) : null}

            <ListingsSection
              kicker={text("وصل حديثًا", "Just arrived")}
              title={text("أحدث الإعلانات", "Latest listings")}
              listings={latestListings}
              empty={text("لا توجد إعلانات معتمدة للعرض.", "No reviewed listings to show.")}
              tone="orange"
            />
          </>
        )}

        <section className="rawaj-home-trust-stage mt-8">
          <div className="relative z-10 flex items-start gap-3 p-5 sm:p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-orange text-white shadow-[0_12px_28px_rgba(232,111,50,0.25)]">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <span className="rawaj-signature-kicker text-gold">
                {text("ثقة تبدأ منك", "Confidence starts with you")}
              </span>
              <h3 className="mt-1 text-sm font-extrabold text-[#fffaf0]">
                {text("تعامل بوعي", "Trade smart")}
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-[#fffaf0]/68 sm:text-xs">
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
  kicker,
  title,
  listings,
  empty,
  mobileRail = false,
  tone,
}: {
  kicker: string;
  title: string;
  listings: ClassifiedListing[];
  empty: string;
  mobileRail?: boolean;
  tone: "orange" | "indigo";
}) {
  const { text } = useUiPreferences();
  return (
    <section className={`rawaj-home-listings-section rawaj-home-tone-${tone}`}>
      <SectionHeading
        kicker={kicker}
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
  kicker,
  title,
  actionLabel,
  actionTo,
}: {
  kicker: string;
  title: string;
  actionLabel: string;
  actionTo: "/categories" | "/listings";
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <span className="rawaj-signature-kicker">{kicker}</span>
        <h2 className="mt-1 rawaj-section-title">{title}</h2>
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
      className={`rawaj-color-card rawaj-world-orange rounded-[1.25rem] text-center ${
        compact ? "p-5" : "mt-7 p-8"
      }`}
    >
      <p className="relative z-10 text-sm font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="relative z-10 mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
      ) : null}
    </div>
  );
}
