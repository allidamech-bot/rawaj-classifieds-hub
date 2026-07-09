import type { SupabaseClient } from "@supabase/supabase-js";
import { getClient, mapError, rowRecord, rowString } from "@/lib/api/shared";
import type {
  ClassifiedsResult,
  CreateSavedSearchPayload,
  SavedSearch,
  SavedSearchAlertFrequency,
} from "@/lib/classifieds-types";

function mapSavedSearch(row: Record<string, unknown>): SavedSearch {
  const frequency = rowString(row, "alert_frequency", "weekly");
  return {
    id: rowString(row, "id"),
    userId: rowString(row, "user_id"),
    nameAr: rowString(row, "name_ar"),
    filters: rowRecord(row, "filters"),
    alertFrequency: frequency === "daily" || frequency === "off" ? frequency : "weekly",
    lastAlertCheckedAt:
      typeof row.last_alert_checked_at === "string" ? row.last_alert_checked_at : null,
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

export async function fetchSavedSearches(
  userId: string | null,
): Promise<ClassifiedsResult<SavedSearch[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض عمليات البحث المحفوظة." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapSavedSearch),
  };
}

export async function createSavedSearch(
  userId: string | null,
  payload: CreateSavedSearchPayload,
): Promise<ClassifiedsResult<SavedSearch>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ البحث." },
    };
  }

  const nameAr = payload.nameAr.trim();
  if (!nameAr) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل اسماً واضحاً للبحث المحفوظ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("saved_searches")
    .insert({
      user_id: userId,
      name_ar: nameAr,
      filters: payload.filters,
      alert_frequency: payload.alertFrequency ?? "weekly",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapSavedSearch(data as Record<string, unknown>) };
}

export async function updateSavedSearchAlertFrequency(
  userId: string | null,
  savedSearchId: string,
  frequency: SavedSearchAlertFrequency,
): Promise<ClassifiedsResult<SavedSearch>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث تنبيه البحث." },
    };
  }

  const cleanId = savedSearchId.trim();
  if (!cleanId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البحث المحفوظ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("saved_searches")
    .update({ alert_frequency: frequency })
    .eq("id", cleanId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "لم يعد البحث المحفوظ متاحاً." },
    };
  }
  return { ok: true, data: mapSavedSearch(data as Record<string, unknown>) };
}

export async function deleteSavedSearch(
  userId: string | null,
  savedSearchId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحذف البحث المحفوظ." },
    };
  }

  if (!savedSearchId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البحث المحفوظ." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("saved_searches")
    .delete()
    .eq("id", savedSearchId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: false,
      error: { code: "not_found", message: "لم يعد البحث المحفوظ متاحاً." },
    };
  }
  return { ok: true, data: null };
}

export async function recordSavedSearchAlertMatch(
  client: SupabaseClient,
  savedSearchId: string,
  listingId: string,
): Promise<ClassifiedsResult<boolean>> {
  const { data, error } = await client.rpc("rawaj_record_saved_search_alert_match", {
    p_saved_search_id: savedSearchId,
    p_listing_id: listingId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: data === true };
}

export async function touchSavedSearchAlertChecked(
  client: SupabaseClient,
  savedSearchId: string,
  checkedAt: string,
): Promise<ClassifiedsResult<boolean>> {
  const { data, error } = await client.rpc("rawaj_touch_saved_search_alert_checked", {
    p_saved_search_id: savedSearchId,
    p_checked_at: checkedAt,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: data === true };
}
