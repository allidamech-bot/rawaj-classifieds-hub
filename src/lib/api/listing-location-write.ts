import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { mapError, rowNullableString, rowString } from "@/lib/api/shared";

export interface ListingLocationWrite {
  locationNodeId: string | null | undefined;
  governorateId: string;
  districtAr: string | null;
}

interface CanonicalLocationContext {
  id: string;
  governorateId: string | null;
  governorateNameAr: string | null;
  governorateNameEn: string | null;
  governorateSlug: string | null;
  districtAr: string | null;
}

export async function resolveListingLocationWrite(
  client: SupabaseClient,
  governorateId: string,
  districtValue: string | null | undefined,
): Promise<ClassifiedsResult<ListingLocationWrite>> {
  const value = districtValue?.trim() ?? "";
  if (!value.startsWith("@")) {
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
  if (!nodeId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "الموقع المحدد غير صالح." },
    };
  }

  const resolved = await resolveCanonicalLocationContext(client, nodeId);
  if (!resolved.ok) return resolved;

  const mappedGovernorate = await resolveLegacyGovernorateId(client, resolved.data);
  if (!mappedGovernorate.ok) return mappedGovernorate;

  const canonicalGovernorateId = mappedGovernorate.data;
  if (governorateId && canonicalGovernorateId && canonicalGovernorateId !== governorateId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "الموقع المحدد لا يتبع المحافظة المختارة." },
    };
  }

  const effectiveGovernorateId = canonicalGovernorateId || governorateId;
  if (!effectiveGovernorateId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد محافظة الموقع المختار." },
    };
  }

  return {
    ok: true,
    data: {
      locationNodeId: resolved.data.id,
      governorateId: effectiveGovernorateId,
      districtAr: resolved.data.districtAr,
    },
  };
}

async function resolveCanonicalLocationContext(
  client: SupabaseClient,
  nodeId: string,
): Promise<ClassifiedsResult<CanonicalLocationContext>> {
  let currentId: string | null = nodeId;
  let selectedId = "";
  let governorateId: string | null = null;
  let governorateNameAr: string | null = null;
  let governorateNameEn: string | null = null;
  let governorateSlug: string | null = null;
  let districtAr: string | null = null;
  const visited = new Set<string>();

  for (let depth = 0; currentId && depth < 16; depth += 1) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const { data, error } = await client
      .from("location_nodes")
      .select(
        "id,parent_id,node_type,name_ar,name_en,slug,legacy_governorate_id,legacy_district_ar",
      )
      .eq("id", currentId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return { ok: false, error: mapError(error) };
    if (!data) {
      return {
        ok: false,
        error: { code: "validation_error", message: "الموقع المحدد غير صالح أو لم يعد متاحًا." },
      };
    }

    const row = data as Record<string, unknown>;
    if (!selectedId) selectedId = rowString(row, "id");
    governorateId ||= rowNullableString(row, "legacy_governorate_id");
    districtAr ||= rowNullableString(row, "legacy_district_ar");

    if (rowString(row, "node_type") === "governorate") {
      governorateNameAr ||= rowNullableString(row, "name_ar");
      governorateNameEn ||= rowNullableString(row, "name_en");
      governorateSlug ||= rowNullableString(row, "slug");
    }

    currentId = rowNullableString(row, "parent_id");
  }

  return {
    ok: true,
    data: {
      id: selectedId || nodeId,
      governorateId,
      governorateNameAr,
      governorateNameEn,
      governorateSlug,
      districtAr,
    },
  };
}

async function resolveLegacyGovernorateId(
  client: SupabaseClient,
  context: CanonicalLocationContext,
): Promise<ClassifiedsResult<string | null>> {
  if (context.governorateId) return { ok: true, data: context.governorateId };

  const { data, error } = await client
    .from("governorates")
    .select("id,slug,name_ar,name_en")
    .eq("is_active", true);
  if (error) return { ok: false, error: mapError(error) };

  const candidates = (data ?? []) as Record<string, unknown>[];
  const wanted = new Set(
    [context.governorateSlug, context.governorateNameAr, context.governorateNameEn]
      .map(normalizeLocationKey)
      .filter(Boolean),
  );

  if (wanted.size === 0) return { ok: true, data: null };

  const match = candidates.find((row) =>
    [rowString(row, "id"), rowString(row, "slug"), rowString(row, "name_ar"), rowString(row, "name_en")]
      .map(normalizeLocationKey)
      .some((value) => value && wanted.has(value)),
  );

  return { ok: true, data: match ? rowString(match, "id") : null };
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
