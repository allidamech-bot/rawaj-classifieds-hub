import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { fetchPublicCategories, fetchPublicSubcategories } from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedsError,
  ClassifiedSubcategory,
} from "@/lib/classifieds-types";
import { categoryHint, categoryName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/categories")({
  head: () =>
    createSeo({
      title: "الأقسام | RAWAJ / رواج",
      description: "دليل أقسام رواج لاختيار القسم المناسب قبل تصفح نتائج الإعلانات المعتمدة.",
      path: "/categories",
    }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { language, text } = useUiPreferences();
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFetchError(null);
      const [categoriesResult, subcategoriesResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicSubcategories(),
      ]);
      if (cancelled) return;
      if (!categoriesResult.ok) {
        setFetchError(categoriesResult.error);
      } else if (!subcategoriesResult.ok) {
        setFetchError(subcategoriesResult.error);
      } else {
        setCategories(categoriesResult.data);
        setSubcategories(subcategoriesResult.data);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const childrenByCategory = useMemo(() => {
    const result = new Map<string, ClassifiedSubcategory[]>();
    for (const subcategory of subcategories) {
      const current = result.get(subcategory.categoryId) ?? [];
      current.push(subcategory);
      result.set(subcategory.categoryId, current);
    }
    return result;
  }, [subcategories]);

  const filteredCategories = categories.filter((category) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    const children = childrenByCategory.get(category.id) ?? [];
    return [
      category.nameAr,
      category.slug,
      category.hintAr ?? "",
      ...children.flatMap((child) => [child.nameAr, child.nameEn ?? ""]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  return (
    <>
      <PageHeader title={text("الأقسام", "Categories")} />
      <main className="container-wide mobile-page-bottom pt-4">
        <section className="bg-card p-4 hairline sm:p-5">
          <p className="text-[11px] font-extrabold text-gold">
            {text("دليل التصنيف", "Category directory")}
          </p>
          <h1 className="mt-1 text-xl font-extrabold">
            {text("اختر القسم المناسب", "Choose the right category")}
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">
            {text(
              "هذه الصفحة مخصصة لاختيار التصنيف فقط. بعد اختيار القسم أو الفرع تنتقل إلى نتائج الإعلانات لتصفية الموقع والسعر والتفاصيل.",
              "This page is only for classification. Choose a category or child category, then refine location, price, and details in results.",
            )}
          </p>
          <label className="mt-4 flex items-center gap-2 rounded-xl bg-muted-surface px-3 py-2.5 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text("ابحث داخل الأقسام", "Search categories")}
              className="w-full bg-transparent text-sm outline-none"
              type="search"
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
        ) : filteredCategories.length === 0 ? (
          <Panel
            title={text("لا توجد أقسام مطابقة", "No matching categories")}
            body={text("جرّب عبارة بحث أقصر.", "Try a shorter search term.")}
          />
        ) : (
          <CategoryDirectory
            categories={filteredCategories}
            childrenByCategory={childrenByCategory}
            query={query}
            language={language}
            text={text}
          />
        )}
      </main>
    </>
  );
}

function CategoryDirectory({
  categories,
  childrenByCategory,
  query,
  language,
  text,
}: {
  categories: ClassifiedCategory[];
  childrenByCategory: Map<string, ClassifiedSubcategory[]>;
  query: string;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  return (
    <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {categories.map((category) => (
        <CategoryRow
          key={category.id}
          category={category}
          children={childrenByCategory.get(category.id) ?? []}
          query={query}
          language={language}
          text={text}
        />
      ))}
    </section>
  );
}

function CategoryRow({
  category,
  children,
  query,
  language,
  text,
}: {
  category: ClassifiedCategory;
  children: ClassifiedSubcategory[];
  query: string;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingChildren =
    normalizedQuery.length > 0
      ? children.filter((subcategory) =>
          [subcategory.nameAr, subcategory.nameEn ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : [];
  const orderedChildren =
    matchingChildren.length > 0
      ? [
          ...matchingChildren,
          ...children.filter(
            (subcategory) => !matchingChildren.some((match) => match.id === subcategory.id),
          ),
        ]
      : children;
  const autoExpanded = normalizedQuery.length > 0 && matchingChildren.length > 0;
  const visibleChildren = expanded || autoExpanded ? orderedChildren : orderedChildren.slice(0, 5);
  const remainingChildren = Math.max(0, orderedChildren.length - visibleChildren.length);

  return (
    <article className="bg-card p-3 hairline sm:p-4">
      <Link
        to="/listings"
        search={{ category: category.id }}
        className="group flex items-start gap-3 rounded-xl transition hover:bg-muted-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:w-14">
          <PlaceholderArt type={category.placeholder} aspect="square" />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-sm font-extrabold sm:text-base">
              {categoryName(category.id, category.nameAr, language)}
            </h2>
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground rtl:rotate-180" />
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {categoryHint(category.id, category.hintAr ?? "", language)}
          </p>
          <span className="mt-2 inline-flex text-[11px] font-bold text-primary">
            {text("عرض كل إعلانات القسم", "View all listings in category")}
          </span>
        </div>
      </Link>

      {visibleChildren.length > 0 && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <p className="mb-2 text-[11px] font-bold text-muted-foreground">
            {text("فروع داخل القسم", "Child categories")}
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleChildren.map((subcategory) => (
              <Link
                key={subcategory.id}
                to="/listings"
                search={{ category: category.id, subcategory: subcategory.id }}
                className="rounded-full bg-muted-surface px-3 py-1.5 text-[11px] font-bold text-foreground hairline transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {subcategoryName(subcategory, language)}
              </Link>
            ))}
            {remainingChildren > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="rounded-full bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hairline transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {text(`عرض ${remainingChildren} فروع أخرى`, `Show ${remainingChildren} more`)}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function subcategoryName(subcategory: ClassifiedSubcategory, language: "ar" | "en") {
  return language === "en" ? (subcategory.nameEn ?? subcategory.nameAr) : subcategory.nameAr;
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mt-4 bg-card p-8 text-center text-sm hairline">
      <Sparkles className="mx-auto mb-2 h-5 w-5 text-gold" />
      <p className="font-bold text-foreground">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </div>
  );
}
