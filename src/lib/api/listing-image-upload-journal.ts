import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError, mapStorageError } from "@/lib/api/shared";
import { listingImagesBucket } from "@/lib/api/storage";

const JOURNAL_STORAGE_KEY = "rawaj:listing-image-upload-journal:v1";
const DEFAULT_ORPHAN_MIN_AGE_MS = 15 * 60 * 1000;
const MAX_JOURNAL_RECORDS = 50;

interface PendingListingImageUpload {
  userId: string;
  listingId: string;
  storagePath: string;
  createdAt: number;
}

export interface ListingImageOrphanCleanupResult {
  removed: number;
  referenced: number;
  pending: number;
}

export function rememberPendingListingImageUpload(
  userId: string,
  listingId: string,
  storagePath: string,
): void {
  const storage = readJournalStorage();
  if (!storage || !isOwnedListingImagePath(userId, listingId, storagePath)) return;

  const records = readJournal(storage).filter((record) => record.storagePath !== storagePath);
  records.push({ userId, listingId, storagePath, createdAt: Date.now() });
  writeJournal(storage, records.slice(-MAX_JOURNAL_RECORDS));
}

export function clearPendingListingImageUpload(storagePath: string): void {
  const storage = readJournalStorage();
  if (!storage || !storagePath.trim()) return;
  removeJournalPaths(storage, new Set([storagePath]));
}

export async function cleanupPendingListingImageUploads(
  userId: string,
  minAgeMs = DEFAULT_ORPHAN_MIN_AGE_MS,
): Promise<ClassifiedsResult<ListingImageOrphanCleanupResult>> {
  const storage = readJournalStorage();
  if (!storage || !userId.trim()) {
    return { ok: true, data: { removed: 0, referenced: 0, pending: 0 } };
  }

  const now = Date.now();
  const records = readJournal(storage);
  const candidates = records.filter(
    (record) =>
      record.userId === userId &&
      now - record.createdAt >= Math.max(0, minAgeMs) &&
      isOwnedListingImagePath(record.userId, record.listingId, record.storagePath),
  );

  if (candidates.length === 0) {
    return {
      ok: true,
      data: {
        removed: 0,
        referenced: 0,
        pending: records.filter((record) => record.userId === userId).length,
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const candidatePaths = Array.from(new Set(candidates.map((record) => record.storagePath)));
  const { data, error } = await clientResult.data
    .from("listing_images")
    .select("storage_path")
    .in("storage_path", candidatePaths);

  if (error) {
    return { ok: false, error: mapError(error, "listing_image_orphan_lookup") };
  }

  const referencedPaths = new Set(
    ((data ?? []) as Array<{ storage_path?: unknown }>)
      .map((row) => row.storage_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0),
  );
  const orphanPaths = candidatePaths.filter((path) => !referencedPaths.has(path));
  const clearedPaths = new Set(referencedPaths);

  if (orphanPaths.length > 0) {
    const removeResult = await clientResult.data.storage
      .from(listingImagesBucket)
      .remove(orphanPaths);
    if (removeResult.error) {
      removeJournalPaths(storage, clearedPaths);
      return {
        ok: false,
        error: mapStorageError(removeResult.error),
      };
    }
    orphanPaths.forEach((path) => clearedPaths.add(path));
  }

  removeJournalPaths(storage, clearedPaths);
  const remaining = readJournal(storage).filter((record) => record.userId === userId).length;
  return {
    ok: true,
    data: {
      removed: orphanPaths.length,
      referenced: referencedPaths.size,
      pending: remaining,
    },
  };
}

function readJournalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJournal(storage: Storage): PendingListingImageUpload[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(JOURNAL_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingListingImageUpload).slice(-MAX_JOURNAL_RECORDS);
  } catch {
    return [];
  }
}

function writeJournal(storage: Storage, records: PendingListingImageUpload[]): void {
  try {
    if (records.length === 0) storage.removeItem(JOURNAL_STORAGE_KEY);
    else storage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(records.slice(-MAX_JOURNAL_RECORDS)));
  } catch {
    // Uploads remain functional when browser storage is blocked or full.
  }
}

function removeJournalPaths(storage: Storage, paths: Set<string>): void {
  if (paths.size === 0) return;
  const latest = readJournal(storage);
  writeJournal(
    storage,
    latest.filter((record) => !paths.has(record.storagePath)),
  );
}

function isPendingListingImageUpload(value: unknown): value is PendingListingImageUpload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.userId === "string" &&
    typeof record.listingId === "string" &&
    typeof record.storagePath === "string" &&
    typeof record.createdAt === "number" &&
    Number.isFinite(record.createdAt) &&
    record.createdAt > 0
  );
}

function isOwnedListingImagePath(
  userId: string,
  listingId: string,
  storagePath: string,
): boolean {
  const cleanUserId = userId.trim();
  const cleanListingId = listingId.trim();
  return (
    cleanUserId.length > 0 &&
    cleanListingId.length > 0 &&
    storagePath.startsWith(`${cleanUserId}/${cleanListingId}/`)
  );
}
