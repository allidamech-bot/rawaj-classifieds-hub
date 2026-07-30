import { useSyncExternalStore } from "react";

const STORAGE_KEY = "rawaj:listing-history:v1";
const HISTORY_EVENT = "rawaj:listing-history-change";
const MAX_LISTING_HISTORY = 50;

export interface LocalListingHistoryEntry {
  listingId: string;
  viewedAt: string;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readLocalListingHistory(): LocalListingHistoryEntry[] {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((value): LocalListingHistoryEntry[] => {
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        const listingId = typeof row.listingId === "string" ? row.listingId.trim() : "";
        const viewedAt = typeof row.viewedAt === "string" ? row.viewedAt : "";
        if (!listingId || Number.isNaN(Date.parse(viewedAt))) return [];
        return [{ listingId, viewedAt }];
      })
      .slice(0, MAX_LISTING_HISTORY);
  } catch {
    return [];
  }
}

function writeLocalListingHistory(entries: LocalListingHistoryEntry[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LISTING_HISTORY)));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // Cards and listing details remain usable when storage is blocked.
  }
}

export function recordLocalListingView(listingId: string): void {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return;
  const current = readLocalListingHistory();
  writeLocalListingHistory([
    { listingId: cleanListingId, viewedAt: new Date().toISOString() },
    ...current.filter((entry) => entry.listingId !== cleanListingId),
  ]);
}

export function clearLocalListingHistory(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // Nothing else is required when storage cleanup is unavailable.
  }
}

export function findLocalListingView(listingId: string): LocalListingHistoryEntry | null {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return null;
  return readLocalListingHistory().find((entry) => entry.listingId === cleanListingId) ?? null;
}

function subscribeToListingHistory(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener(HISTORY_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(HISTORY_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useIsListingViewed(listingId: string): boolean {
  return useSyncExternalStore(
    subscribeToListingHistory,
    () => Boolean(findLocalListingView(listingId)),
    () => false,
  );
}
