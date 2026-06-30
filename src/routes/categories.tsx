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
import type { PlaceholderType, Subcategory } from "@/types";
import { categories as mockCategories } from "@/data/mockData";
import { categoryHint, categoryName } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";

interface DisplayCategory {
  id: string;
  nameAr: string;
  hintAr: string;
  placeholder: PlaceholderType;
  subcategories: Subcategory[];
}

function toDisplayCategory(
  c: ClassifiedCategory,
  subcategories: ClassifiedSubcategory[],
): DisplayCategory {
  return {
    id: c.id,
    nameAr: c.nameAr,
    hintAr: c.hintAr ?? "",
    placeholder: c.placeholder,
    subcategories: subcategories
      .filter((subcategory) => subcategory.categoryId === c.id)
      .map((subcategory) => ({ id: subcategory.id, nameAr: subcategory.nameAr })),
  };
}

function toDisplayCategoryFromMock(c: (typeof mockCategories)[number]): DisplayCategory {
  return {
    id: c.id,
    nameAr: c.nameAr,
    hintAr: c.hintAr,
    placeholder: c.placeholder,
    subcategories: c.subcategories,
  };
}

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "الأقسام | رَوَاج" },
      { name: "description", content: "تصفح جميع أقسام السوق السوري على رَوَاج." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { language, text } = useUiPreferences();
  const [realCategories, setRealCategories] = useState<ClassifiedCategory[] | null>(null);
  const [realSubcategories, setRealSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [realListings, setRealListings] = useState<ClassifiedListing[]>([]);
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
      } else if (!subcategoriesResult.ok) {
        setFetchError(subcategoriesResult.error);
      } else {
        setRealCategories(categoriesResult.data);
        setRealSubcategories(subcategoriesResult.data);
        setRealListings(listingsResult.ok ? listingsResult.data : []);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories: DisplayCategory[] = realCategories
    ? realCategories.map((category) => toDisplayCategory(category, realSubcategories))
    : mockCategories.map(toDisplayCategoryFromMock);
  const useFallback = !loading && realCategories === null && !fetchError;
  const counts: Record<string, number> = {};
  for (const l of realListings) counts[l.categoryId] = (counts[l.categoryId] ?? 0) + 1;

  if (loading) {
    return (
      <>
        <PageHeader title={text("جميع الأقسام", "All categories")} />
        <main className="container-wide pt-4 pb-8">
          <div className="rounded-2xl bg-card p-10 text-center hairline">
            <p className="text-sm font-semibold">
              {text("جارٍ تحميل الأقسام...", "Loading categories...")}
            </p>
          </div>
        </main>
      </>
    );
  }

  if (fetchError && realCategories === null) {
    return (
      <>
        <PageHeader title={text("جميع الأقسام", "All categories")} />
        <main className="container-wide pt-4 pb-8">
          <div className="rounded-2xl bg-card p-10 text-center hairline">
            <p className="text-sm font-semibold">
              {text("تعذر تحميل الأقسام", "Could not load categories")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{fetchError.message}</p>
            <Link
              to="/listings"
              className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("تصفّح الإعلانات", "Browse listings")}
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("جميع الأقسام", "All categories")} />
      <main className="container-wide pt-4 pb-8">
        {useFallback ? (
          <div className="mb-4 rounded-2xl bg-warning/10 p-3 text-xs text-foreground/90 hairline">
            {text(
              "الأقسام والأعداد حالياً نموذج تجريبي للاطلاع على التصميم. ستظهر الأقسام الحقيقية بعد اكتمال ربط البيانات التشغيلية.",
              "Categories and counts are currently demo previews for the design. Real categories will appear after the operational data connection is complete.",
            )}
          </div>
        ) : (
          <section className="mb-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
            <h2 className="text-lg font-extrabold">{text("أطلس الأقسام", "Category atlas")}</h2>
            <p className="mt-1 text-xs text-primary-foreground/80">
              {text(
                "اختر القسم المناسب لتصفح الإعلانات المنظّمة داخل سوريا. كل قسم يحوي أقساماً فرعية تساعدك في الوصول بسرعة.",
                "Choose a category to browse organized listings in Syria. Subcategories help you get there faster.",
              )}
            </p>
          </section>
        )}

        {categories.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center hairline text-sm text-muted-foreground">
            {text(
              "لا توجد أقسام متاحة حالياً. يمكنك تصفح الإعلانات مباشرة.",
              "No categories are available right now. You can browse listings directly.",
            )}
            <div className="mt-3">
              <Link
                to="/listings"
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                {text("تصفّح الإعلانات", "Browse listings")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categories.map((c) => {
              const count = counts[c.id] ?? 0;
              return (
                <Link
                  key={c.id}
                  to="/listings"
                  search={{ category: c.id }}
                  className="group rounded-2xl bg-card p-4 hairline shadow-soft transition-shadow hover:shadow-premium"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <PlaceholderArt type={c.placeholder} aspect="square" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-extrabold">
                          {categoryName(c.id, c.nameAr, language)}
                        </h3>
                        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180 transition group-hover:text-foreground" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {categoryHint(c.id, c.hintAr, language)}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-gold">
                          {text(`${count} إعلان`, `${count} listings`)}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {text(
                            `${c.subcategories.length} قسم فرعي`,
                            `${c.subcategories.length} subcategories`,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  {c.subcategories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.subcategories.slice(0, 6).map((s) => (
                        <span
                          key={s.id}
                          className="rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                        >
                          {language === "ar" ? s.nameAr : s.nameAr}
                        </span>
                      ))}
                      {c.subcategories.length > 6 && (
                        <span className="rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          +{c.subcategories.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {categories.length > 0 && (
          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            {text(
              "هل قسمك غير موجود؟ سيتم إضافة المزيد من الأقسام لاحقاً حسب احتياجات المستخدمين.",
              "Missing a category? More categories will be added later based on user needs.",
            )}
          </p>
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
