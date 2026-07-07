import type { LocationNode } from "@/lib/location-types";

export type LocationIndex = {
  byId: Map<string, LocationNode>;
  childrenByParent: Map<string | null, LocationNode[]>;
};

export function buildLocationIndex(nodes: LocationNode[]): LocationIndex {
  const byId = new Map<string, LocationNode>();
  const childrenByParent = new Map<string | null, LocationNode[]>();
  for (const node of nodes) {
    byId.set(node.id, node);
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
  }
  return { byId, childrenByParent };
}

export function findLocationNode(
  index: LocationIndex,
  id?: string | null,
): LocationNode | undefined {
  return id ? index.byId.get(id) : undefined;
}

export function getLocationChildren(index: LocationIndex, parentId: string | null): LocationNode[] {
  return index.childrenByParent.get(parentId) ?? [];
}

export function getLocationPath(index: LocationIndex, node?: LocationNode | null): LocationNode[] {
  if (!node) return [];
  const path: LocationNode[] = [];
  const visited = new Set<string>();
  let current: LocationNode | undefined = node;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.push(current);
    current = current.parentId ? index.byId.get(current.parentId) : undefined;
  }
  return path.reverse();
}

export function getLocationDescendants(index: LocationIndex, nodeId: string): LocationNode[] {
  const result: LocationNode[] = [];
  const queue = [...getLocationChildren(index, nodeId)];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    result.push(current);
    queue.push(...getLocationChildren(index, current.id));
  }
  return result;
}

export function getLocationDescendantIds(
  index: LocationIndex,
  nodeId: string,
  includeSelf = true,
): string[] {
  const ids = getLocationDescendants(index, nodeId).map((node) => node.id);
  return includeSelf ? [nodeId, ...ids] : ids;
}

export function isLocationWithin(
  index: LocationIndex,
  candidateId: string,
  ancestorId: string,
): boolean {
  if (candidateId === ancestorId) return true;
  let current = index.byId.get(candidateId);
  const visited = new Set<string>();
  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = index.byId.get(current.parentId);
  }
  return false;
}

export function locationNodeName(node: LocationNode, language: "ar" | "en"): string {
  return language === "en" ? node.nameEn?.trim() || node.nameAr : node.nameAr;
}

export function locationPathLabel(path: LocationNode[], language: "ar" | "en"): string {
  return path.map((node) => locationNodeName(node, language)).join(" · ");
}

export function locationMatchesSearch(node: LocationNode, term: string): boolean {
  const normalized = term.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [node.nameAr, node.nameEn ?? "", ...node.searchAliases].some((value) =>
    value.toLocaleLowerCase().includes(normalized),
  );
}

export function findLocationByLegacyValues(
  nodes: LocationNode[],
  governorateId?: string | null,
  districtAr?: string | null,
): LocationNode | undefined {
  const district = districtAr?.trim();
  if (district) {
    const exact = nodes.find(
      (node) =>
        node.legacyGovernorateId === governorateId && node.legacyDistrictAr?.trim() === district,
    );
    if (exact) return exact;
  }
  return nodes.find(
    (node) => node.nodeType === "governorate" && node.legacyGovernorateId === governorateId,
  );
}
