import {
  createSavedSearch as baseCreateSavedSearch,
  deleteSavedSearch as baseDeleteSavedSearch,
  fetchSavedSearches,
  recordSavedSearchAlertMatch,
  touchSavedSearchAlertChecked,
  updateSavedSearchAlertFrequency as baseUpdateSavedSearchAlertFrequency,
} from "@/lib/api/saved-searches";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

const pendingSavedSearchCreates = new Map<
  string,
  ReturnType<typeof baseCreateSavedSearch>
>();
const pendingSavedSearchFrequencyUpdates = new Map<
  string,
  ReturnType<typeof baseUpdateSavedSearchAlertFrequency>
>();
const pendingSavedSearchDeletes = new Map<
  string,
  ReturnType<typeof baseDeleteSavedSearch>
>();

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
  return runDeduplicatedRequest(key, pendingSavedSearchCreates, () =>
    baseCreateSavedSearch(userId, payload),
  );
}

export function updateSavedSearchAlertFrequency(
  userId: Parameters<typeof baseUpdateSavedSearchAlertFrequency>[0],
  savedSearchId: string,
  frequency: Parameters<typeof baseUpdateSavedSearchAlertFrequency>[2],
) {
  const cleanId = savedSearchId.trim();
  return runDeduplicatedRequest(
    JSON.stringify([userId ?? "anonymous", cleanId, frequency]),
    pendingSavedSearchFrequencyUpdates,
    () => baseUpdateSavedSearchAlertFrequency(userId, cleanId, frequency),
  );
}

export function deleteSavedSearch(
  userId: Parameters<typeof baseDeleteSavedSearch>[0],
  savedSearchId: string,
) {
  const cleanId = savedSearchId.trim();
  return runDeduplicatedRequest(
    JSON.stringify([userId ?? "anonymous", cleanId, "delete"]),
    pendingSavedSearchDeletes,
    () => baseDeleteSavedSearch(userId, cleanId),
  );
}

export { fetchSavedSearches, recordSavedSearchAlertMatch, touchSavedSearchAlertChecked };
