import { useSyncExternalStore } from "react";

const STORAGE_KEY = "rawaj:listing-history:v1";
const HISTORY_EVENT = "rawaj:listing-history-change";
const MAX_LISTING_HISTORY = 50;

export interface LocalListingHistoryEntry {
  listingId: string;
  viewedAt: string;
}

const listingHistorySubscribers = new Set<() => void>();
let cachedHistory: readonly LocalListingHistoryEntry[] = [];
let cachedHistoryById = new Map<string, LocalListingHistoryEntry>();
let cachedStorageValue: string | null | undefined;
let listeningWindow: Window | null = null;

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseListingHistory(serialized: string | null): LocalListingHistoryEntry[] {
  try {
    const parsed = JSON.parse(serialized ?? "[]") as unknown;
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

function replaceCachedHistory(
  entries: readonly LocalListingHistoryEntry[],
  serialized: string | null,
): void {
  cachedHistory = entries.slice(0, MAX_LISTING_HISTORY);
  cachedHistoryById = new Map(cachedHistory.map((entry) => [entry.listingId, entry]));
  cachedStorageValue = serialized;
}

function refreshCacheFromSerialized(serialized: string | null): boolean {
  if (cachedStorageValue !== undefined && serialized === cachedStorageValue) return false;
  replaceCachedHistory(parseListingHistory(serialized), serialized);
  return true;
}

function refreshCacheFromStorage(): boolean {
  const storage = getBrowserStorage();
  if (!storage) {
    if (cachedStorageValue === undefined) replaceCachedHistory([], null);
    return false;
  }
  try {
    return refreshCacheFromSerialized(storage.getItem(STORAGE_KEY));
  } catch {
    if (cachedStorageValue === undefined) replaceCachedHistory([], null);
    return false;
  }
}

function ensureHistoryCache(): void {
  if (cachedStorageValue === undefined && typeof window !== "undefined") {
    refreshCacheFromStorage();
  }
}

function notifyListingHistorySubscribers(): void {
  listingHistorySubscribers.forEach((subscriber) => subscriber());
}

function publishLocalHistory(entries: LocalListingHistoryEntry[], clear = false): void {
  const boundedEntries = entries.slice(0, MAX_LISTING_HISTORY);
  const serialized = JSON.stringify(boundedEntries);
  const storage = getBrowserStorage();
  let storageUpdated = false;

  if (storage) {
    try {
      if (clear) storage.removeItem(STORAGE_KEY);
      else storage.setItem(STORAGE_KEY, serialized);
      storageUpdated = true;
    } catch {
      // Keep the in-memory session useful when browser storage is blocked.
    }
  }

  replaceCachedHistory(boundedEntries, clear && storageUpdated ? null : serialized);
  notifyListingHistorySubscribers();

  if (storageUpdated && typeof window !== "undefined") {
    window.dispatchEvent(new Event(HISTORY_EVENT));
  }
}

function handleListingHistoryStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  if (refreshCacheFromSerialized(event.newValue)) notifyListingHistorySubscribers();
}

function handleListingHistoryEvent(): void {
  if (refreshCacheFromStorage()) notifyListingHistorySubscribers();
}

function installBrowserListeners(): void {
  if (typeof window === "undefined" || listeningWindow === window) return;
  listeningWindow = window;
  window.addEventListener("storage", handleListingHistoryStorage);
  window.addEventListener(HISTORY_EVENT, handleListingHistoryEvent);
}

function removeBrowserListeners(): void {
  if (!listeningWindow) return;
  listeningWindow.removeEventListener("storage", handleListingHistoryStorage);
  listeningWindow.removeEventListener(HISTORY_EVENT, handleListingHistoryEvent);
  listeningWindow = null;
}

export function readLocalListingHistory(): LocalListingHistoryEntry[] {
  ensureHistoryCache();
  return [...cachedHistory];
}

export function recordLocalListingView(listingId: string): void {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return;
  ensureHistoryCache();
  publishLocalHistory([
    { listingId: cleanListingId, viewedAt: new Date().toISOString() },
    ...cachedHistory.filter((entry) => entry.listingId !== cleanListingId),
  ]);
}

export function clearLocalListingHistory(): void {
  publishLocalHistory([], true);
}

export function findLocalListingView(listingId: string): LocalListingHistoryEntry | null {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return null;
  ensureHistoryCache();
  return cachedHistoryById.get(cleanListingId) ?? null;
}

export function subscribeToListingHistory(onStoreChange: () => void): () => void {
  listingHistorySubscribers.add(onStoreChange);
  if (listingHistorySubscribers.size === 1) {
    refreshCacheFromStorage();
    installBrowserListeners();
  }

  return () => {
    listingHistorySubscribers.delete(onStoreChange);
    if (listingHistorySubscribers.size === 0) removeBrowserListeners();
  };
}

export function getListingViewedSnapshot(listingId: string): boolean {
  return Boolean(findLocalListingView(listingId));
}

export function useIsListingViewed(listingId: string): boolean {
  return useSyncExternalStore(
    subscribeToListingHistory,
    () => getListingViewedSnapshot(listingId),
    () => false,
  );
}
