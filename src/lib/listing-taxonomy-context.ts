import type { TaxonomyNode } from "@/lib/classifieds-types";
import { buildTaxonomyIndex, getTaxonomyPath } from "@/lib/taxonomy";

export type ListingTaxonomyContextSource =
  "canonical_assignment" | "details_fallback" | "legacy_compatible" | "legacy_category";

export interface ListingTaxonomyContext {
  taxonomyNodeId: string;
  selectedNode: TaxonomyNode | null;
  path: TaxonomyNode[];
  source: ListingTaxonomyContextSource;
}

export function resolveListingTaxonomyContext({
  taxonomyNodes,
  canonicalTaxonomyNodeId,
  detailsTaxonomyNodeId,
  categoryId,
  subcategoryId,
}: {
  taxonomyNodes: TaxonomyNode[];
  canonicalTaxonomyNodeId?: string | null;
  detailsTaxonomyNodeId?: string | null;
  categoryId: string;
  subcategoryId?: string | null;
}): ListingTaxonomyContext {
  const index = buildTaxonomyIndex(taxonomyNodes);

  for (const [candidate, source] of [
    [canonicalTaxonomyNodeId, "canonical_assignment"],
    [detailsTaxonomyNodeId, "details_fallback"],
  ] as const) {
    const node = candidate ? index.byId.get(candidate) : undefined;
    const path = node?.isLeaf ? getTaxonomyPath(index, node) : [];
    if (node?.isLeaf && path.length > 0) {
      return { taxonomyNodeId: node.id, selectedNode: node, path, source };
    }
  }

  const compatibleLeaves = [...index.byId.values()].filter(
    (node) =>
      node.isLeaf &&
      node.legacyCategoryId === categoryId &&
      (!subcategoryId || node.legacySubcategoryId === subcategoryId),
  );
  const compatibleNode = subcategoryId
    ? compatibleLeaves[0]
    : compatibleLeaves.length === 1
      ? compatibleLeaves[0]
      : undefined;
  const compatiblePath = compatibleNode ? getTaxonomyPath(index, compatibleNode) : [];
  if (compatibleNode && compatiblePath.length > 0) {
    return {
      taxonomyNodeId: compatibleNode.id,
      selectedNode: compatibleNode,
      path: compatiblePath,
      source: "legacy_compatible",
    };
  }

  return {
    taxonomyNodeId: "",
    selectedNode: null,
    path: [],
    source: "legacy_category",
  };
}
