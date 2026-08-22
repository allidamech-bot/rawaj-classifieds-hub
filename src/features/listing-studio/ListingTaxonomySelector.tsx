import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { TaxonomyNode } from "@/lib/classifieds-types";
import {
  buildTaxonomyIndex,
  getTaxonomyChildren,
  getTaxonomyLeafDescendants,
  getTaxonomyPath,
  getTaxonomyRootNodes,
  searchTaxonomyNodes,
  taxonomyNodeName,
  taxonomyPathLabel,
  type Language,
} from "@/lib/taxonomy";

interface ListingTaxonomySelectorProps {
  nodes: TaxonomyNode[];
  selectedNodeId: string;
  language: Language;
  onSelect: (node: TaxonomyNode, path: TaxonomyNode[]) => void;
  text: (ar: string, en: string) => string;
}

const MAX_SEARCH_RESULTS = 24;

export function ListingTaxonomySelector({
  nodes,
  selectedNodeId,
  language,
  onSelect,
  text,
}: ListingTaxonomySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const index = useMemo(() => buildTaxonomyIndex(nodes), [nodes]);
  const selected = selectedNodeId ? index.byId.get(selectedNodeId) : undefined;
  const path = getTaxonomyPath(index, selected);
  const parentPath = selected?.isLeaf ? path.slice(0, -1) : path;
  const parent = parentPath[parentPath.length - 1];
  const currentDepth = parentPath.length;
  const rawOptions = parent ? getTaxonomyChildren(index, parent.id) : getTaxonomyRootNodes(index);
  const options = rawOptions.filter((node) => getTaxonomyLeafDescendants(index, node).length > 0);
  const normalizedSearchTerm = searchTerm.trim();
  const searchResults = useMemo(
    () =>
      normalizedSearchTerm
        ? searchTaxonomyNodes(index, normalizedSearchTerm)
            .filter(({ node }) => node.isLeaf)
            .slice(0, MAX_SEARCH_RESULTS)
        : [],
    [index, normalizedSearchTerm],
  );
  const DirectionIcon = language === "ar" ? ChevronLeft : ChevronRight;

  function choose(node: TaxonomyNode) {
    onSelect(node, getTaxonomyPath(index, node));
    if (node.isLeaf) setSearchTerm("");
  }

  function leafCount(node: TaxonomyNode) {
    return getTaxonomyLeafDescendants(index, node).length;
  }

  return (
    <div
      className="space-y-4"
      data-listing-taxonomy-selector="true"
      data-taxonomy-depth={currentDepth}
      aria-label={text("اختيار تصنيف الإعلان", "Choose listing category")}
    >
      <div className="relative">
        <label htmlFor="listing-taxonomy-search" className="sr-only">
          {text("ابحث عن التصنيف المناسب", "Search for the right category")}
        </label>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="listing-taxonomy-search"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={text(
            "ابحث مثل: سيارة، شقة، هاتف، وظيفة...",
            "Search: car, apartment, phone, job...",
          )}
          autoComplete="off"
          className="h-12 w-full rounded-2xl border border-border/75 bg-card/85 px-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute end-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={text("مسح البحث", "Clear search")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {normalizedSearchTerm ? (
        <div className="space-y-3" data-taxonomy-search-results="true">
          <p
            className="text-xs font-semibold text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {searchResults.length > 0
              ? text(
                  `${searchResults.length} تصنيفاً نهائياً مطابقاً`,
                  `${searchResults.length} matching final categories`,
                )
              : text("لم نجد تصنيفاً مطابقاً", "No matching category found")}
          </p>

          {searchResults.length > 0 ? (
            <div className="rawaj-taxonomy-results" role="list">
              {searchResults.map(({ node, path: resultPath }) => (
                <button
                  key={node.id}
                  type="button"
                  role="listitem"
                  onClick={() => choose(node)}
                  aria-pressed={node.id === selectedNodeId}
                  data-selected={node.id === selectedNodeId}
                  data-taxonomy-kind="search-leaf"
                  className="rawaj-taxonomy-option"
                >
                  <span className="rawaj-taxonomy-option__copy">
                    <span className="rawaj-taxonomy-option__title">
                      {taxonomyNodeName(node, language)}
                    </span>
                    <span
                      className="rawaj-taxonomy-option__path"
                      title={taxonomyPathLabel(resultPath, language)}
                    >
                      {taxonomyPathLabel(resultPath, language)}
                    </span>
                  </span>
                  <Check className="rawaj-taxonomy-option__icon" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              {text(
                "جرّب اسماً أقصر أو كلمة مختلفة، أو امسح البحث وتصفح الأقسام.",
                "Try a shorter or different term, or clear search and browse categories.",
              )}
            </p>
          )}
        </div>
      ) : (
        <>
          {path.length > 0 && (
            <nav
              className="rawaj-taxonomy-breadcrumb"
              aria-label={text("مسار التصنيف", "Category path")}
            >
              {path.map((node, indexInPath) => (
                <span className="rawaj-taxonomy-breadcrumb__segment" key={node.id}>
                  <button
                    type="button"
                    aria-current={node.id === selectedNodeId ? "step" : undefined}
                    data-current={indexInPath === path.length - 1}
                    title={taxonomyNodeName(node, language)}
                    onClick={() => choose(node)}
                  >
                    {taxonomyNodeName(node, language)}
                  </button>
                  {indexInPath < path.length - 1 ? <DirectionIcon aria-hidden="true" /> : null}
                </span>
              ))}
            </nav>
          )}

          {selected?.isLeaf ? (
            <div className="rawaj-taxonomy-selection" role="status">
              <span className="rawaj-taxonomy-selection__icon">
                <Check aria-hidden="true" />
              </span>
              <div>
                <p>{text("تم اختيار التصنيف النهائي", "Final category selected")}</p>
                <small title={taxonomyPathLabel(path, language)}>
                  {taxonomyPathLabel(path, language)}
                </small>
              </div>
            </div>
          ) : (
            <div className="rawaj-taxonomy-options" role="list" aria-live="polite">
              {options.map((node) => {
                const children = getTaxonomyChildren(index, node.id);
                const finalCategoryCount = leafCount(node);
                return (
                  <button
                    key={node.id}
                    type="button"
                    role="listitem"
                    onClick={() => choose(node)}
                    data-taxonomy-depth={currentDepth}
                    data-taxonomy-kind={node.isLeaf ? "leaf" : "branch"}
                    className="rawaj-taxonomy-option"
                  >
                    <span className="rawaj-taxonomy-option__copy">
                      <span className="rawaj-taxonomy-option__title">
                        {taxonomyNodeName(node, language)}
                      </span>
                      <span className="rawaj-taxonomy-option__meta">
                        {node.isLeaf
                          ? text("اختيار نهائي", "Final selection")
                          : text(
                              `${finalCategoryCount} تصنيفاً نهائياً ضمن ${children.length} خيارات`,
                              `${finalCategoryCount} final categories in ${children.length} options`,
                            )}
                      </span>
                    </span>
                    {node.isLeaf ? (
                      <Check className="rawaj-taxonomy-option__icon" aria-hidden="true" />
                    ) : (
                      <DirectionIcon className="rawaj-taxonomy-option__icon" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!selected?.isLeaf && options.length === 0 && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              {text(
                "هذا المسار لا يحتوي تصنيفاً نهائياً متاحاً. ارجع واختر مساراً آخر.",
                "This path has no available final category. Go back and choose another path.",
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
