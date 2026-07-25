import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateSavedSearchPayload,
  SavedSearch,
  SavedSearchAlertFrequency,
} from "@/lib/classifieds-types";
import { normalizeSavedSearchFilters } from "@/lib/saved-search-normalization";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export async function fetchSavedSearches(
  userId: string | null,
): Promise<ClassifiedsResult<SavedSearch[]>> {
  if (!userId) return authRequired("يجب تسجيل الدخول لعرض عمليات البحث المحفوظة.");
  const result = await cloudflareApiRequest<SavedSearch[]>("/v1/account/saved-searches");
  return result.ok ? { ok: true, data: result.data } : apiFailure(result);
}

export async function createSavedSearch(
  userId: string | null,
  payload: CreateSavedSearchPayload,
): Promise<ClassifiedsResult<SavedSearch>> {
  if (!userId) return authRequired("يجب تسجيل الدخول لحفظ البحث.");
  const nameAr = payload.nameAr.trim();
  if (!nameAr) return validation("أدخل اسماً واضحاً للبحث المحفوظ.");

  const result = await cloudflareApiRequest<SavedSearch>("/v1/account/saved-searches", {
    method: "POST",
    body: {
      nameAr,
      filters: normalizeSavedSearchFilters(payload.filters),
      alertFrequency: payload.alertFrequency ?? "weekly",
    },
  });
  return result.ok ? { ok: true, data: result.data } : apiFailure(result);
}

export async function updateSavedSearchAlertFrequency(
  userId: string | null,
  savedSearchId: string,
  frequency: SavedSearchAlertFrequency,
): Promise<ClassifiedsResult<SavedSearch>> {
  if (!userId) return authRequired("يجب تسجيل الدخول لتحديث تنبيه البحث.");
  const cleanId = savedSearchId.trim();
  if (!cleanId) return validation("تعذر تحديد البحث المحفوظ.");

  const result = await cloudflareApiRequest<SavedSearch>(
    `/v1/account/saved-searches/${encodeURIComponent(cleanId)}`,
    { method: "PATCH", body: { alertFrequency: frequency } },
  );
  return result.ok ? { ok: true, data: result.data } : apiFailure(result);
}

export async function deleteSavedSearch(
  userId: string | null,
  savedSearchId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) return authRequired("يجب تسجيل الدخول لحذف البحث المحفوظ.");
  const cleanId = savedSearchId.trim();
  if (!cleanId) return validation("تعذر تحديد البحث المحفوظ.");

  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/account/saved-searches/${encodeURIComponent(cleanId)}`,
    { method: "DELETE" },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

/**
 * Background matching is now a Worker responsibility. These compatibility
 * exports fail closed so browser code can never recreate database-side alert
 * writes or silently target a retired provider.
 */
export async function recordSavedSearchAlertMatch(
  _retiredClient: unknown,
  _savedSearchId: string,
  _listingId: string,
): Promise<ClassifiedsResult<boolean>> {
  return workerOwnedAlertFailure();
}

export async function touchSavedSearchAlertChecked(
  _retiredClient: unknown,
  _savedSearchId: string,
  _checkedAt: string,
): Promise<ClassifiedsResult<boolean>> {
  return workerOwnedAlertFailure();
}

function workerOwnedAlertFailure(): ClassifiedsResult<boolean> {
  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "معالجة تنبيهات البحث تتم من خدمة رَوَاج الخلفية.",
      operation: "saved_search_alert_worker_only",
    },
  };
}

function apiFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}

function authRequired<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "auth_required", message } };
}

function validation<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}
