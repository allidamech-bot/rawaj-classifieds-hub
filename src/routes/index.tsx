import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
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
import type { ClassifiedCategory, ClassifiedListing } from "@/lib/classifieds-types";
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

const quickSearches: Array<{
  query: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
}> = [
  { query: "سيارة", labelAr: "سيارات", labelEn: "Cars", icon: Car },
  { query: "شقة للإيجار", labelAr: "شقق للإيجار", labelEn: "Apartments", icon: Building2 },
  { query: "موبايل", labelAr: "موبايلات", labelEn: "Phones", icon: Smartphone },
  { query: "وظيفة", labelAr: "وظائف", labelEn: "Jobs", icon: Briefcase },
];

function iconForCategoryPlaceholder(placeholder: string | null | undefined): LucideIcon {
  if (placeholder && categoryIcons[placeholder]) return categoryIcons[placeholder];
  return Grid3X3;
}

const HOME_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const HOME_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة منظمة وواضحة.";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [listingsResult, categoriesResult] = await Promise.all([
      fetchPublicListings({}, null, 18),
      fetchPublicCategories(),
    ]);

    return {
      listings: listingsResult.ok ? listingsResult.data.items : [],
      categories: categoriesResult.ok ? categoriesResult.data : [],
      error: listingsResult.ok ? null : listingsResult.error,
    };
  },
  head: () => createSeo({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const { listings, categories, error } = Route.useLoaderData();
  const [searchValue, setSearchValue] = useState("");

  const featuredListings = listings.filter((listing) => listing.isFeatured).slice(0, 6);
  const featuredListingIds = new Set(featuredListings.map((listing) => listing.id));
  const latestListings = listings
    .filter((listing) => !featuredListingIds.has(listing.id))
    .slice(0, 12);

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
        <section className="rawaj-home-stage rawaj-home-v2-hero" aria-labelledby="rawaj-home-title">
          <div className="relative z-10 grid min-h-[20rem] gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.82fr)] lg:items-end lg:gap-12 lg:p-9">
            <div className="self-end">
              <p className="rawaj-signature-kicker rawaj-home-kicker">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                {text("سوق سوريا الحديث", "Syria's modern marketplace")}
              </p>
              <h1
                id="rawaj-home-title"
                className="rawaj-home-title mt-3 max-w-xl text-[1.75rem] font-extrabold leading-[1.34] sm:text-[2.35rem] lg:text-[2.9rem]"
              >
                {text(
                  "كل ما تحتاجه في سوريا، أقرب مما تتوقع.",
                  "Everything you need in Syria, closer than you think.",
                )}
              </h1>
              <p className="rawaj-home-description mt-3 max-w-xl text-[12px] leading-6 sm:text-sm sm:leading-7">
                {text(
                  "اكتشف السيارات والعقارات والمنتجات والخدمات، وتواصل مباشرة مع أشخاص ومتاجر قريبين منك.",
                  "Discover vehicles, homes, products, and services, then connect directly with people and stores near you.",
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rawaj-home-value-chip rounded-full px-3 py-1.5 text-[10px] font-bold sm:text-[11px]">
                  {text("إعلانات مجانية", "Free listings")}
                </span>
                <span className="rawaj-home-value-chip rounded-full px-3 py-1.5 text-[10px] font-bold sm:text-[11px]">
                  {text("تواصل مباشر", "Direct contact")}
                </span>
                <span className="rawaj-home-value-chip rounded-full px-3 py-1.5 text-[10px] font-bold sm:text-[11px]">
                  {text("سوق لكل سوريا", "Across Syria")}
                </span>
              </div>
            </div>

            <div className="rawaj-home-search-shell p-3 sm:p-4">
              <form onSubmit={handleSearch} className="flex items-stretch gap-2">
                <label className="rawaj-home-search-input group flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-[1.05rem] ps-3.5 pe-4 text-foreground transition focus-within:ring-[3px] focus-within:ring-brand-orange/28">
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
                  className="rawaj-home-search-submit grid min-h-14 w-14 shrink-0 place-items-center rounded-[1.05rem] text-white transition hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Search className="h-5 w-5" strokeWidth={2} />
                </button>
              </form>

              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  className="rawaj-home-location inline-flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold transition"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-gold" strokeWidth={1.9} />
                  <span className="truncate">{text("كل سوريا", "All Syria")}</span>
                  <span className="ms-auto text-[9px] font-semibold text-muted-foreground">
                    {text("تغيير", "Change")}
                  </span>
                </Link>
                <Link
                  to="/listings"
                  search={listingSearch({ open_filters: true })}
                  aria-label={text("الفلاتر", "Filters")}
                  className="rawaj-home-filter grid h-10 w-10 shrink-0 place-items-center rounded-xl transition"
                >
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={1.9} />
                </Link>
              </div>

              <div className="rawaj-home-shortcuts mt-3 pt-3">
                <span className="text-[9px] font-bold text-white/55">
                  {text("اختصارات البحث", "Quick searches")}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quickSearches.map((shortcut) => {
                    const Icon = shortcut.icon;
                    return (
                      <Link
                        key={shortcut.query}
                        to="/listings"
                        search={{ q: shortcut.query }}
                        className="rawaj-home-shortcut inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[9px] font-bold sm:text-[10px]"
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                        {text(shortcut.labelAr, shortcut.labelEn)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {categories.length > 0 ? (
          <section
            className="rawaj-home-v2-section rawaj-home-v2-categories"
            aria-label={text("الأقسام", "Categories")}
          >
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
                      <span className="rawaj-category-icon grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] transition group-hover:-translate-y-0.5">
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

        {error ? (
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
                tone="featured"
              />
            ) : null}

            <ListingsSection
              kicker={text("وصل حديثًا", "Just arrived")}
              title={text("أحدث الإعلانات", "Latest listings")}
              listings={latestListings}
              empty={text("لا توجد إعلانات معتمدة للعرض.", "No reviewed listings to show.")}
              tone="latest"
            />
          </>
        )}

        <section className="rawaj-home-trust-stage mt-8">
          <div className="relative z-10 flex items-start gap-3 p-5 sm:p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-orange text-white shadow-[0_12px_28px_rgba(244,95,56,0.25)]">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <span className="rawaj-signature-kicker text-emerald-trust">
                {text("ثقة تبدأ منك", "Confidence starts with you")}
              </span>
              <h3 className="mt-1 text-sm font-extrabold text-primary">
                {text("تعامل بوعي", "Trade smart")}
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground sm:text-xs">
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
  tone,
}: {
  kicker: string;
  title: string;
  listings: ClassifiedListing[];
  empty: string;
  tone: "featured" | "latest";
}) {
  const { text } = useUiPreferences();
  return (
    <section className={`rawaj-home-v2-section rawaj-home-v2-listings rawaj-home-tone-${tone}`}>
      <SectionHeading
        kicker={kicker}
        title={title}
        actionLabel={text("عرض الكل", "View all")}
        actionTo="/listings"
      />
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
    <div className="rawaj-home-section-heading mb-4 flex items-end justify-between gap-3">
      <div>
        <span className="rawaj-signature-kicker">{kicker}</span>
        <h2 className="rawaj-section-title mt-1">{title}</h2>
      </div>
      <Link
        to={actionTo}
        className="rawaj-home-section-action inline-flex items-center gap-1 text-[10px] font-bold transition-colors sm:text-[11px]"
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
