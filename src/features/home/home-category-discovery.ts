import type { ClassifiedCategory, TaxonomyNode } from "@/lib/classifieds-types";
import {
  buildTaxonomyIndex,
  getTaxonomyRootNodes,
  resolveTaxonomyDiscoveryTarget,
  type TaxonomyDiscoveryTarget,
} from "@/lib/taxonomy";

export interface HomeCategoryWorld {
  id: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  iconKey: string | null;
  legacyCategoryId: string | null;
  target: TaxonomyDiscoveryTarget | { kind: "legacy"; slug: string };
}

type CanonicalHomeCategoryWorld = Omit<HomeCategoryWorld, "target"> & {
  target: TaxonomyDiscoveryTarget;
};

export function buildCanonicalHomeCategoryWorlds(
  taxonomyNodes: TaxonomyNode[],
  limit = 6,
): HomeCategoryWorld[] {
  const index = buildTaxonomyIndex(taxonomyNodes);
  return getTaxonomyRootNodes(index)
    .map((node) => {
      const target = resolveTaxonomyDiscoveryTarget(index, node);
      return target
        ? {
            id: node.id,
            nameAr: node.nameAr,
            nameEn: node.nameEn,
            descriptionAr: node.descriptionAr,
            descriptionEn: node.descriptionEn,
            iconKey: node.iconKey,
            legacyCategoryId: node.legacyCategoryId,
            target,
          }
        : null;
    })
    .filter((world): world is CanonicalHomeCategoryWorld => world !== null)
    .slice(0, Math.max(0, limit));
}

export function buildLegacyHomeCategoryWorlds(
  categories: ClassifiedCategory[],
  limit = 6,
): HomeCategoryWorld[] {
  return [...categories]
    .filter((category) => category.isActive)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr) || a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, limit))
    .map((category) => ({
      id: category.id,
      nameAr: category.nameAr,
      nameEn: null,
      descriptionAr: category.hintAr,
      descriptionEn: null,
      iconKey: category.placeholder,
      legacyCategoryId: category.id,
      target: { kind: "legacy", slug: category.slug },
    }));
}
