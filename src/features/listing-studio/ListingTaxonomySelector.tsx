import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { TaxonomyNode } from "@/lib/classifieds-types";
import {
  buildTaxonomyIndex,
  getTaxonomyChildren,
  getTaxonomyPath,
  getTaxonomyRootNodes,
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

export function ListingTaxonomySelector({
  nodes,
  selectedNodeId,
  language,
  onSelect,
  text,
}: ListingTaxonomySelectorProps) {
  const index = buildTaxonomyIndex(nodes);
  const selected = selectedNodeId ? index.byId.get(selectedNodeId) : undefined;
  const path = getTaxonomyPath(index, selected);
  const parentPath = selected?.isLeaf ? path.slice(0, -1) : path;
  const parent = parentPath[parentPath.length - 1];
  const options = parent ? getTaxonomyChildren(index, parent.id) : getTaxonomyRootNodes(index);
  const DirectionIcon = language === "ar" ? ChevronLeft : ChevronRight;

  function choose(node: TaxonomyNode) {
    onSelect(node, getTaxonomyPath(index, node));
  }

  return (
    <div
      className="space-y-4"
      data-listing-taxonomy-selector="true"
      aria-label={text("اختيار تصنيف الإعلان", "Choose listing category")}
    >
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
                      : text(`${children.length} خيارات`, `${children.length} options`)}
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
    </div>
  );
}
