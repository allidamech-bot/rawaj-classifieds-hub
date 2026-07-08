import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { mapError, rowNullableString, rowString } from "@/lib/api/shared";

export interface ListingLocationWrite {
  locationNodeId: string | null | undefined;
  governorateId: string;
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

  const nodeId = value.slice(1);
  const resolved = await resolveCanonicalLocationContext(client, nodeId);
  if (!resolved.ok) return resolved;

  const canonicalGovernorateId = resolved.data.governorateId;
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
): Promise<ClassifiedsResult<{ id: string; governorateId: string | null; districtAr: string | null }>> {
  let currentId: string | null = nodeId;
  let selectedId = "";
  let governorateId: string | null = null;
  let districtAr: string | null = null;
  const visited = new Set<string>();

  for (let depth = 0; currentId && depth < 16; depth += 1) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const { data, error } = await client
      .from("location_nodes")
      .select("id,parent_id,legacy_governorate_id,legacy_district_ar")
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
    currentId = rowNullableString(row, "parent_id");
  }

  return {
    ok: true,
    data: { id: selectedId || nodeId, governorateId, districtAr },
  };
}
