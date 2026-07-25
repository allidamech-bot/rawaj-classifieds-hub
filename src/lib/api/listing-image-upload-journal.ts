import type { ClassifiedsResult } from "@/lib/classifieds-types";

const JOURNAL_STORAGE_KEY = "rawaj:listing-image-upload-journal:v1";

export interface ListingImageOrphanCleanupResult {
  removed: number;
  referenced: number;
  pending: number;
}

/**
 * R2 upload and D1 metadata creation are owned by the Worker now. These
 * compatibility functions only remove the obsolete browser journal; they never
 * contact storage or a database from the frontend.
 */
export function rememberPendingListingImageUpload(): void {
  clearRetiredJournal();
}

export function releasePendingListingImageUpload(): void {
  clearRetiredJournal();
}

export function clearPendingListingImageUpload(): void {
  clearRetiredJournal();
}

export async function cleanupPendingListingImageUploads(): Promise<
  ClassifiedsResult<ListingImageOrphanCleanupResult>
> {
  clearRetiredJournal();
  return { ok: true, data: { removed: 0, referenced: 0, pending: 0 } };
}

function clearRetiredJournal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(JOURNAL_STORAGE_KEY);
  } catch {
    // Browser storage is optional; Worker-side cleanup remains authoritative.
  }
}
