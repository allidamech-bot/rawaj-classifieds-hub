import {
  createSavedSearch as baseCreateSavedSearch,
  deleteSavedSearch as baseDeleteSavedSearch,
  fetchSavedSearches,
  recordSavedSearchAlertMatch,
  touchSavedSearchAlertChecked,
  updateSavedSearchAlertFrequency as baseUpdateSavedSearchAlertFrequency,
} from "@/lib/api/saved-searches";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

const pendingSavedSearchWrites = new Map<string, Promise<unknown>>();

export function createSavedSearch(
  userId: Parameters<typeof baseCreateSavedSearch>[0],
  payload: Parameters<typeof baseCreateSavedSearch>[1],
) {
  const key = JSON.stringify([
    userId ?? "anonymous",
    payload.nameAr.trim(),
    payload.filters,
    payload.alertFrequency ?? "weekly",
  ]);
  return runDeduplicatedRequest(key, pendingSavedSearchWrites, () =>
    baseCreateSavedSearch(userId, payload),
  ) as ReturnType<typeof baseCreateSavedSearch>;
}

export function updateSavedSearchAlertFrequency(
  userId: Parameters<typeof baseUpdateSavedSearchAlertFrequency>[0],
  savedSearchId: string,
  frequency: Parameters<typeof baseUpdateSavedSearchAlertFrequency>[2],
) {
  const cleanId = savedSearchId.trim();
  return runDeduplicatedRequest(
    JSON.stringify([userId ?? "anonymous", cleanId, frequency]),
    pendingSavedSearchWrites,
    () => baseUpdateSavedSearchAlertFrequency(userId, cleanId, frequency),
  ) as ReturnType<typeof baseUpdateSavedSearchAlertFrequency>;
}

export function deleteSavedSearch(
  userId: Parameters<typeof baseDeleteSavedSearch>[0],
  savedSearchId: string,
) {
  const cleanId = savedSearchId.trim();
  return runDeduplicatedRequest(
    JSON.stringify([userId ?? "anonymous", cleanId, "delete"]),
    pendingSavedSearchWrites,
    () => baseDeleteSavedSearch(userId, cleanId),
  ) as ReturnType<typeof baseDeleteSavedSearch>;
}

export {
  fetchSavedSearches,
  recordSavedSearchAlertMatch,
  touchSavedSearchAlertChecked,
};
