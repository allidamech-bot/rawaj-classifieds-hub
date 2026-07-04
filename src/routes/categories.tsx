import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Car,
  ChevronLeft,
  GraduationCap,
  Grid3X3,
  Home,
  Search,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Utensils,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  fetchPublicCategories,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedsError,
  ClassifiedSubcategory,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import { categoryHint, categoryName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import {
  buildTaxonomyIndex,
  findTaxonomyNode,
  flattenTaxonomy,
  getTaxonomyChildren,
  getTaxonomyLevelScope,
  getTaxonomyPath,
  getTaxonomyRootNodes,
  resolveTaxonomyListingSearch,
  taxonomyMatchesSearch,
  taxonomyNodeDescription,
  taxonomyListingUrlSearch,
  taxonomyNodeName,
  taxonomyPathLabel,
} from "@/lib/taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";

const categoriesSearchSchema = z.object({
  node: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/categories")({
  validateSearch: categoriesSearchSchema,
  head: () =>
    createSeo({
      title: "الأقسام | RAWAJ / رواج",
      description: "دليل أقسام رواج لاختيار القسم المناسب قبل تصفح نتائج الإعلانات المعتمدة.",
      path: "/categories",
    }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [taxonomyAvailable, setTaxonomyAvailable] = useState(false);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [query, setQuery] = useState(search.q ?? "");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFetchError(null);

      const [taxonomyResult, categoriesResult, subcategoriesResult] = await Promise.all([
        fetchPublicTaxonomyNodes(),
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

      if (taxonomyResult.ok) {
        setTaxonomyNodes(taxonomyResult.data);
        setTaxonomyAvailable(true);
      } else if (taxonomyResult.error.code === "schema_missing") {
        setTaxonomyNodes([]);
        setTaxonomyAvailable(false);
      } else {
        setFetchError(taxonomyResult.error);
      }

      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const taxonomyIndex = useMemo(() => buildTaxonomyIndex(taxonomyNodes), [taxonomyNodes]);
  const currentNode = findTaxonomyNode(taxonomyIndex, search.node);
  const currentPath = getTaxonomyPath(taxonomyIndex, currentNode);
  const showTaxonomy = taxonomyAvailable;
  const hasInvalidNode = Boolean(search.node && showTaxonomy && !currentNode);

  function updateQuery(value: string) {
    setQuery(value);
    void navigate({
      to: "/categories",
      search: { node: currentNode?.id, q: value.trim() || undefined },
      replace: true,
    });
  }

  return (
    <>
      <PageHeader title={text("الأقسام", "Categories")} />
      <main className="container-wide mobile-page-bottom pt-4">
        <section className="bg-card p-4 hairline sm:p-5">
          <p className="text-[11px] font-extrabold text-gold">
            {text("دليل التصنيف", "Category directory")}
          </p>
          <h1 className="mt-1 text-xl font-extrabold">
            {currentNode
              ? taxonomyNodeName(currentNode, language)
              : text("اختر القسم المناسب", "Choose the right category")}
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm">
            {currentNode
              ? (taxonomyNodeDescription(currentNode, language) ??
                text(
                  "تصفح الفروع داخل هذا المستوى أو انتقل إلى نتائج الإعلانات المرتبطة به.",
                  "Browse child levels or open the linked listing results.",
                ))
              : text(
                  "هذه الصفحة مخصصة لاختيار التصنيف فقط. بعد اختيار القسم تنتقل إلى نتائج الإعلانات لتصفية الموقع والسعر والتفاصيل.",
                  "This page is only for classification. Choose a category, then refine location, price, and details in results.",
                )}
          </p>

          {showTaxonomy && <Breadcrumbs path={currentPath} language={language} text={text} />}

          <label className="mt-4 flex items-center gap-2 rounded-xl bg-muted-surface px-3 py-2.5 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
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
        ) : hasInvalidNode ? (
          <Panel
            title={text("التصنيف غير موجود", "Category not found")}
            body={text(
              "الرابط يشير إلى تصنيف غير متاح. احذف معرف التصنيف أو عد إلى دليل الأقسام.",
              "This link points to a category that is not available. Remove the category id or return to the category directory.",
            )}
          />
        ) : showTaxonomy ? (
          <TaxonomyDirectory
            index={taxonomyIndex}
            currentNode={currentNode}
            query={query}
            language={language}
            text={text}
          />
        ) : (
          <LegacyCategoryDirectory
            categories={categories}
            subcategories={subcategories}
            query={query}
            language={language}
            text={text}
          />
        )}
      </main>
    </>
  );
}

function Breadcrumbs({
  path,
  language,
  text,
}: {
  path: TaxonomyNode[];
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  return (
    <nav className="mt-4 flex flex-wrap items-center gap-1 text-[11px] font-bold text-muted-foreground">
      <Link
        to="/categories"
        className="rounded-full bg-muted-surface px-2.5 py-1 transition hover:text-foreground"
      >
        {text("كل الأقسام", "All categories")}
      </Link>
      {path.map((node) => (
        <span key={node.id} className="inline-flex items-center gap-1">
          <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
          <Link
            to="/categories"
            search={{ node: node.id }}
            className="rounded-full bg-muted-surface px-2.5 py-1 transition hover:text-foreground"
          >
            {taxonomyNodeName(node, language)}
          </Link>
        </span>
      ))}
    </nav>
  );
}

function TaxonomyDirectory({
  index,
  currentNode,
  query,
  language,
  text,
}: {
  index: ReturnType<typeof buildTaxonomyIndex>;
  currentNode?: TaxonomyNode;
  query: string;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  const term = query.trim();
  const currentPath = getTaxonomyPath(index, currentNode);
  const levelScope =
    currentNode && currentPath.length > 0
      ? getTaxonomyLevelScope(index, currentNode, currentPath)
      : null;
  const currentListingSearch =
    currentNode && currentPath.length > 0
      ? resolveTaxonomyListingSearch(currentNode, currentPath)
      : null;
  const canOpenCurrentLevel =
    currentListingSearch !== null &&
    levelScope?.length === 1 &&
    levelScopeMatchesSearch(levelScope[0], currentListingSearch);
  const visibleNodes = currentNode
    ? getTaxonomyChildren(index, currentNode.id)
    : getTaxonomyRootNodes(index);
  const searchMatches = term
    ? flattenTaxonomy(index).filter(({ node, path }) => taxonomyMatchesSearch(node, term, path))
    : [];

  if (term) {
    return searchMatches.length === 0 ? (
      <Panel
        title={text("لا توجد أقسام مطابقة", "No matching categories")}
        body={text("جرّب عبارة بحث أقصر.", "Try a shorter search term.")}
      />
    ) : (
      <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {searchMatches.map(({ node, path }) => (
          <TaxonomyRow
            key={node.id}
            node={node}
            path={path}
            hasChildren={getTaxonomyChildren(index, node.id).length > 0}
            language={language}
            text={text}
            pathLabel={taxonomyPathLabel(path, language)}
          />
        ))}
      </section>
    );
  }

  return (
    <>
      {currentNode && canOpenCurrentLevel && currentListingSearch && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/listings"
            search={taxonomyListingUrlSearch(currentListingSearch)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            {text("كل الإعلانات في هذا المستوى", "All listings in this level")}
          </Link>
        </div>
      )}

      {visibleNodes.length === 0 && currentNode ? (
        <Panel
          title={text("هذا آخر مستوى في التصنيف", "This is the last category level")}
          body={text(
            "انتقل إلى نتائج الإعلانات المرتبطة بهذا التصنيف.",
            "Open the listing results linked to this category.",
          )}
        />
      ) : (
        <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visibleNodes.map((node) => {
            const path = getTaxonomyPath(index, node);
            return (
              <TaxonomyRow
                key={node.id}
                node={node}
                path={path}
                hasChildren={getTaxonomyChildren(index, node.id).length > 0}
                language={language}
                text={text}
              />
            );
          })}
        </section>
      )}
    </>
  );
}

function levelScopeMatchesSearch(
  scope: {
    categoryId: string;
    subcategoryId?: string;
    propertyPurpose?: string;
    propertyType?: string;
  },
  search: ReturnType<typeof resolveTaxonomyListingSearch>,
) {
  return (
    scope.categoryId === search.category &&
    scope.subcategoryId === search.taxonomyLegacySubcategoryId &&
    scope.propertyPurpose === search.property_purpose &&
    scope.propertyType === search.property_type
  );
}

function TaxonomyRow({
  node,
  path,
  hasChildren,
  language,
  text,
  pathLabel,
}: {
  node: TaxonomyNode;
  path: TaxonomyNode[];
  hasChildren: boolean;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
  pathLabel?: string;
}) {
  const Icon = iconForTaxonomy(node.iconKey);
  const isLeaf = !hasChildren;

  return (
    <article className="bg-card p-3 hairline sm:p-4">
      <Link
        to={isLeaf ? "/listings" : "/categories"}
        search={
          isLeaf
            ? taxonomyListingUrlSearch(resolveTaxonomyListingSearch(node, path))
            : { node: node.id }
        }
        className="group flex items-start gap-3 rounded-xl transition hover:bg-muted-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary hairline sm:h-14 sm:w-14">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 py-0.5">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-extrabold sm:text-base">
              {taxonomyNodeName(node, language)}
            </span>
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground rtl:rotate-180" />
          </span>
          {pathLabel && (
            <span className="mt-1 block truncate text-[11px] font-bold text-gold">{pathLabel}</span>
          )}
          <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {taxonomyNodeDescription(node, language) ??
              (isLeaf
                ? text("انتقل إلى نتائج هذا التصنيف.", "Open results for this category.")
                : text("افتح الفروع داخل هذا المستوى.", "Open child levels in this category."))}
          </span>
          <span className="mt-2 inline-flex text-[11px] font-bold text-primary">
            {isLeaf
              ? text("عرض النتائج", "View results")
              : text("استعراض الفروع", "Browse children")}
          </span>
        </span>
      </Link>
    </article>
  );
}

function LegacyCategoryDirectory({
  categories,
  subcategories,
  query,
  language,
  text,
}: {
  categories: ClassifiedCategory[];
  subcategories: ClassifiedSubcategory[];
  query: string;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
}) {
  const childrenByCategory = useMemo(() => {
    const result = new Map<string, ClassifiedSubcategory[]>();
    for (const subcategory of subcategories) {
      result.set(subcategory.categoryId, [
        ...(result.get(subcategory.categoryId) ?? []),
        subcategory,
      ]);
    }
    return result;
  }, [subcategories]);
  const term = query.trim().toLowerCase();
  const filteredCategories = categories.filter((category) => {
    const children = childrenByCategory.get(category.id) ?? [];
    return !term
      ? true
      : [category.nameAr, category.slug, category.hintAr ?? "", ...children.map(subcategoryName)]
          .join(" ")
          .toLowerCase()
          .includes(term);
  });

  if (filteredCategories.length === 0) {
    return (
      <Panel
        title={text("لا توجد أقسام مطابقة", "No matching categories")}
        body={text("جرّب عبارة بحث أقصر.", "Try a shorter search term.")}
      />
    );
  }

  return (
    <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {filteredCategories.map((category) => (
        <article key={category.id} className="bg-card p-3 hairline sm:p-4">
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

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
            {(childrenByCategory.get(category.id) ?? []).slice(0, 8).map((subcategory) => (
              <Link
                key={subcategory.id}
                to="/listings"
                search={{ category: category.id, subcategory: subcategory.id }}
                className="rounded-full bg-muted-surface px-3 py-1.5 text-[11px] font-bold text-foreground hairline transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {subcategoryName(subcategory)}
              </Link>
            ))}
          </div>
        </article>
      ))}
    </section>
  );

  function subcategoryName(subcategory: ClassifiedSubcategory) {
    return language === "en" ? (subcategory.nameEn ?? subcategory.nameAr) : subcategory.nameAr;
  }
}

function iconForTaxonomy(iconKey: string | null) {
  switch (iconKey) {
    case "realestate":
      return Home;
    case "car":
      return Car;
    case "phone":
      return Smartphone;
    case "electronics":
      return Smartphone;
    case "furniture":
      return Home;
    case "job":
      return Briefcase;
    case "service":
      return Wrench;
    case "fashion":
      return Shirt;
    case "food":
      return Utensils;
    case "animals":
      return ShoppingBag;
    case "education":
      return GraduationCap;
    case "business":
      return Building2;
    default:
      return Grid3X3;
  }
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
