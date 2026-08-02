import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { sortLocationNodesForDisplay } from "@/lib/location-node-order";
import type { LocationNode as CanonicalLocationNode, LocationNodeType } from "@/lib/location-types";
import {
  fetchCloudflareLocationChildren,
  fetchCloudflareLocationDescendantIds,
  fetchCloudflareLocationPath,
  fetchCloudflareLocationRoots,
  searchCloudflareLocations,
} from "@/lib/public-data/cloudflare-client";

export type { LocationNodeType };
export type { CanonicalLocationNode };

export interface LocationSearchResult {
  node: CanonicalLocationNode;
  matchedAlias: string | null;
  pathAr: string;
  pathEn: string;
}

export async function fetchLocationRoots(
  countryCode = "SA",
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  const result = await fetchCloudflareLocationRoots(countryCode);
  return result.ok ? { ok: true, data: sortLocationNodesForDisplay(result.data) } : result;
}

export async function fetchLocationChildren(
  parentId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  const result = await fetchCloudflareLocationChildren(parentId);
  return result.ok ? { ok: true, data: sortLocationNodesForDisplay(result.data) } : result;
}

export async function fetchLocationNode(
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode | null>> {
  const result = await fetchCloudflareLocationPath(nodeId);
  if (!result.ok) return result.error.code === "not_found" ? { ok: true, data: null } : result;
  return { ok: true, data: result.data.at(-1) ?? null };
}

export function searchLocationNodes(
  query: string,
  limit = 12,
): Promise<ClassifiedsResult<LocationSearchResult[]>> {
  const clean = query.trim();
  if (clean.length < 2) return Promise.resolve({ ok: true, data: [] });
  return searchCloudflareLocations(clean, Math.max(1, Math.min(limit, 20)));
}

export function fetchLocationPath(
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  return fetchCloudflareLocationPath(nodeId);
}

export function resolveLocationDescendantIds(nodeId: string): Promise<ClassifiedsResult<string[]>> {
  return fetchCloudflareLocationDescendantIds(nodeId);
}
