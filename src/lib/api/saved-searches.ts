import type { SupabaseClient } from "@supabase/supabase-js";
import { getClient, mapError, rowRecord, rowString } from "@/lib/api/shared";
import type {
  ClassifiedsResult,
  CreateSavedSearchPayload,
  SavedSearch,
  SavedSearchAlertFrequency,
} from "@/lib/classifieds-types";
import { normalizeSavedSearchFilters } from "@/lib/saved-search-normalization";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

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
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<SavedSearch[]>("/v1/account/saved-searches");
    return result.ok
      ? { ok: true, data: result.data }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("saved_searches")
    .select(
      "id, user_id, name_ar, filters, alert_frequency, last_alert_checked_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

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
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<SavedSearch>("/v1/account/saved-searches", {
      method: "POST",
      body: {
        nameAr,
        filters: normalizeSavedSearchFilters(payload.filters),
        alertFrequency: payload.alertFrequency ?? "weekly",
      },
    });
    return result.ok
      ? { ok: true, data: result.data }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const filters = normalizeSavedSearchFilters(payload.filters);

  const { data, error } = await clientResult.data.rpc("rawaj_create_my_saved_search_v2", {
    p_name_ar: nameAr,
    p_filters: filters,
    p_alert_frequency: payload.alertFrequency ?? "weekly",
  });

  if (error) return { ok: false, error: mapError(error, "create_saved_search") };
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر إنشاء البحث المحفوظ." },
    };
  }

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
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<SavedSearch>(
      `/v1/account/saved-searches/${encodeURIComponent(cleanId)}`,
      { method: "PATCH", body: { alertFrequency: frequency } },
    );
    return result.ok
      ? { ok: true, data: result.data }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_update_my_saved_search_frequency_v2", {
    p_saved_search_id: cleanId,
    p_alert_frequency: frequency,
  });

  if (error) return { ok: false, error: mapError(error, "update_saved_search") };
  if (!data || typeof data !== "object") {
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

  const cleanId = savedSearchId.trim();
  if (!cleanId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البحث المحفوظ." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ success: boolean }>(
      `/v1/account/saved-searches/${encodeURIComponent(cleanId)}`,
      { method: "DELETE" },
    );
    return result.ok
      ? { ok: true, data: null }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_delete_my_saved_search_v2", {
    p_saved_search_id: cleanId,
  });

  if (error) return { ok: false, error: mapError(error, "delete_saved_search") };
  if (data !== true) {
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
