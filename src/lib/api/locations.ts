import type { ClassifiedsResult } from "@/lib/classifieds-types";
import type { LocationNode } from "@/lib/location-types";
import {
  getClient,
  mapError,
  rowArray,
  rowBoolean,
  rowNullableNumber,
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
} from "@/lib/public-data/cloudflare-client";

export function mapLocationNode(row: Record<string, unknown>): LocationNode {
  return {
    id: rowString(row, "id"),
    parentId: rowNullableString(row, "parent_id"),
    countryCode: rowString(row, "country_code", "SY"),
    nodeType: rowString(row, "node_type", "locality") as LocationNode["nodeType"],
    nameAr: rowString(row, "name_ar"),
    nameEn: rowNullableString(row, "name_en"),
    slug: rowString(row, "slug"),
    officialCode: rowNullableString(row, "official_code"),
    externalSource: rowNullableString(row, "external_source"),
    externalId: rowNullableString(row, "external_id"),
    latitude: rowNullableNumber(row, "latitude"),
    longitude: rowNullableNumber(row, "longitude"),
    sortOrder: rowNumber(row, "sort_order"),
    depth: rowNumber(row, "depth"),
    isActive: rowBoolean(row, "is_active", true),
    searchAliases: rowArray(row, "search_aliases"),
    legacyGovernorateId: rowNullableString(row, "legacy_governorate_id"),
    legacyDistrictAr: rowNullableString(row, "legacy_district_ar"),
  };
}

export async function fetchPublicLocationNodes(
  countryCode = "SY",
): Promise<ClassifiedsResult<LocationNode[]>> {
  if (isCloudflarePublicDataProvider()) {
    return fetchCloudflareLocationRoots(countryCode);
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data
    .from("location_nodes")
    .select("*")
    .eq("country_code", countryCode)
    .eq("is_active", true)
    .order("depth", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name_ar", { ascending: true });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapLocationNode) };
}

export async function fetchLocationChildren(
  parentId: string | null,
  countryCode = "SY",
): Promise<ClassifiedsResult<LocationNode[]>> {
  if (isCloudflarePublicDataProvider()) {
    return parentId
      ? fetchCloudflareLocationChildren(parentId)
      : fetchCloudflareLocationRoots(countryCode);
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  let query = clientResult.data
    .from("location_nodes")
    .select("*")
    .eq("country_code", countryCode)
    .eq("is_active", true);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("name_ar", { ascending: true });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapLocationNode) };
}

export async function fetchLocationNode(id: string): Promise<ClassifiedsResult<LocationNode>> {
  if (isCloudflarePublicDataProvider()) {
    const result = await fetchCloudflareLocationPath(id);
    if (!result.ok) return result;
    const node = result.data.at(-1);
    return node
      ? { ok: true, data: node }
      : { ok: false, error: { code: "not_found", message: "الموقع المحدد غير متاح." } };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data
    .from("location_nodes")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error) };
  if (!data) return { ok: false, error: { code: "not_found", message: "الموقع المحدد غير متاح." } };
  return { ok: true, data: mapLocationNode(data as Record<string, unknown>) };
}

export async function fetchLocationDescendantIds(
  rootId: string,
): Promise<ClassifiedsResult<string[]>> {
  if (isCloudflarePublicDataProvider()) return fetchCloudflareLocationDescendantIds(rootId);
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_location_descendant_ids", {
    root_id: rootId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[])
      .map((row) => rowString(row, "id"))
      .filter(Boolean),
  };
}
