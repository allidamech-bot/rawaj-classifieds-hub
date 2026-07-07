import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { mapError, rowNullableString, rowString } from "@/lib/api/shared";

export interface ListingLocationWrite {
  locationNodeId: string | null | undefined;
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
        districtAr: value || null,
      },
    };
  }

  const nodeId = value.slice(1);
  const { data, error } = await client
    .from("location_nodes")
    .select("id,legacy_governorate_id,legacy_district_ar")
    .eq("id", nodeId)
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
  const legacyGovernorateId = rowNullableString(row, "legacy_governorate_id");
  if (legacyGovernorateId && legacyGovernorateId !== governorateId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "الموقع المحدد لا يتبع المحافظة المختارة." },
    };
  }

  return {
    ok: true,
    data: {
      locationNodeId: rowString(row, "id"),
      districtAr: rowNullableString(row, "legacy_district_ar"),
    },
  };
}
