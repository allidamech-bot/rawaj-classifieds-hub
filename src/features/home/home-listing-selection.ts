import type { ClassifiedListing } from "@/lib/classifieds-types";

type HomeListingCandidate = Pick<ClassifiedListing, "id" | "categoryId">;

/**
 * Keeps the server-provided order as the source of truth while preventing the
 * first screen from being dominated by one category. The soft category limit
 * is applied in stable passes, then any remaining slots are filled in the
 * original order so sparse inventories never produce empty space.
 */
export function selectDiverseListings<T extends HomeListingCandidate>(
  listings: T[],
  limit: number,
  softCategoryLimit = 1,
): T[] {
  const targetSize = Math.min(Math.max(0, limit), listings.length);
  if (targetSize === 0) return [];

  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const stableSoftLimit = Math.max(1, Math.floor(softCategoryLimit));

  for (let threshold = 1; threshold <= stableSoftLimit && selected.length < targetSize; threshold += 1) {
    for (const listing of listings) {
      if (selected.length >= targetSize) break;
      if (selectedIds.has(listing.id)) continue;

      const categoryKey = listing.categoryId || "uncategorized";
      const currentCount = categoryCounts.get(categoryKey) ?? 0;
      if (currentCount >= threshold) continue;

      selected.push(listing);
      selectedIds.add(listing.id);
      categoryCounts.set(categoryKey, currentCount + 1);
    }
  }

  if (selected.length < targetSize) {
    for (const listing of listings) {
      if (selected.length >= targetSize) break;
      if (selectedIds.has(listing.id)) continue;
      selected.push(listing);
      selectedIds.add(listing.id);
    }
  }

  return selected;
}
