import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Clock,
  Filter,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { SectionHeader } from "@/components/SectionHeader";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicListings,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
} from "@/lib/classifieds-types";
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

const sortChips = [
  { id: "latest", labelAr: "الأحدث", labelEn: "Latest" },
  { id: "cheapest", labelAr: "الأرخص", labelEn: "Lowest price" },
  { id: "expensive", labelAr: "الأعلى سعرًا", labelEn: "Highest price" },
  { id: "featured", labelAr: "المميز", labelEn: "Featured" },
] as const;

const quickSuggestions = [
  { label: "سيارات", search: { q: "سيارات" } },
  { label: "عقارات", search: { q: "عقارات" } },
  { label: "جوالات", search: { q: "جوالات" } },
  { label: "وظائف", search: { q: "وظائف" } },
  { label: "خدمات", search: { q: "خدمات" } },
  { label: "دمشق", search: { q: "دمشق" } },
  { label: "حلب", search: { q: "حلب" } },
];

function HomePage() {
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const [searchValue, setSearchValue] = useState("");
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [categoriesResult, governoratesResult, listingsResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicGovernorates(),
        fetchPublicListings(),
      ]);
      if (cancelled) return;
      if (!categoriesResult.ok) setError(categoriesResult.error);
      else if (!governoratesResult.ok) setError(governoratesResult.error);
      else if (!listingsResult.ok) setError(listingsResult.error);
      else {
        setCategories(categoriesResult.data);
        setGovernorates(governoratesResult.data);
        setListings(listingsResult.data);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredListings = listings.filter((listing) => listing.isFeatured).slice(0, 5);
  const latestListings = listings.slice(0, 9);
  const compactCategories = categories.slice(0, 10);

  const categoryCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const listing of listings) {
      result[listing.categoryId] = (result[listing.categoryId] ?? 0) + 1;
    }
    return result;
  }, [listings]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = searchValue.trim();
    void navigate({ to: "/listings", search: q ? { q } : {} });
  }

  const currentSearchQuery = searchValue.trim();
  const listingSearch = (
    extra: { sort?: "latest" | "cheapest" | "expensive" | "featured"; open_filters?: boolean } = {},
  ) => (currentSearchQuery ? { q: currentSearchQuery, ...extra } : extra);

  return (
    <>
      <AppHeader />
      <main className="container-wide mobile-page-bottom pt-4 sm:pt-6 lg:pt-8">
        <section className="relative overflow-hidden rounded-2xl bg-card-warm p-4 shadow-premium hairline sm:p-6 lg:p-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold text-primary sm:text-sm">
                {text("سوق إعلانات مبوبة في سوريا", "Classifieds marketplace in Syria")}
              </p>
              <h1 className="mt-2 max-w-4xl text-2xl font-extrabold leading-[1.2] text-foreground sm:text-4xl lg:text-5xl">
                {text("ابحث. قارن. تواصل مباشرة.", "Search. Compare. Contact directly.")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {text(
                  "رواج يضع الإعلانات المعتمدة أمامك بسرعة، مع بحث واضح وأقسام مرتبة حسب الحاجة.",
                  "RAWAJ puts reviewed listings first, with clear search and practical browsing.",
                )}
              </p>
            </div>
            <Link
              to="/add-listing"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-extrabold text-gold-foreground shadow-soft transition active:scale-[0.98] sm:w-fit"
            >
              <Plus className="h-4 w-4" />
              {text("أضف إعلان", "Post listing")}
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-card p-3 shadow-soft hairline sm:p-4 lg:p-5">
          <form onSubmit={handleSearch} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-stretch">
            <label className="flex min-h-12 items-center gap-2 rounded-xl bg-muted-surface px-3 hairline focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20 sm:px-4">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                type="search"
                aria-label={text("ابحث في رواج", "Search RAWAJ")}
                placeholder={text(
                  "ابحث عن سيارة، جوال، عقار، خدمة...",
                  "Search for a car, phone, property, service...",
                )}
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Link
              to="/listings"
              search={listingSearch({ open_filters: true })}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-card px-4 text-xs font-bold text-foreground hairline transition active:scale-[0.98]"
            >
              <Filter className="h-4 w-4" />
              {text("فلترة", "Filters")}
            </Link>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-xs font-extrabold text-primary-foreground transition active:scale-[0.98]"
            >
              <Search className="h-4 w-4" />
              {text("بحث", "Search")}
            </button>
          </form>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto border-t border-border/70 pt-3">
            {sortChips.map((sort) => (
              <Link
                key={sort.id}
                to="/listings"
                search={listingSearch({ sort: sort.id })}
                className="shrink-0 rounded-full bg-muted-surface px-3 py-2 text-center text-xs font-semibold text-foreground"
              >
                {text(sort.labelAr, sort.labelEn)}
              </Link>
            ))}
          </div>
        </section>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto border-b border-border/70 pb-4">
          {quickSuggestions.map((chip) => (
            <Link
              key={chip.label}
              to="/listings"
              search={chip.search}
              className="shrink-0 rounded-full bg-card-warm px-3.5 py-1.5 text-xs font-bold text-foreground hairline"
            >
              {chip.label}
            </Link>
          ))}
        </div>

        <PromotedPlacement />

        {loading ? (
          <HomeState title={text("جاري تحميل الإعلانات", "Loading listings")} />
        ) : error ? (
          <HomeState
            title={text("تعذر تحميل بيانات السوق", "Could not load marketplace data")}
            body={error.message}
          />
        ) : (
          <>
            <ListingsSection
              title={text("إعلانات بارزة", "Featured listings")}
              subtitle={text(
                "تظهر هنا الإعلانات المميزة المتاحة ضمن البيانات الحالية.",
                "Available featured listings appear here.",
              )}
              listings={featuredListings}
              empty={text(
                "لا توجد إعلانات مميزة حاليًا. يمكنك تصفح أحدث الإعلانات أدناه.",
                "No featured listings right now. Browse the latest listings below.",
              )}
            />

            <ListingsSection
              title={text("أحدث الإعلانات", "Latest listings")}
              subtitle={text("إعلانات معتمدة حديثًا من السوق.", "Recently reviewed marketplace listings.")}
              listings={latestListings}
              empty={text("لا توجد إعلانات معتمدة للعرض.", "No reviewed listings to show.")}
            />

            <section className="mt-8 lg:mt-10">
              <SectionHeader title={text("تصفح سريع حسب القسم", "Quick browse by category")} />
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {compactCategories.map((category) => (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={{ category: category.id }}
                    className="shrink-0 rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground shadow-soft hairline"
                  >
                    {categoryName(category.id, category.nameAr, language)}
                    <span className="ms-2 text-[10px] text-muted-foreground">
                      {categoryCounts[category.id] ?? 0}
                    </span>
                  </Link>
                ))}
                <Link
                  to="/categories"
                  className="shrink-0 rounded-2xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  {text("كل الأقسام", "All categories")}
                </Link>
              </div>
            </section>

            <section className="mt-8 lg:mt-10">
              <SectionHeader title={text("حسب المحافظة", "By governorate")} />
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/listings"
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  {text("كل سوريا", "All Syria")}
                </Link>
                {governorates.map((governorate) => (
                  <Link
                    key={governorate.id}
                    to="/listings"
                    search={{ gov: governorate.id }}
                    className="rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-foreground hairline"
                  >
                    {governorateName(governorate.id, governorate.nameAr, language)}
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="mt-8 rounded-2xl bg-card-warm p-4 hairline lg:mt-10">
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

function PromotedPlacement() {
  const { text } = useUiPreferences();
  return (
    <section className="mt-6 rounded-2xl bg-primary p-4 text-primary-foreground shadow-soft hairline sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <span className="inline-flex rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[10px] font-extrabold text-gold">
            {text("مساحة مميزة", "Featured space")}
          </span>
          <h2 className="mt-2 text-base font-extrabold text-primary-foreground sm:text-lg">
            {text("روّج إعلانك ليظهر في مساحات بارزة", "Promote your listing into visible spaces")}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-6 text-primary-foreground/75 sm:text-sm">
            {text(
              "الإعلانات المميزة تخضع للمراجعة الإدارية قبل الظهور في المساحات المخصصة.",
              "Featured listings are reviewed by admins before appearing in designated spaces.",
            )}
          </p>
        </div>
        <Link
          to="/promotion"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gold px-4 py-2 text-xs font-extrabold text-gold-foreground shadow-soft"
        >
          {text("طلب ترويج", "Request promotion")}
        </Link>
      </div>
    </section>
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
      className="block overflow-hidden rounded-2xl bg-card shadow-soft hairline tap-card"
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
    <div className={`rounded-2xl bg-card text-center hairline ${compact ? "p-5" : "mt-6 p-10"}`}>
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
