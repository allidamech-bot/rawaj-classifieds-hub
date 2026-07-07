import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import {
  getClient,
  mapError,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";

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
  depth: number;
  isActive: boolean;
  legacyGovernorateId: string | null;
  legacyDistrictAr: string | null;
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
    depth: rowNumber(row, "depth"),
    isActive: rowBoolean(row, "is_active", true),
    legacyGovernorateId: rowNullableString(row, "legacy_governorate_id"),
    legacyDistrictAr: rowNullableString(row, "legacy_district_ar"),
  };
}

const LOCATION_NODE_SELECT =
  "id,parent_id,country_code,node_type,name_ar,name_en,slug,depth,is_active,legacy_governorate_id,legacy_district_ar";

export async function fetchLocationRoots(
  countryCode = "SY",
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
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
    data: ((data ?? []) as Record<string, unknown>[]).map(mapLocationNode),
  };
}

export async function fetchLocationChildren(
  parentId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
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
    data: ((data ?? []) as Record<string, unknown>[]).map(mapLocationNode),
  };
}

export async function fetchLocationNode(
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode | null>> {
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

export async function fetchLocationPath(
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  return fetchLocationPathWithClient(clientResult.data, nodeId);
}

async function fetchLocationPathWithClient(
  client: SupabaseClient,
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationNode[]>> {
  const { data, error } = await client.rpc("rawaj_location_path", { node_id: nodeId });
  if (error) return { ok: false, error: mapError(error) };

  const path = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: rowString(row, "id"),
    parentId: rowNullableString(row, "parent_id"),
    countryCode: "SY",
    nodeType: rowString(row, "node_type", "locality") as LocationNodeType,
    nameAr: rowString(row, "name_ar"),
    nameEn: rowNullableString(row, "name_en"),
    slug: rowString(row, "slug"),
    depth: rowNumber(row, "depth"),
    isActive: true,
    legacyGovernorateId: null,
    legacyDistrictAr: null,
  }));

  return { ok: true, data: path };
}

export async function resolveLocationDescendantIds(
  nodeId: string,
): Promise<ClassifiedsResult<string[]>> {
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
