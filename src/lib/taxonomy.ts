import type { TaxonomyNode } from "@/lib/classifieds-types";

export type Language = "ar" | "en";

export interface TaxonomyIndex {
  byId: Map<string, TaxonomyNode>;
  bySlug: Map<string, TaxonomyNode>;
  childrenByParent: Map<string, TaxonomyNode[]>;
}

export interface TaxonomyListingSearch {
  taxonomy: string;
  category?: string;
  taxonomyLegacySubcategoryId?: string;
  property_purpose?: string;
  property_type?: string;
}

const rootParentKey = "__root__";

export function buildTaxonomyIndex(nodes: TaxonomyNode[]): TaxonomyIndex {
  const visibleNodes = filterReachableActiveNodes(nodes);
  const byId = new Map<string, TaxonomyNode>();
  const bySlug = new Map<string, TaxonomyNode>();
  const childrenByParent = new Map<string, TaxonomyNode[]>();

  for (const node of visibleNodes) {
    byId.set(node.id, node);
    bySlug.set(node.slug, node);
    const parentKey = node.parentId ?? rootParentKey;
    childrenByParent.set(parentKey, [...(childrenByParent.get(parentKey) ?? []), node]);
  }

  for (const [parent, children] of childrenByParent) {
    childrenByParent.set(parent, [...children].sort(compareTaxonomyNodes));
  }

  return { byId, bySlug, childrenByParent };
}

export function getTaxonomyRootNodes(index: TaxonomyIndex) {
  return index.childrenByParent.get(rootParentKey) ?? [];
}

export function getTaxonomyChildren(index: TaxonomyIndex, nodeId: string) {
  return index.childrenByParent.get(nodeId) ?? [];
}

export function findTaxonomyNode(index: TaxonomyIndex, value?: string | null) {
  if (!value) return undefined;
  return index.byId.get(value) ?? index.bySlug.get(value);
}

export function getTaxonomyPath(index: TaxonomyIndex, node?: TaxonomyNode | null) {
  if (!node) return [];
  const path: TaxonomyNode[] = [];
  const visited = new Set<string>();
  let current: TaxonomyNode | undefined = node;

  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentId ? index.byId.get(current.parentId) : undefined;
  }

  return current ? [] : path;
}

export function taxonomyNodeName(node: TaxonomyNode, language: Language) {
  return language === "en" ? (node.nameEn ?? node.nameAr) : node.nameAr;
}

export function taxonomyNodeDescription(node: TaxonomyNode, language: Language) {
  return language === "en"
    ? (node.descriptionEn ?? node.descriptionAr)
    : (node.descriptionAr ?? node.descriptionEn);
}

export function taxonomyPathLabel(path: TaxonomyNode[], language: Language) {
  return path.map((node) => taxonomyNodeName(node, language)).join(" / ");
}

export function taxonomyMatchesSearch(node: TaxonomyNode, term: string, path: TaxonomyNode[]) {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) return true;
  return [
    node.slug,
    node.nameAr,
    node.nameEn ?? "",
    node.descriptionAr ?? "",
    node.descriptionEn ?? "",
    ...path.flatMap((item) => [item.nameAr, item.nameEn ?? "", item.slug]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedTerm);
}

export function resolveTaxonomyListingSearch(
  node: TaxonomyNode,
  path: TaxonomyNode[],
): TaxonomyListingSearch {
  const classification = composeTaxonomyClassification(path);

  return stripUndefined({
    taxonomy: node.id,
    category: classification.category ?? undefined,
    taxonomyLegacySubcategoryId: classification.legacySubcategory ?? undefined,
    property_purpose: classification.propertyPurpose ?? undefined,
    property_type: classification.propertyType ?? undefined,
  });
}

export function taxonomyListingUrlSearch(search: TaxonomyListingSearch) {
  const urlSearch = { ...search };
  delete urlSearch.taxonomyLegacySubcategoryId;
  return urlSearch;
}

export function flattenTaxonomy(index: TaxonomyIndex) {
  const result: Array<{ node: TaxonomyNode; path: TaxonomyNode[] }> = [];
  const walk = (nodes: TaxonomyNode[], parentPath: TaxonomyNode[]) => {
    for (const node of nodes) {
      const path = [...parentPath, node];
      result.push({ node, path });
      walk(getTaxonomyChildren(index, node.id), path);
    }
  };
  walk(getTaxonomyRootNodes(index), []);
  return result;
}

export function getTaxonomyLevelScope(
  index: TaxonomyIndex,
  node: TaxonomyNode,
  path: TaxonomyNode[],
): Array<{
  categoryId: string;
  subcategoryId?: string;
  propertyPurpose?: string;
  propertyType?: string;
}> | null {
  if (path[path.length - 1] !== node) return null;

  const directScope = composeTaxonomyClassification(path);
  if (!directScope.category) return null;

  const parentPath = path.slice(0, -1);
  const parentScope = parentPath.length > 0 ? composeTaxonomyClassification(parentPath) : null;
  const normalizedDirectScope = toLevelScope(directScope);
  const normalizedParentScope = parentScope?.category ? toLevelScope(parentScope) : null;

  if (!normalizedParentScope || !sameLevelScope(normalizedDirectScope, normalizedParentScope)) {
    return [normalizedDirectScope];
  }

  const childScopes = getTaxonomyChildren(index, node.id)
    .map((child) => {
      const childPath = [...path, child];
      return getTaxonomyLevelScope(index, child, childPath);
    })
    .filter(
      (
        scope,
      ): scope is Array<{
        categoryId: string;
        subcategoryId?: string;
        propertyPurpose?: string;
        propertyType?: string;
      }> => scope != null,
    );

  if (childScopes.length === 0) return null;

  const allScopes = childScopes.flat();
  const seen = new Set<string>();
  const deduped: Array<{
    categoryId: string;
    subcategoryId?: string;
    propertyPurpose?: string;
    propertyType?: string;
  }> = [];
  for (const scope of allScopes) {
    const key = `${scope.categoryId}|${scope.subcategoryId ?? ""}|${scope.propertyPurpose ?? ""}|${scope.propertyType ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(scope);
    }
  }

  return deduped.length > 0 ? deduped : null;
}

function toLevelScope(classification: ReturnType<typeof composeTaxonomyClassification>) {
  return {
    categoryId: classification.category ?? "",
    subcategoryId: classification.legacySubcategory ?? undefined,
    propertyPurpose: classification.propertyPurpose ?? undefined,
    propertyType: classification.propertyType ?? undefined,
  };
}

function sameLevelScope(
  a: {
    categoryId: string;
    subcategoryId?: string;
    propertyPurpose?: string;
    propertyType?: string;
  },
  b: {
    categoryId: string;
    subcategoryId?: string;
    propertyPurpose?: string;
    propertyType?: string;
  },
) {
  return (
    a.categoryId === b.categoryId &&
    a.subcategoryId === b.subcategoryId &&
    a.propertyPurpose === b.propertyPurpose &&
    a.propertyType === b.propertyType
  );
}

function composeTaxonomyClassification(path: TaxonomyNode[]) {
  const result: {
    category?: string | null;
    legacySubcategory?: string | null;
    propertyPurpose?: string | null;
    propertyType?: string | null;
  } = {};

  for (const node of path) {
    if (node.legacyCategoryId) result.category = node.legacyCategoryId;
  }

  const targetNode = path[path.length - 1];
  if (targetNode?.legacySubcategoryId) {
    result.legacySubcategory = targetNode.legacySubcategoryId;
  }

  for (const node of path) {
    if (node.classificationKey && node.classificationValue) {
      switch (node.classificationKey) {
        case "listing_purpose":
          result.propertyPurpose = node.classificationValue;
          break;
        case "property_type":
          result.propertyType = node.classificationValue;
          break;
        default:
          break;
      }
    }
  }

  return result;
}

function filterReachableActiveNodes(nodes: TaxonomyNode[]) {
  const source = new Map(nodes.filter((node) => node.isActive).map((node) => [node.id, node]));
  const memo = new Map<string, boolean>();

  const isReachable = (node: TaxonomyNode, visiting: Set<string>): boolean => {
    const cached = memo.get(node.id);
    if (cached !== undefined) return cached;
    if (visiting.has(node.id)) {
      memo.set(node.id, false);
      return false;
    }
    if (!node.parentId) {
      memo.set(node.id, true);
      return true;
    }

    const parent = source.get(node.parentId);
    if (!parent) {
      memo.set(node.id, false);
      return false;
    }

    visiting.add(node.id);
    const reachable = isReachable(parent, visiting);
    visiting.delete(node.id);
    memo.set(node.id, reachable);
    return reachable;
  };

  return [...source.values()].filter((node) => isReachable(node, new Set()));
}

function compareTaxonomyNodes(a: TaxonomyNode, b: TaxonomyNode) {
  return a.sortOrder === b.sortOrder ? a.nameAr.localeCompare(b.nameAr) : a.sortOrder - b.sortOrder;
}

function stripUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
