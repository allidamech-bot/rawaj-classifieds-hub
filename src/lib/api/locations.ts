import type { ClassifiedsResult } from "@/lib/classifieds-types";
import type { LocationNode } from "@/lib/location-types";
import {
  fetchCloudflareLocationChildren,
  fetchCloudflareLocationDescendantIds,
  fetchCloudflareLocationPath,
  fetchCloudflareLocationRoots,
} from "@/lib/public-data/cloudflare-client";

export function mapLocationNode(row: Record<string, unknown>): LocationNode {
  return {
    id: text(row.id),
    parentId: nullableText(row.parentId ?? row.parent_id),
    countryCode: text(row.countryCode ?? row.country_code, "SY"),
    nodeType: text(row.nodeType ?? row.node_type, "locality") as LocationNode["nodeType"],
    nameAr: text(row.nameAr ?? row.name_ar),
    nameEn: nullableText(row.nameEn ?? row.name_en),
    slug: text(row.slug),
    officialCode: nullableText(row.officialCode ?? row.official_code),
    externalSource: nullableText(row.externalSource ?? row.external_source),
    externalId: nullableText(row.externalId ?? row.external_id),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    sortOrder: numberValue(row.sortOrder ?? row.sort_order),
    depth: numberValue(row.depth),
    isActive: booleanValue(row.isActive ?? row.is_active, true),
    searchAliases: arrayValue(row.searchAliases ?? row.search_aliases),
    legacyGovernorateId: nullableText(row.legacyGovernorateId ?? row.legacy_governorate_id),
    legacyDistrictAr: nullableText(row.legacyDistrictAr ?? row.legacy_district_ar),
  };
}

export function fetchPublicLocationNodes(
  countryCode = "SY",
): Promise<ClassifiedsResult<LocationNode[]>> {
  return fetchCloudflareLocationRoots(countryCode);
}

export function fetchLocationChildren(
  parentId: string | null,
  countryCode = "SY",
): Promise<ClassifiedsResult<LocationNode[]>> {
  return parentId
    ? fetchCloudflareLocationChildren(parentId)
    : fetchCloudflareLocationRoots(countryCode);
}

export async function fetchLocationNode(id: string): Promise<ClassifiedsResult<LocationNode>> {
  const result = await fetchCloudflareLocationPath(id.trim());
  if (!result.ok) return result;
  const node = result.data.at(-1);
  return node
    ? { ok: true, data: node }
    : { ok: false, error: { code: "not_found", message: "الموقع المحدد غير متاح." } };
}

export function fetchLocationDescendantIds(rootId: string): Promise<ClassifiedsResult<string[]>> {
  return fetchCloudflareLocationDescendantIds(rootId.trim());
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function booleanValue(value: unknown, fallback = false): boolean {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return fallback;
}
function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
