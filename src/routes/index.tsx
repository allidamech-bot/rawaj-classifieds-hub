import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Clock, MapPin, Plus, Search, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";
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
import { categoryHint, categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

const HOME_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const HOME_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة آمنة ومنظمة.";

type QuickFilter = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
  search: { sort?: "latest" | "featured" };
};

export const Route = createFileRoute("/")({
  head: () => createSeo({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
  component: HomePage,
});

const quickFilters: QuickFilter[] = [
  { id: "latest", labelAr: "الأحدث", labelEn: "Latest", icon: Clock, search: { sort: "latest" } },
  {
    id: "featured",
    labelAr: "المميز",
    labelEn: "Featured",
    icon: Sparkles,
    search: { sort: "featured" },
  },
];

const searchSuggestions = ["سيارات", "عقارات", "موبايلات"];

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

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const listing of listings)
      result[listing.categoryId] = (result[listing.categoryId] ?? 0) + 1;
    return result;
  }, [listings]);
  const featuredListings = listings.filter((listing) => listing.isFeatured).slice(0, 8);
  const latestListings = listings.slice(0, 9);
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = searchValue.trim();
    void navigate({ to: "/listings", search: q ? { q } : {} });
  };

  return (
    <>
      <AppHeader />
      <main className="container-wide pt-4">
        <section className="mb-4 overflow-hidden rounded-2xl bg-card p-4 shadow-premium hairline sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-muted-surface px-3 py-1 text-[11px] font-bold text-primary hairline">
                {text("سوق محلي منظم", "Organized local marketplace")}
              </span>
              <h1 className="mt-3 text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
                {text(
                  "رواج - سوق سوريا المجاني للإعلانات",
                  "RAWAJ - Syria's classifieds marketplace",
                )}
              </h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {text(
                  "بيع واشتر داخل سوريا بسهولة: إعلانات محلية حسب المحافظة، واجهة واضحة، ومراجعة قبل الظهور.",
                  "Buy and sell across Syria with clear local listings by governorate, a simple interface, and review before display.",
                )}
              </p>
            </div>
            <Link
              to="/add-listing"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-gold-foreground transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> {text("أضف إعلان", "Post a listing")}
            </Link>
          </div>
        </section>

        <form onSubmit={handleSearch} className="rounded-2xl bg-card p-2 shadow-premium hairline">
          <div className="flex items-center gap-2 rounded-xl bg-muted-surface px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              type="search"
              aria-label={text("ابحث في رواج", "Search RAWAJ")}
              placeholder={text(
                "ابحث عن سيارة، منزل، هاتف، وظيفة...",
                "Search for a car, home, phone, job...",
              )}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </form>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {quickFilters.map((filter) => (
            <Link
              key={filter.id}
              to="/listings"
              search={filter.search}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold transition hairline hover:bg-muted-surface"
            >
              <filter.icon className="h-3.5 w-3.5 text-gold" />
              {text(filter.labelAr, filter.labelEn)}
            </Link>
          ))}
          {searchSuggestions.map((suggestion) => (
            <Link
              key={suggestion}
              to="/listings"
              search={{ q: suggestion }}
              className="inline-flex shrink-0 items-center rounded-full bg-muted-surface px-3.5 py-1.5 text-xs font-semibold transition hairline hover:bg-card"
            >
              {suggestion}
            </Link>
          ))}
        </div>

        {loading ? (
          <HomeState title={text("جاري تحميل الإعلانات", "Loading listings")} />
        ) : error ? (
          <HomeState
            title={text("تعذر تحميل بيانات السوق", "Could not load marketplace data")}
            body={error.message}
          />
        ) : (
          <>
            <section className="mt-6">
              <SectionHeader title={text("تصفح الأقسام", "Browse categories")} />
              {categories.length === 0 ? (
                <HomeState
                  title={text("لا توجد أقسام للعرض", "No categories to show")}
                  body={text(
                    "يمكنك تصفح الإعلانات المعتمدة مباشرة.",
                    "You can browse approved listings directly.",
                  )}
                  compact
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categories.slice(0, 8).map((category) => (
                    <HomeCategoryCard
                      key={category.id}
                      category={category}
                      count={counts[category.id] ?? 0}
                    />
                  ))}
                  <Link
                    to="/categories"
                    className="flex items-center justify-center gap-2 rounded-2xl bg-muted-surface p-4 text-sm font-bold text-primary transition hairline hover:bg-card"
                  >
                    {text("عرض كل الأقسام", "View all categories")}
                  </Link>
                </div>
              )}
            </section>

            <PromotedPlacement />

            <section className="mt-6 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold">
                    {text("انشر إعلانك مجاناً", "Post your listing free")}
                  </h3>
                  <p className="mt-1 text-sm text-primary-foreground/80">
                    {text(
                      "إعلانك يظهر للمشترين داخل سوريا بعد المراجعة.",
                      "Your listing appears to buyers across Syria after review.",
                    )}
                  </p>
                  <Link
                    to="/add-listing"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground transition hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" /> {text("أضف إعلان", "Post a listing")}
                  </Link>
                </div>
                <span className="hidden h-20 w-20 place-items-center rounded-2xl bg-primary-foreground/10 sm:grid">
                  <Sparkles className="h-8 w-8 text-gold" />
                </span>
              </div>
            </section>

            <ListingsSection
              title={text("إعلانات مميزة", "Featured listings")}
              listings={featuredListings}
              empty={text("لا توجد إعلانات مميزة للعرض.", "No featured listings to show.")}
            />
            <ListingsSection
              title={text("أحدث الإعلانات", "Latest listings")}
              listings={latestListings}
              empty={text("لا توجد إعلانات معتمدة للعرض.", "No approved listings to show.")}
            />

            <section className="mt-7">
              <SectionHeader title={text("تصفح حسب المحافظة", "Browse by governorate")} />
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
                    className="rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-foreground transition hairline hover:bg-muted-surface"
                  >
                    {governorateName(governorate.id, governorate.nameAr, language)}
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <section className="mt-7 rounded-2xl bg-card p-4 hairline">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
            <h3 className="text-sm font-extrabold">{text("تعامل بأمان", "Trade safely")}</h3>
          </div>
          <ul className="mt-2 grid gap-1.5 text-xs leading-6 text-muted-foreground sm:grid-cols-3">
            <li>{text("كل إعلان يظهر بعد المراجعة.", "Every listing appears after review.")}</li>
            <li>
              {text(
                "لا تحوّل المال قبل معاينة السلعة.",
                "Do not transfer money before inspecting the item.",
              )}
            </li>
            <li>{text("قابل البائع في مكان عام وآمن.", "Meet in a public, safe place.")}</li>
          </ul>
        </section>
      </main>
    </>
  );
}

function HomeCategoryCard({ category, count }: { category: ClassifiedCategory; count: number }) {
  const { language, text } = useUiPreferences();
  return (
    <Link
      to="/listings"
      search={{ category: category.id }}
      className="group flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft transition hairline hover:shadow-premium"
    >
      <div className="w-16 shrink-0">
        <PlaceholderArt type={category.placeholder} aspect="square" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-foreground">
          {categoryName(category.id, category.nameAr, language)}
        </h3>
        <p className="truncate text-xs text-muted-foreground">
          {categoryHint(category.id, category.hintAr ?? "", language)}
        </p>
        <p className="mt-0.5 text-[11px] text-gold">
          {text(`${count} إعلان`, `${count} listings`)}
        </p>
      </div>
    </Link>
  );
}

function PromotedPlacement() {
  const { text } = useUiPreferences();
  return (
    <section className="mt-6 rounded-2xl bg-card p-4 shadow-soft hairline sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-extrabold text-gold hairline">
            {text("مساحة ترويجية", "Promoted placement")}
          </span>
          <h2 className="mt-2 text-base font-extrabold text-foreground">
            {text("مساحة ظهور هادئة داخل رواج", "A calm visibility slot on RAWAJ")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-muted-foreground">
            {text(
              "مساحة مخصصة لظهور الإعلانات المروّجة بعد مراجعة الإدارة، دون أي ادعاء بالتوثيق أو الدفع الآلي.",
              "A placement for admin-reviewed promoted listings, without implying verification or automatic payment.",
            )}
          </p>
        </div>
        <Link
          to="/promotion"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold text-foreground transition hairline hover:bg-card"
        >
          {text("اطلب ترويج إعلان", "Request promotion")}
        </Link>
      </div>
    </section>
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
    <section className="mt-7">
      <SectionHeader
        title={title}
        action={{ label: text("عرض الكل", "View all"), to: "/listings" }}
      />
      {listings.length === 0 ? (
        <HomeState title={empty} compact />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      className="block overflow-hidden rounded-2xl bg-card shadow-soft transition hairline hover:shadow-premium"
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
          <span className="rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
            {text("إعلان مُراجع", "Reviewed listing")}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-xl font-extrabold text-foreground">
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
          {categoryName(listing.categoryId, listing.categoryNameAr, language)}
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
