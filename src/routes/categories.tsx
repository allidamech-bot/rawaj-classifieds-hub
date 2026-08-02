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
import { CategoriesListingDiscovery } from "@/features/categories/CategoriesListingDiscovery";
import { loadPublicCategoriesPageData } from "@/features/categories/public-categories-page-data";
import {
  fetchPublicCategories,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedsError,
  ClassifiedSubcategory,
  ListingFilters,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import { categoryHint, categoryName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import {
  buildTaxonomyIndex,
  findTaxonomyNode,
  getTaxonomyChildren,
  getTaxonomyPath,
  getTaxonomyRootNodes,
  resolveTaxonomyFilterScope,
  resolveTaxonomyListingSearch,
  searchTaxonomyNodes,
  taxonomyListingUrlSearch,
  taxonomyNodeDescription,
  taxonomyNodeName,
  taxonomyPathLabel,
} from "@/lib/taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";

const cleanDirectorySearchValue = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(160).optional(),
);
const categoriesSearchSchema = z.object({
  node: cleanDirectorySearchValue,
  q: cleanDirectorySearchValue,
});

export const Route = createFileRoute("/categories")({
  validateSearch: categoriesSearchSchema,
  loader: loadPublicCategoriesPageData,
  head: () =>
    createSeo({
      title: "الأقسام | RAWAJ / رواج",
      description: "دليل أقسام رواج لاختيار القسم المناسب قبل تصفح نتائج الإعلانات المعتمدة.",
      path: "/categories",
    }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const initialData = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>(initialData.taxonomyNodes);
  const [taxonomyAvailable, setTaxonomyAvailable] = useState(initialData.taxonomyAvailable);
  const [categories, setCategories] = useState<ClassifiedCategory[]>(initialData.categories);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>(
    initialData.subcategories,
  );
  const [query, setQuery] = useState(search.q ?? "");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<ClassifiedsError | null>(initialData.error);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    if (loadAttempt === 0) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const [taxonomyResult, categoriesResult, subcategoriesResult] = await Promise.all([
          fetchPublicTaxonomyNodes(),
          fetchPublicCategories(),
          fetchPublicSubcategories(),
        ]);
        if (cancelled) return;

        if (categoriesResult.ok) setCategories(categoriesResult.data);
        if (subcategoriesResult.ok) setSubcategories(subcategoriesResult.data);

        if (taxonomyResult.ok && taxonomyResult.data.length > 0) {
          setTaxonomyNodes(taxonomyResult.data);
          setTaxonomyAvailable(true);
        } else if (taxonomyResult.ok || taxonomyResult.error.code === "schema_missing") {
          setTaxonomyNodes([]);
          setTaxonomyAvailable(false);
          if (!categoriesResult.ok) setFetchError(categoriesResult.error);
          else if (!subcategoriesResult.ok) setFetchError(subcategoriesResult.error);
        } else {
          setFetchError(taxonomyResult.error);
        }
      } catch (caught) {
        if (cancelled) return;
        setFetchError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل الأقسام.", "Could not load categories."),
          operation: "categories_retry_load",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, text]);

  const taxonomyIndex = useMemo(() => buildTaxonomyIndex(taxonomyNodes), [taxonomyNodes]);
  const currentNode = findTaxonomyNode(taxonomyIndex, search.node);
  const currentPath = getTaxonomyPath(taxonomyIndex, currentNode);
  const showTaxonomy = taxonomyAvailable;
  const hasInvalidNode = Boolean(search.node && showTaxonomy && !currentNode);
  const discoveryFilters = useMemo<ListingFilters>(() => {
    if (!currentNode) return {};
    const scope = resolveTaxonomyFilterScope(taxonomyIndex, currentNode);
    return {
      taxonomyNodeIds: scope.taxonomyNodeIds,
      taxonomyLegacyScopes: scope.legacyScopes,
    };
  }, [currentNode, taxonomyIndex]);
  const discoveryContextLabel = currentNode ? taxonomyNodeName(currentNode, language) : undefined;

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
      <PageHeader title={text("الأقسام", "Categories")} titleIsPageHeading={false} />
      <main className="rawaj-categories-v2 container-wide rawaj-content-stack mobile-page-bottom pb-8 pt-3 sm:pt-5">
        <section className="rawaj-categories-v2__hero rounded-[1.55rem] sm:rounded-[1.9rem]">
          <div className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[1rem] bg-primary text-primary-foreground shadow-[0_9px_22px_rgba(16,43,70,0.16)]">
                <Grid3X3 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="rawaj-eyebrow">{text("دليل رواج", "RAWAJ directory")}</p>
                <h1 className="mt-1.5 text-xl font-bold leading-[1.4] text-primary sm:text-2xl">
                  {currentNode
                    ? taxonomyNodeName(currentNode, language)
                    : text("اختر القسم المناسب", "Choose the right category")}
                </h1>
                <p className="mt-2.5 max-w-2xl text-xs leading-6 text-muted-foreground sm:text-sm sm:leading-7">
                  {currentNode
                    ? (taxonomyNodeDescription(currentNode, language) ??
                      text(
                        "تصفح الفروع داخل هذا المستوى أو انتقل إلى نتائج الإعلانات المرتبطة به.",
                        "Browse child levels or open the linked listing results.",
                      ))
                    : text(
                        "انتقل إلى القسم الأقرب لما تبحث عنه، ثم أكمل التصفية داخل نتائج الإعلانات.",
                        "Choose the closest category, then continue refining inside listing results.",
                      )}
                </p>
              </div>
            </div>

            {showTaxonomy && <Breadcrumbs path={currentPath} language={language} text={text} />}
          </div>

          <div className="rawaj-categories-v2__hero-search p-3 sm:p-4">
            <label className="flex items-center gap-2.5 rounded-[1.05rem] border border-border/80 bg-card/82 px-3.5 py-3 shadow-[0_7px_22px_rgba(16,43,70,0.045)] transition focus-within:border-brand-orange/60 focus-within:ring-[3px] focus-within:ring-brand-orange/12">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                aria-label={text("ابحث داخل الأقسام", "Search categories")}
                placeholder={text("ابحث داخل الأقسام", "Search categories")}
                className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                type="search"
              />
            </label>
          </div>
        </section>

        {loading ? (
          <Panel title={text("جاري تحميل الأقسام", "Loading categories")} />
        ) : fetchError ? (
          <Panel
            title={text("تعذر تحميل الأقسام", "Could not load categories")}
            body={fetchError.message}
            actionLabel={text("إعادة المحاولة", "Try again")}
            onAction={() => setLoadAttempt((attempt) => attempt + 1)}
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

        {!hasInvalidNode ? (
          <CategoriesListingDiscovery
            filters={discoveryFilters}
            contextLabel={discoveryContextLabel}
            text={text}
          />
        ) : null}
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
    <nav className="no-scrollbar mt-4 flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-bold text-muted-foreground sm:flex-wrap sm:text-[11px]">
      <Link
        to="/categories"
        className="rawaj-chip shrink-0 px-2.5 py-1.5 transition hover:border-gold/40 hover:text-primary"
      >
        {text("كل الأقسام", "All categories")}
      </Link>
      {path.map((node) => (
        <span key={node.id} className="inline-flex shrink-0 items-center gap-1">
          <ChevronLeft className="h-3 w-3 rtl:rotate-180" />
          <Link
            to="/categories"
            search={{ node: node.id }}
            className="rounded-full bg-muted-surface px-2.5 py-1.5 transition hover:text-foreground"
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
  const currentListingSearch =
    currentNode && currentPath.length > 0
      ? resolveTaxonomyListingSearch(currentNode, currentPath)
      : null;
  const canOpenCurrentLevel = currentListingSearch !== null;
  const visibleNodes = currentNode
    ? getTaxonomyChildren(index, currentNode.id)
    : getTaxonomyRootNodes(index);
  const searchMatches = term ? searchTaxonomyNodes(index, term, currentNode) : [];

  if (term) {
    return searchMatches.length === 0 ? (
      <Panel
        title={text("لا توجد أقسام مطابقة", "No matching categories")}
        body={text("جرّب عبارة بحث أقصر.", "Try a shorter search term.")}
      />
    ) : (
      <DirectoryGrid>
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
      </DirectoryGrid>
    );
  }

  return (
    <>
      {currentNode && canOpenCurrentLevel && currentListingSearch && (
        <div className="rawaj-surface mt-4 rounded-[1.25rem] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-extrabold text-foreground">
              {text("تريد رؤية الإعلانات مباشرة؟", "Want to see listings now?")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {text(
                "افتح كل النتائج المرتبطة بهذا المستوى.",
                "Open all results linked to this level.",
              )}
            </p>
          </div>
          <Link
            to="/listings"
            search={taxonomyListingUrlSearch(currentListingSearch)}
            className="rawaj-button-primary mt-3 w-full px-4 py-2.5 sm:mt-0 sm:w-auto"
          >
            {text("عرض الإعلانات", "View listings")}
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
        <DirectoryGrid>
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
        </DirectoryGrid>
      )}
    </>
  );
}

function DirectoryGrid({ children }: { children: React.ReactNode }) {
  return <section className="rawaj-category-directory-grid mt-5">{children}</section>;
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
    <article className="rawaj-category-directory-card tap-card">
      <Link
        to={isLeaf ? "/listings" : "/categories"}
        search={
          isLeaf
            ? taxonomyListingUrlSearch(resolveTaxonomyListingSearch(node, path))
            : { node: node.id }
        }
        className="group flex h-full items-center gap-3 p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:items-start sm:p-4"
      >
        <span className="category-tile h-11 w-11 shrink-0 sm:h-12 sm:w-12">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground sm:text-[15px]">
              {taxonomyNodeName(node, language)}
            </span>
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground rtl:rotate-180" />
          </span>
          {pathLabel && (
            <span className="mt-1 block truncate text-[10px] font-bold text-gold">{pathLabel}</span>
          )}
          <span className="mt-1 hidden line-clamp-2 text-[11px] leading-5 text-muted-foreground sm:block">
            {taxonomyNodeDescription(node, language) ??
              (isLeaf
                ? text("انتقل إلى نتائج هذا التصنيف.", "Open results for this category.")
                : text("افتح الفروع داخل هذا المستوى.", "Open child levels in this category."))}
          </span>
          <span className="mt-1.5 inline-flex text-[10px] font-semibold text-brand-orange sm:mt-2 sm:text-[11px]">
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
        <article
          key={category.id}
          className="rawaj-surface tap-card overflow-hidden rounded-[1.25rem]"
        >
          <Link
            to="/listings"
            search={{ category: category.id }}
            className="group flex items-center gap-3 p-3.5 transition hover:bg-muted-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:items-start sm:p-4"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl sm:h-14 sm:w-14">
              <PlaceholderArt type={category.placeholder} aspect="square" />
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-sm font-extrabold text-foreground sm:text-base">
                  {categoryName(category.id, category.nameAr, language)}
                </h2>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground rtl:rotate-180" />
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground sm:text-xs">
                {categoryHint(category.id, category.hintAr ?? "", language)}
              </p>
              <span className="mt-2 inline-flex text-[10px] font-bold text-primary sm:text-[11px]">
                {text("عرض إعلانات القسم", "View category listings")}
              </span>
            </div>
          </Link>

          <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-border/70 p-3 sm:flex-wrap">
            {(childrenByCategory.get(category.id) ?? []).slice(0, 8).map((subcategory) => (
              <Link
                key={subcategory.id}
                to="/listings"
                search={{ category: category.id, subcategory: subcategory.id }}
                className="shrink-0 rounded-full bg-muted-surface px-3 py-1.5 text-[10px] font-bold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-[11px]"
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

function Panel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rawaj-surface mt-4 rounded-[1.4rem] p-8 text-center text-sm sm:rounded-3xl">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted-surface text-gold">
        <Sparkles className="h-5 w-5" />
      </span>
      <p className="mt-3 font-bold text-foreground">{title}</p>
      {body && (
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">{body}</p>
      )}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
