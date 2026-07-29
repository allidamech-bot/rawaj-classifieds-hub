import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { fetchLocationPath } from "@/lib/api/location-taxonomy";
import { fetchCloudflareReferences } from "@/lib/public-data/cloudflare-client";

export interface ListingLocationWrite {
  locationNodeId: string | null | undefined;
  governorateId: string;
  districtAr: string | null;
}

/**
 * Compatibility signature retained for legacy callers. Canonical location resolution
 * is now handled through the Cloudflare public location tree and D1 references.
 */
export async function resolveListingLocationWrite(
  _retiredClient: unknown,
  governorateId: string,
  districtValue: string | null | undefined,
): Promise<ClassifiedsResult<ListingLocationWrite>> {
  const value = districtValue?.trim() ?? "";
  if (!value.startsWith("@")) {
    if (value && !governorateId) {
      return validation("اختر المحافظة قبل تحديد المنطقة.");
    }
    return {
      ok: true,
      data: {
        locationNodeId: value ? null : undefined,
        governorateId,
        districtAr: value || null,
      },
    };
  }

  const nodeId = value.slice(1).trim();
  if (!nodeId) return validation("الموقع المحدد غير صالح.");
  const pathResult = await fetchLocationPath(nodeId);
  if (!pathResult.ok || pathResult.data.length === 0) {
    return pathResult.ok ? validation("الموقع المحدد غير صالح أو لم يعد متاحًا.") : pathResult;
  }

  const selected = pathResult.data.at(-1)!;
  const canonicalGovernorate = [...pathResult.data]
    .reverse()
    .find((node) => node.nodeType === "governorate");
  const directLegacyId =
    selected.legacyGovernorateId ?? canonicalGovernorate?.legacyGovernorateId ?? null;
  const mappedGovernorate = directLegacyId || (await matchLegacyGovernorate(canonicalGovernorate));

  if (governorateId && mappedGovernorate && governorateId !== mappedGovernorate) {
    return validation("الموقع المحدد لا يتبع المحافظة المختارة.");
  }
  const effectiveGovernorateId = mappedGovernorate || governorateId;
  if (!effectiveGovernorateId) return validation("تعذر تحديد محافظة الموقع المختار.");

  return {
    ok: true,
    data: {
      locationNodeId: selected.id,
      governorateId: effectiveGovernorateId,
      districtAr: selected.legacyDistrictAr || selected.nameAr,
    },
  };
}

async function matchLegacyGovernorate(
  governorate: { slug: string; nameAr: string; nameEn: string | null } | undefined,
): Promise<string | null> {
  if (!governorate) return null;
  const references = await fetchCloudflareReferences();
  if (!references.ok) return null;
  const wanted = new Set(
    [governorate.slug, governorate.nameAr, governorate.nameEn]
      .map(normalizeLocationKey)
      .filter(Boolean),
  );
  const match = references.data.governorates.find((candidate) =>
    [candidate.id, candidate.slug, candidate.nameAr]
      .map(normalizeLocationKey)
      .some((value) => value && wanted.has(value)),
  );
  return match?.id ?? null;
}

function validation<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}

function normalizeLocationKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}
