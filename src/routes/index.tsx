import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Car,
  ChevronRight,
  GraduationCap,
  Grid3X3,
  Laptop,
  MapPin,
  PawPrint,
  Plus,
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
      <main className="home-container mobile-page-bottom pb-8 pt-2 sm:pt-4 lg:pt-6">
        <section className="rawaj-home-stage" aria-labelledby="rawaj-home-title">
          <div className="rawaj-home-facet" aria-hidden="true">
            <img src="/brand/rawaj-mark-transparent-512.png" alt="" decoding="async" />
          </div>

          <div className="rawaj-home-copy">
            <p className="rawaj-signature-kicker rawaj-home-kicker">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
              {text("السوق الأقرب لكل سوريا", "The marketplace closer to all Syria")}
            </p>
            <h1 id="rawaj-home-title" className="rawaj-home-title">
              {text(
                "كل ما تبحث عنه، أقرب مما تتخيّل.",
                "Everything you need, closer than you think.",
              )}
            </h1>
            <p className="rawaj-home-description">
              {text(
                "اكتشف إعلانات من مختلف المحافظات، قارن بسهولة، وتواصل مباشرة مع البائع.",
                "Discover listings across Syria, compare easily, and contact sellers directly.",
              )}
            </p>
            <div className="rawaj-home-proof">
              <span>
                <BadgeCheck className="h-3.5 w-3.5" />
                {text("إعلانات معتمدة للعرض", "Approved public listings")}
              </span>
              <span>
                <MapPin className="h-3.5 w-3.5" />
                {text("كل المحافظات", "All governorates")}
              </span>
            </div>
          </div>

          <div className="rawaj-home-search-shell">
            <form onSubmit={handleSearch} className="rawaj-home-search-form">
              <label className="rawaj-home-search-field">
                <Search className="h-5 w-5 shrink-0" strokeWidth={2} />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  type="search"
                  aria-label={text("ابحث في رواج", "Search RAWAJ")}
                  placeholder={text(
                    "ابحث عن سيارة، منزل، هاتف...",
                    "Search for a car, home, phone...",
                  )}
                />
              </label>
              <button type="submit" aria-label={text("بحث", "Search")}>
                <Search className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </form>

            <div className="rawaj-home-quick-actions">
              <Link to="/listings" search={listingSearch({ open_filters: true })}>
                <MapPin className="h-4 w-4" />
                <span>{text("كل سوريا", "All Syria")}</span>
              </Link>
              <Link to="/listings" search={listingSearch({ open_filters: true })}>
                <SlidersHorizontal className="h-4 w-4" />
                <span>{text("تصفية", "Filter")}</span>
              </Link>
              <Link to="/add-listing" className="rawaj-home-post-action">
                <Plus className="h-4 w-4" />
                <span>{text("أضف إعلانك", "Post listing")}</span>
              </Link>
            </div>
          </div>
        </section>

        {categories.length > 0 ? (
          <section className="rawaj-home-section" aria-label={text("الأقسام", "Categories")}>
            <SectionHeading
              kicker={text("اكتشف السوق", "Explore the market")}
              title={text("تصفح الأقسام", "Browse categories")}
              actionLabel={text("عرض الكل", "View all")}
              actionTo="/categories"
            />
            <div className="rawaj-category-rail no-scrollbar">
              {categories.slice(0, 6).map((category, index) => {
                const Icon = iconForCategoryPlaceholder(category.placeholder);
                return (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={{ category: category.id }}
                    className="rawaj-home-category-card group"
                    data-facet={index % 3}
                  >
                    <div className="rawaj-home-category-inner">
                      <span className="rawaj-category-icon">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-[12px] font-bold text-foreground">
                          {categoryName(category.id, category.nameAr, language)}
                        </span>
                        <span className="mt-1 block text-[9px] font-medium text-muted-foreground">
                          {text("تصفّح الآن", "Browse now")}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rawaj-market-promise" aria-label={text("مزايا رواج", "RAWAJ benefits")}>
          <span>{text("بيع مباشر", "Direct selling")}</span>
          <span>{text("تصفح سريع", "Fast discovery")}</span>
          <span>{text("تواصل واضح", "Clear contact")}</span>
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

        <section className="rawaj-home-trust-stage">
          <div className="relative z-10 flex items-start gap-3 p-5 sm:p-6">
            <span className="rawaj-trust-icon">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <span className="rawaj-signature-kicker">
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
