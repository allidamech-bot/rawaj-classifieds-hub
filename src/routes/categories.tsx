import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, MapPin, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicListings,
  fetchPublicSubcategories,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedSubcategory,
} from "@/lib/classifieds-types";
import { categoryHint, categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/categories")({
  head: () =>
    createSeo({
      title: "الأقسام | RAWAJ / رواج",
      description: "تصفح أقسام رواج العملية ثم تابع الإعلانات البارزة والأحدث داخل السوق.",
      path: "/categories",
    }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { language, text } = useUiPreferences();
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFetchError(null);
      const [categoriesResult, subcategoriesResult, governoratesResult, listingsResult] =
        await Promise.all([
          fetchPublicCategories(),
          fetchPublicSubcategories(),
          fetchPublicGovernorates(),
          fetchPublicListings(),
        ]);
      if (cancelled) return;
      if (!categoriesResult.ok) {
        setFetchError(categoriesResult.error);
      } else if (!subcategoriesResult.ok) {
        setFetchError(subcategoriesResult.error);
      } else if (!governoratesResult.ok) {
        setFetchError(governoratesResult.error);
      } else {
        setCategories(categoriesResult.data);
        setSubcategories(subcategoriesResult.data);
        setGovernorates(governoratesResult.data);
        setListings(listingsResult.ok ? listingsResult.data : []);
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
    for (const listing of listings) {
      result[listing.categoryId] = (result[listing.categoryId] ?? 0) + 1;
    }
    return result;
  }, [listings]);

  const filteredCategories = categories.filter((category) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [category.nameAr, category.slug, category.hintAr ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
  const featuredListings = listings.filter((listing) => listing.isFeatured).slice(0, 5);
  const latestListings = listings.slice(0, 8);

  return (
    <>
      <PageHeader title={text("الأقسام", "Categories")} />
      <main className="container-wide pt-4 pb-8">
        <section className="rounded-2xl bg-card p-4 shadow-soft hairline">
          <p className="text-[11px] font-extrabold text-gold">
            {text("دليل السوق", "Marketplace directory")}
          </p>
          <h1 className="mt-1 text-xl font-extrabold">
            {text("اختر القسم ثم تابع الإعلانات", "Choose a category, then browse listings")}
          </h1>
          <label className="mt-4 flex items-center gap-2 rounded-xl bg-muted-surface px-3 py-2.5 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text("ابحث داخل الأقسام", "Search categories")}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </section>

        {loading ? (
          <Panel title={text("جاري تحميل الأقسام", "Loading categories")} />
        ) : fetchError ? (
          <Panel
            title={text("تعذر تحميل الأقسام", "Could not load categories")}
            body={fetchError.message}
          />
        ) : (
          <>
            <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((category) => {
                const children = subcategories.filter((item) => item.categoryId === category.id);
                return (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={{ category: category.id }}
                    className="group rounded-2xl bg-card p-4 shadow-soft transition hairline hover:shadow-premium"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                        <PlaceholderArt type={category.placeholder} aspect="square" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="truncate text-base font-extrabold">
                            {categoryName(category.id, category.nameAr, language)}
                          </h2>
                          <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground rtl:rotate-180" />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {categoryHint(category.id, category.hintAr ?? "", language)}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-gold">
                          {text(
                            `${counts[category.id] ?? 0} إعلان`,
                            `${counts[category.id] ?? 0} listings`,
                          )}
                        </p>
                      </div>
                    </div>
                    {children.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {children.slice(0, 5).map((subcategory) => (
                          <span
                            key={subcategory.id}
                            className="rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                          >
                            {subcategory.nameAr}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </section>

            <section className="mt-5 rounded-2xl bg-card p-4 shadow-soft hairline">
              <span className="inline-flex rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-extrabold text-gold hairline">
                {text("روابط مفيدة", "Helpful links")}
              </span>
              <h2 className="mt-2 text-base font-extrabold">
                {text("تابع الإعلانات المميزة أو اطلب ترويج إعلانك", "Browse featured listings or request promotion")}
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "تعرض رواج الإعلانات المميزة المتاحة بعد مراجعة الإدارة، ويمكنك إرسال طلب ترويج لإعلان معتمد تملكه.",
                  "RAWAJ shows available featured listings after admin review, and you can request promotion for an approved listing you own.",
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/offers" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                  {text("الإعلانات المميزة", "Featured listings")}
                </Link>
                <Link to="/promotion" className="rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold text-foreground hairline">
                  {text("طلب ترويج", "Request promotion")}
                </Link>
              </div>
            </section>

            <CategoryListings title={text("إعلانات مميزة", "Featured listings")} listings={featuredListings} />
            <CategoryListings title={text("أحدث الإعلانات", "Latest listings")} listings={latestListings} />

            <section className="mt-7">
              <h2 className="mb-2 text-sm font-extrabold">{text("روابط سريعة", "Quick links")}</h2>
              <div className="flex flex-wrap gap-2">
                {governorates.slice(0, 10).map((governorate) => (
                  <Link
                    key={governorate.id}
                    to="/listings"
                    search={{ gov: governorate.id }}
                    className="rounded-full bg-card px-4 py-1.5 text-xs font-bold text-foreground hairline"
                  >
                    {governorateName(governorate.id, governorate.nameAr, language)}
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function CategoryListings({ title, listings }: { title: string; listings: ClassifiedListing[] }) {
  const { language, text } = useUiPreferences();
  if (listings.length === 0) return null;
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold">{title}</h2>
        <Link to="/listings" className="text-xs font-bold text-primary">
          {text("عرض الكل", "View all")}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            to="/listings/$id"
            params={{ id: listing.id }}
            className="overflow-hidden rounded-2xl bg-card shadow-soft hairline"
          >
            {listing.primaryImageUrl ? (
              <img
                src={listing.primaryImageUrl}
                alt={listing.title}
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
              />
            ) : (
              <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
            )}
            <div className="p-3">
              <h3 className="line-clamp-2 text-sm font-bold">{listing.title}</h3>
              <p className="mt-1 text-base font-extrabold">
                {formatPriceLocalized(listing.price ?? 0, listing.priceType, language)}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {governorateName(listing.governorateId, listing.governorateNameAr, language)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-card p-8 text-center text-sm hairline">
      <Sparkles className="mx-auto mb-2 h-5 w-5 text-gold" />
      <p className="font-bold text-foreground">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </div>
  );
}
