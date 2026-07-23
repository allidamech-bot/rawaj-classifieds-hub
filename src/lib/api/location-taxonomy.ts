import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { sortLocationNodesForDisplay } from "@/lib/location-node-order";
import {
  escapePostgrestSearchTerm,
  getClient,
  mapError,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import {
  fetchCloudflareLocationChildren,
  fetchCloudflareLocationDescendantIds,
  fetchCloudflareLocationPath,
  fetchCloudflareLocationRoots,
  searchCloudflareLocations,
} from "@/lib/public-data/cloudflare-client";

export type LocationNodeType =
  | "country"
  | "governorate"
  | "district"
  | "subdistrict"
  | "city"
  | "town"
  | "village"
  | "neighborhood"
  | "locality";

export interface CanonicalLocationNode {
  id: string;
  parentId: string | null;
  countryCode: string;
  nodeType: LocationNodeType;
  nameAr: string;
  nameEn: string | null;
  slug: string;
  sortOrder: number;
  depth: number;
  isActive: boolean;
  externalSource: string | null;
  externalId: string | null;
  legacyGovernorateId: string | null;
  legacyDistrictAr: string | null;
}

export interface LocationSearchResult {
  node: CanonicalLocationNode;
  matchedAlias: string | null;
  pathAr: string;
  pathEn: string;
}

function mapLocationNode(row: Record<string, unknown>): CanonicalLocationNode {
  return {
    id: rowString(row, "id"),
    parentId: rowNullableString(row, "parent_id"),
    countryCode: rowString(row, "country_code", "SY"),
    nodeType: rowString(row, "node_type", "locality") as LocationNodeType,
    nameAr: rowString(row, "name_ar"),
    nameEn: rowNullableString(row, "name_en"),
    slug: rowString(row, "slug"),
    sortOrder: rowNumber(row, "sort_order"),
    depth: rowNumber(row, "depth"),
    isActive: rowBoolean(row, "is_active", true),
    externalSource: rowNullableString(row, "external_source"),
    externalId: rowNullableString(row, "external_id"),
    legacyGovernorateId: rowNullableString(row, "legacy_governorate_id"),
    legacyDistrictAr: rowNullableString(row, "legacy_district_ar"),
  };
}

function normalizeLocationSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function rankLocationResult(
  result: Pick<LocationSearchResult, "node" | "matchedAlias">,
  normalizedQuery: string,
) {
  const names = [result.node.nameAr, result.node.nameEn]
    .filter((value): value is string => Boolean(value))
    .map(normalizeLocationSearch);
  const alias = result.matchedAlias ? normalizeLocationSearch(result.matchedAlias) : "";

  if (names.includes(normalizedQuery)) return 0;
  if (alias === normalizedQuery) return 1;
  if (names.some((name) => name.startsWith(normalizedQuery))) return 2;
  if (alias.startsWith(normalizedQuery)) return 3;
  if (names.some((name) => name.includes(normalizedQuery))) return 4;
  if (alias.includes(normalizedQuery)) return 5;
  return 6;
}

const LOCATION_NODE_SELECT =
  "id,parent_id,country_code,node_type,name_ar,name_en,slug,sort_order,depth,is_active,external_source,external_id,legacy_governorate_id,legacy_district_ar";

export async function fetchLocationRoots(
  countryCode = "SY",
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  if (isCloudflarePublicDataProvider()) return fetchCloudflareLocationRoots(countryCode);
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("location_nodes")
    .select(LOCATION_NODE_SELECT)
    .eq("country_code", countryCode)
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order", { ascending: true })
    .order("name_ar", { ascending: true });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: sortLocationNodesForDisplay(
      ((data ?? []) as Record<string, unknown>[]).map(mapLocationNode),
    ),
  };
}

export async function fetchLocationChildren(
  parentId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  if (isCloudflarePublicDataProvider()) return fetchCloudflareLocationChildren(parentId);
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("location_nodes")
    .select(LOCATION_NODE_SELECT)
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name_ar", { ascending: true });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: sortLocationNodesForDisplay(
      ((data ?? []) as Record<string, unknown>[]).map(mapLocationNode),
    ),
  };
}

export async function fetchLocationNode(
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode | null>> {
  if (isCloudflarePublicDataProvider()) {
    const result = await fetchCloudflareLocationPath(nodeId);
    if (!result.ok) return result.error.code === "not_found" ? { ok: true, data: null } : result;
    return { ok: true, data: result.data.at(-1) ?? null };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("location_nodes")
    .select(LOCATION_NODE_SELECT)
    .eq("id", nodeId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: data ? mapLocationNode(data as Record<string, unknown>) : null,
  };
}

export async function searchLocationNodes(
  query: string,
  limit = 12,
): Promise<ClassifiedsResult<LocationSearchResult[]>> {
  const clean = query.trim();
  if (clean.length < 2) return { ok: true, data: [] };
  if (isCloudflarePublicDataProvider()) return searchCloudflareLocations(clean, limit);

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const safeLimit = Math.max(1, Math.min(limit, 20));
  const candidateLimit = Math.min(200, Math.max(80, safeLimit * 8));
  const escaped = escapePostgrestSearchTerm(clean);
  const normalized = normalizeLocationSearch(clean);
  const escapedNormalized = escapePostgrestSearchTerm(normalized);

  const [nodesResult, aliasesResult] = await Promise.all([
    client
      .from("location_nodes")
      .select(LOCATION_NODE_SELECT)
      .eq("country_code", "SY")
      .eq("is_active", true)
      .or(`name_ar.ilike.%${escaped}%,name_en.ilike.%${escaped}%`)
      .limit(candidateLimit),
    client
      .from("location_search_aliases")
      .select("location_node_id,alias,normalized_alias")
      .ilike("normalized_alias", `%${escapedNormalized}%`)
      .limit(candidateLimit),
  ]);

  if (nodesResult.error) return { ok: false, error: mapError(nodesResult.error) };

  const directNodes = ((nodesResult.data ?? []) as Record<string, unknown>[]).map(mapLocationNode);
  const aliases = aliasesResult.error
    ? []
    : ((aliasesResult.data ?? []) as Record<string, unknown>[]);
  const aliasIds = [
    ...new Set(aliases.map((row) => rowString(row, "location_node_id")).filter(Boolean)),
  ];

  let aliasNodes: CanonicalLocationNode[] = [];
  if (aliasIds.length > 0) {
    const { data, error } = await client
      .from("location_nodes")
      .select(LOCATION_NODE_SELECT)
      .eq("country_code", "SY")
      .eq("is_active", true)
      .in("id", aliasIds);
    if (error) return { ok: false, error: mapError(error) };
    aliasNodes = ((data ?? []) as Record<string, unknown>[]).map(mapLocationNode);
  }

  const aliasByNodeId = new Map<string, string>();
  for (const row of aliases) {
    const nodeId = rowString(row, "location_node_id");
    const alias = rowString(row, "alias");
    if (nodeId && alias && !aliasByNodeId.has(nodeId)) aliasByNodeId.set(nodeId, alias);
  }

  const mergedById = new Map<string, Pick<LocationSearchResult, "node" | "matchedAlias">>();
  for (const node of directNodes) {
    mergedById.set(node.id, { node, matchedAlias: null });
  }
  for (const node of aliasNodes) {
    const existing = mergedById.get(node.id);
    mergedById.set(node.id, {
      node,
      matchedAlias: existing?.matchedAlias ?? aliasByNodeId.get(node.id) ?? null,
    });
  }

  const ranked = [...mergedById.values()]
    .sort((left, right) => {
      const scoreDelta =
        rankLocationResult(left, normalized) - rankLocationResult(right, normalized);
      if (scoreDelta !== 0) return scoreDelta;
      if (left.node.depth !== right.node.depth) return left.node.depth - right.node.depth;
      return left.node.nameAr.localeCompare(right.node.nameAr, "ar");
    })
    .slice(0, safeLimit);

  const paths = await Promise.all(
    ranked.map((result) => fetchLocationPathWithClient(client, result.node.id)),
  );

  const hydrated = ranked.map((result, index): LocationSearchResult => {
    const pathResult = paths[index];
    const path = pathResult?.ok ? pathResult.data : [result.node];
    const visiblePath = path.filter((node) => node.nodeType !== "country");
    return {
      ...result,
      pathAr: visiblePath.map((node) => node.nameAr).join(" › "),
      pathEn: visiblePath.map((node) => node.nameEn || node.nameAr).join(" › "),
    };
  });

  return { ok: true, data: hydrated };
}

export async function fetchLocationPath(
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  if (isCloudflarePublicDataProvider()) return fetchCloudflareLocationPath(nodeId);
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  return fetchLocationPathWithClient(clientResult.data, nodeId);
}

async function fetchLocationPathWithClient(
  client: SupabaseClient,
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  const { data, error } = await client.rpc("rawaj_location_path", {
    node_id: nodeId,
  });
  if (error) return { ok: false, error: mapError(error) };

  const path = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: rowString(row, "id"),
    parentId: rowNullableString(row, "parent_id"),
    countryCode: "SY",
    nodeType: rowString(row, "node_type", "locality") as LocationNodeType,
    nameAr: rowString(row, "name_ar"),
    nameEn: rowNullableString(row, "name_en"),
    slug: rowString(row, "slug"),
    sortOrder: 0,
    depth: rowNumber(row, "depth"),
    isActive: true,
    externalSource: null,
    externalId: null,
    legacyGovernorateId: null,
    legacyDistrictAr: null,
  }));

  return { ok: true, data: path };
}

export async function resolveLocationDescendantIds(
  nodeId: string,
): Promise<ClassifiedsResult<string[]>> {
  if (isCloudflarePublicDataProvider()) return fetchCloudflareLocationDescendantIds(nodeId);
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_location_descendant_ids", {
    root_id: nodeId,
  });
  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[])
      .map((row) => rowString(row, "id"))
      .filter(Boolean),
  };
}
