import {
  favoriteListing as baseFavoriteListing,
  fetchFavoriteJourneyItems,
  fetchFavoriteStatus,
  fetchFavorites,
  unfavoriteListing as baseUnfavoriteListing,
} from "@/lib/api/favorites";
import { runDeduplicatedRequest } from "@/lib/api/request-dedup";

export type {
  FavoriteJourneyAvailability,
  FavoriteJourneyItem,
  FavoriteListingSnapshot,
} from "@/lib/api/favorites";

const pendingFavoriteWrites = new Map<string, ReturnType<typeof baseFavoriteListing>>();

export function favoriteListing(userId: string | null, listingId: string) {
  const cleanListingId = listingId.trim();
  return runDeduplicatedRequest(
    JSON.stringify([userId ?? "anonymous", cleanListingId, true]),
    pendingFavoriteWrites,
    () => baseFavoriteListing(userId, cleanListingId),
  );
}

export function unfavoriteListing(userId: string | null, listingId: string) {
  const cleanListingId = listingId.trim();
  return runDeduplicatedRequest(
    JSON.stringify([userId ?? "anonymous", cleanListingId, false]),
    pendingFavoriteWrites,
    () => baseUnfavoriteListing(userId, cleanListingId),
  );
}

export { fetchFavoriteJourneyItems, fetchFavoriteStatus, fetchFavorites };
