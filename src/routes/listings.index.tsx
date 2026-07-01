import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Clock, MapPin, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicListings,
  searchPublicSellers,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  PublicSellerSearchResult,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";

const searchSchema = z.object({
  category: z.string().optional(),
  gov: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["latest", "cheapest", "expensive", "featured"]).optional(),
});

export const Route = createFileRoute("/listings/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تصفح الإعلانات | رواج" },
      {
        name: "description",
        content: "نتائج البحث والإعلانات المعتمدة على رواج، السوق السوري المجاني.",
      },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const search = Route.useSearch();
  const { language, text } = useUiPreferences();
  const [sort, setSort] = useState<"latest" | "cheapest" | "expensive" | "featured">(
    search.sort ?? "latest",
  );
  const [govId, setGovId] = useState("");
  const [q, setQ] = useState(search.q ?? "");
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [sellerResults, setSellerResults] = useState<PublicSellerSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [sellerSearchError, setSellerSearchError] = useState<ClassifiedsError | null>(null);

  const selectedCategory = useMemo(
    () =>
      search.category
        ? categories.find(
            (category) => category.id === search.category || category.slug === search.category,
          )
        : undefined,
    [categories, search.category],
  );
  const selectedGovernorate = governorates.find((gov) => gov.id === govId);

  useEffect(() => {
    let cancelled = false;

    async function loadReferences() {
      setLoading(true);
      setError(null);

      const [categoriesResult, governoratesResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicGovernorates(),
      ]);

      if (cancelled) return;

      if (!categoriesResult.ok) {
        setError(categoriesResult.error);
        setLoading(false);
        return;
      }

      if (!governoratesResult.ok) {
        setError(governoratesResult.error);
        setLoading(false);
        return;
      }

      setCategories(categoriesResult.data);
      setGovernorates(governoratesResult.data);
      const initialGov = search.gov
        ? governoratesResult.data.find((gov) => gov.id === search.gov || gov.slug === search.gov)
        : undefined;
      setGovId(initialGov?.id ?? "");
    }

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [search.gov]);

  useEffect(() => {
    if (categories.length === 0 && governorates.length === 0) return;

    let cancelled = false;

    async function loadListings() {
      setLoading(true);
      setError(null);

      const [result, sellerResult] = await Promise.all([
        fetchPublicListings({
          categoryId: selectedCategory?.id,
          governorateId: govId || undefined,
          query: q,
          sort,
        }),
        searchPublicSellers(q),
      ]);

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setItems([]);
      } else {
        setItems(result.data);
      }

      if (sellerResult.ok) {
        setSellerResults(sellerResult.data);
        setSellerSearchError(null);
      } else {
        setSellerResults([]);
        setSellerSearchError(sellerResult.error);
      }

      setLoading(false);
    }

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, [categories.length, governorates.length, selectedCategory?.id, govId, q, sort]);

  const title = selectedCategory
    ? categoryName(selectedCategory.id, selectedCategory.nameAr, language)
    : text("كل الإعلانات", "All listings");
  const sortChips = [
    { id: "latest", label: text("الأحدث", "Latest") },
    { id: "cheapest", label: text("الأرخص", "Lowest price") },
    { id: "expensive", label: text("الأعلى سعرا", "Highest price") },
    { id: "featured", label: text("المميز", "Featured") },
  ] as const;

  return (
    <>
      <PageHeader title={title} />
      <main className="container-wide pt-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={text("ابحث ضمن الإعلانات المعتمدة...", "Search approved listings...")}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <MapPin className="h-4 w-4 text-gold" />{" "}
            {selectedGovernorate
              ? governorateName(selectedGovernorate.id, selectedGovernorate.nameAr, language)
              : text("كل سوريا", "All Syria")}
          </button>
        </div>

        {open && (
          <div className="mt-2 rounded-xl bg-card p-2 shadow-premium hairline">
            <div className="flex flex-wrap gap-2">
              <GovernorateChip
                active={!govId}
                label={text("كل سوريا", "All Syria")}
                onClick={() => {
                  setGovId("");
                  setOpen(false);
                }}
              />
              {governorates.map((governorate) => (
                <GovernorateChip
                  key={governorate.id}
                  active={govId === governorate.id}
                  label={governorateName(governorate.id, governorate.nameAr, language)}
                  onClick={() => {
                    setGovId(governorate.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {sortChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSort(chip.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                sort === chip.id
                  ? "bg-gold text-gold-foreground"
                  : "bg-card text-foreground hairline hover:bg-muted-surface"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {loading
              ? text("جاري تحميل الإعلانات...", "Loading listings...")
              : text(`${items.length} إعلان معتمد`, `${items.length} approved listings`)}
          </span>
          {selectedCategory && (
            <Link to="/listings" className="font-semibold text-primary">
              {text("مسح الفلتر", "Clear filter")}
            </Link>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/categories"
            className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground hairline"
          >
            {text("تصفح الأقسام", "Browse categories")}
          </Link>
          {(q || govId || selectedCategory) && (
            <Link
              to="/listings"
              className="rounded-full bg-muted-surface px-3 py-1.5 text-xs font-bold text-muted-foreground"
            >
              {text("إعادة ضبط الفلاتر", "Reset filters")}
            </Link>
          )}
        </div>

        {!loading && (sellerResults.length > 0 || sellerSearchError) && (
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold">{text("المعلنون", "Advertisers")}</h2>
              <span className="text-[11px] text-muted-foreground">
                {text("نتائج عامة آمنة", "Safe public results")}
              </span>
            </div>
            {sellerSearchError ? (
              <p className="rounded-xl bg-muted-surface p-3 text-xs text-muted-foreground">
                {sellerSearchError.message}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sellerResults.map((seller) => (
                  <SellerSearchCard key={seller.id} seller={seller} />
                ))}
              </div>
            )}
          </section>
        )}

        {loading ? (
          <StateCard
            title={text("جاري تحميل الإعلانات", "Loading listings")}
            body={text(
              "نبحث عن الإعلانات المعتمدة المتاحة للتصفح داخل سوريا.",
              "Looking for approved listings available across Syria.",
            )}
          />
        ) : error ? (
          <StateCard
            title={text("تعذر تحميل الإعلانات", "Could not load listings")}
            body={
              error.code === "schema_missing" || error.code === "supabase_unconfigured"
                ? text(
                    "تعذر تحميل البيانات الآن. يمكنك تحديث الصفحة أو المحاولة مرة أخرى.",
                    "Could not load data right now. Refresh the page or try again.",
                  )
                : error.message
            }
            actionLabel={text("العودة للرئيسية", "Back to home")}
            actionTo="/"
          />
        ) : items.length === 0 ? (
          <StateCard
            title={text("لا توجد إعلانات مطابقة الآن", "No matching listings now")}
            body={text(
              "تظهر هنا الإعلانات المعتمدة فقط بعد المراجعة.",
              "Only approved listings appear here after review.",
            )}
            actionLabel={text("أضف إعلانك", "Post your listing")}
            actionTo="/add-listing"
          />
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((listing) => (
              <RealListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function GovernorateChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted-surface text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function RealListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-2xl bg-card hairline shadow-soft transition-shadow hover:shadow-premium"
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
            {text("معتمد", "Approved")}
          </span>
        </div>
        <span className="absolute bottom-2 end-2 rounded-md bg-primary/85 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-lg font-extrabold text-foreground">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language)}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />{" "}
            {governorateName(
              listing.governorateId,
              listing.governorateNameAr ?? undefined,
              language,
            )}
            {listing.districtAr ? ` · ${listing.districtAr}` : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatDate(listing.createdAt, language)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SellerSearchCard({ seller }: { seller: PublicSellerSearchResult }) {
  const { text } = useUiPreferences();
  const title = seller.businessName || seller.displayName;

  return (
    <Link
      to="/seller/$id"
      params={{ id: seller.id }}
      className="flex items-center gap-3 rounded-2xl bg-card p-3 transition hairline hover:bg-muted-surface"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted-surface text-sm font-bold text-primary">
        {seller.avatarUrl ? (
          <img
            src={seller.avatarUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          title.slice(0, 1)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold">{title}</span>
        {seller.businessName && seller.displayName !== seller.businessName && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {seller.displayName}
          </span>
        )}
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
          {[
            seller.governorate,
            text(`${seller.approvedListingCount} إعلان`, `${seller.approvedListingCount} listings`),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}

function StateCard({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="mt-10 rounded-2xl bg-card p-10 text-center hairline">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function formatDate(value: string, language: "ar" | "en") {
  if (!value) return language === "ar" ? "تاريخ غير محدد" : "Date unavailable";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
