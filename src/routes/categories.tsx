import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  fetchPublicCategories,
  fetchPublicListings,
  fetchPublicSubcategories,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedSubcategory,
} from "@/lib/classifieds-types";
import { categoryHint, categoryName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/categories")({
  head: () =>
    createSeo({
      title: "أقسام الإعلانات | RAWAJ / رواج",
      description:
        "تصفح أقسام رواج للإعلانات المبوبة في سوريا، من العقارات والسيارات إلى الإلكترونيات والخدمات والوظائف.",
      path: "/categories",
    }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { language, text } = useUiPreferences();
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFetchError(null);
      const [categoriesResult, subcategoriesResult, listingsResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicSubcategories(),
        fetchPublicListings(),
      ]);
      if (cancelled) return;
      if (!categoriesResult.ok) {
        setFetchError(categoriesResult.error);
        setCategories([]);
      } else if (!subcategoriesResult.ok) {
        setFetchError(subcategoriesResult.error);
        setCategories([]);
      } else {
        setCategories(categoriesResult.data);
        setSubcategories(subcategoriesResult.data);
        setListings(listingsResult.ok ? listingsResult.data : []);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts: Record<string, number> = {};
  for (const listing of listings)
    counts[listing.categoryId] = (counts[listing.categoryId] ?? 0) + 1;

  if (loading) {
    return (
      <>
        <PageHeader title={text("جميع الأقسام", "All categories")} />
        <main className="container-wide pt-4 pb-8">
          <Panel title={text("جاري تحميل الأقسام", "Loading categories")} />
        </main>
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <PageHeader title={text("جميع الأقسام", "All categories")} />
        <main className="container-wide pt-4 pb-8">
          <Panel
            title={text("تعذر تحميل الأقسام", "Could not load categories")}
            body={fetchError.message}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("جميع الأقسام", "All categories")} />
      <main className="container-wide pt-4 pb-8">
        <section className="mb-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
          <h2 className="text-lg font-extrabold">{text("أطلس الأقسام", "Category atlas")}</h2>
          <p className="mt-1 text-xs text-primary-foreground/80">
            {text(
              "اختر القسم المناسب لتصفح الإعلانات المنظمة داخل سوريا.",
              "Choose a category to browse organized listings in Syria.",
            )}
          </p>
        </section>

        {categories.length === 0 ? (
          <Panel
            title={text("لا توجد أقسام للعرض", "No categories to show")}
            body={text(
              "يمكنك تصفح الإعلانات المعتمدة مباشرة.",
              "You can browse approved listings directly.",
            )}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.map((category) => {
              const children = subcategories.filter((item) => item.categoryId === category.id);
              return (
                <Link
                  key={category.id}
                  to="/listings"
                  search={{ category: category.id }}
                  className="group rounded-2xl bg-card p-4 shadow-soft transition-shadow hairline hover:shadow-premium"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <PlaceholderArt type={category.placeholder} aspect="square" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-extrabold">
                          {categoryName(category.id, category.nameAr, language)}
                        </h3>
                        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground rtl:rotate-180" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {categoryHint(category.id, category.hintAr ?? "", language)}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-gold">
                          {text(
                            `${counts[category.id] ?? 0} إعلان`,
                            `${counts[category.id] ?? 0} listings`,
                          )}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {text(`${children.length} قسم فرعي`, `${children.length} subcategories`)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {children.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {children.slice(0, 6).map((subcategory) => (
                        <span
                          key={subcategory.id}
                          className="rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                        >
                          {subcategory.nameAr}
                        </span>
                      ))}
                      {children.length > 6 && (
                        <span className="rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          +{children.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        <section className="mt-5 grid grid-cols-1 gap-2 rounded-2xl bg-card p-4 hairline sm:grid-cols-2">
          <Link
            to="/listings"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-bold text-primary-foreground"
          >
            {text("تصفح كل الإعلانات", "Browse all listings")}
          </Link>
          <Link
            to="/add-listing"
            className="rounded-xl bg-muted-surface px-4 py-2.5 text-center text-sm font-bold text-foreground"
          >
            {text("أضف إعلاناً في قسمك", "Post in your category")}
          </Link>
        </section>
      </main>
    </>
  );
}

function Panel({
  title,
  body,
  actionLabel,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center text-sm hairline">
      <p className="font-bold text-foreground">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
      {actionLabel && (
        <Link
          to="/listings"
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
