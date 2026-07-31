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
          <p className="text-xs font-semibold text-muted-foreground" role="status" aria-live="polite">
            {searchResults.length > 0
              ? text(
                  `${searchResults.length} تصنيفاً نهائياً مطابقاً`,
                  `${searchResults.length} matching final categories`,
                )
              : text("لم نجد تصنيفاً مطابقاً", "No matching category found")}
          </p>

          {searchResults.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2" role="list">
              {searchResults.map(({ node, path: resultPath }) => (
                <button
                  key={node.id}
                  type="button"
                  role="listitem"
                  onClick={() => choose(node)}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border/75 bg-card/85 p-3 text-start transition hover:border-primary/35 hover:bg-card active:scale-[0.99]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">
                      {taxonomyNodeName(node, language)}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                      {taxonomyPathLabel(resultPath, language)}
                    </span>
                  </span>
                  <Check className="h-4 w-4 shrink-0 text-primary" />
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
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/35 p-3 text-xs">
              {path.map((node, indexInPath) => (
                <button
                  key={node.id}
                  type="button"
                  aria-current={node.id === selectedNodeId ? "step" : undefined}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold hover:bg-background"
                  onClick={() => choose(node)}
                >
                  {taxonomyNodeName(node, language)}
                  {indexInPath < path.length - 1 && <DirectionIcon className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}

          {selected?.isLeaf ? (
            <div
              className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-4"
              role="status"
            >
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">
                  {text("تم اختيار التصنيف النهائي", "Final category selected")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {taxonomyPathLabel(path, language)}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" role="list">
              {options.map((node) => {
                const children = getTaxonomyChildren(index, node.id);
                const finalCategoryCount = leafCount(node);
                return (
                  <button
                    key={node.id}
                    type="button"
                    role="listitem"
                    onClick={() => choose(node)}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border/75 bg-card/85 p-3 text-start transition hover:border-primary/35 hover:bg-card active:scale-[0.99]"
                  >
                    <span>
                      <span className="block text-sm font-bold">
                        {taxonomyNodeName(node, language)}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {node.isLeaf
                          ? text("اختيار نهائي", "Final selection")
                          : text(
                              `${finalCategoryCount} تصنيفاً نهائياً ضمن ${children.length} خيارات`,
                              `${finalCategoryCount} final categories in ${children.length} options`,
                            )}
                      </span>
                    </span>
                    {node.isLeaf ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <DirectionIcon className="h-4 w-4 text-muted-foreground" />
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
