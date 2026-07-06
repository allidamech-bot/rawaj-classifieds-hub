import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  CreateSavedSearchPayload,
  SavedSearch,
} from "@/lib/classifieds-types";
import { getClient, mapError, rowRecord, rowString } from "@/lib/api/shared";

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
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: rowString(row, "id"),
      userId: rowString(row, "user_id"),
      nameAr: rowString(row, "name_ar"),
      filters: rowRecord(row, "filters"),
      createdAt: rowString(row, "created_at"),
      updatedAt: rowString(row, "updated_at"),
    })),
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
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: {
      id: rowString(data as Record<string, unknown>, "id"),
      userId: rowString(data as Record<string, unknown>, "user_id"),
      nameAr: rowString(data as Record<string, unknown>, "name_ar"),
      filters: rowRecord(data as Record<string, unknown>, "filters"),
      createdAt: rowString(data as Record<string, unknown>, "created_at"),
      updatedAt: rowString(data as Record<string, unknown>, "updated_at"),
    },
  };
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

  const { error } = await clientResult.data
    .from("saved_searches")
    .delete()
    .eq("id", savedSearchId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}
