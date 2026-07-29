import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  Favorite,
} from "@/lib/classifieds-types";
import { mapListing } from "@/lib/api/listings";
import { rowNullableNumber, rowString } from "@/lib/api/shared";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export type FavoriteJourneyAvailability = "available" | "unavailable";

export interface FavoriteListingSnapshot {
  userId: string;
  listingId: string;
  title: string;
  price: number | null;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteJourneyItem {
  listingId: string;
  availability: FavoriteJourneyAvailability;
  snapshot: FavoriteListingSnapshot;
  listing?: ClassifiedListing;
}

export async function fetchFavoriteStatus(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<boolean>> {
  if (!userId) return authRequired("يجب تسجيل الدخول.");
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return validation("تعذر تحديد الإعلان.");

  const result = await cloudflareApiRequest<{ favorited: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/favorite`,
  );
  return result.ok ? { ok: true, data: result.data.favorited } : apiFailure(result);
}

export async function fetchFavorites(
  userId: string | null,
): Promise<ClassifiedsResult<Favorite[]>> {
  if (!userId) return authRequired("يجب تسجيل الدخول لعرض المفضلة.");

  const result = await cloudflareApiRequest<Record<string, unknown>[]>(
    "/v1/account/favorites?pageSize=100",
  );
  if (!result.ok) return apiFailure(result);

  return {
    ok: true,
    data: result.data.map((row) => ({
      userId: rowString(row, "user_id", userId),
      listingId: rowString(row, "listing_id"),
      createdAt: rowString(row, "created_at"),
      listing: mapListing({
        ...row,
        id: row.listing_id,
        created_at: row.listing_created_at,
        updated_at: row.listing_updated_at,
      }),
    })),
  };
}

export async function fetchFavoriteJourneyItems(
  userId: string | null,
): Promise<ClassifiedsResult<FavoriteJourneyItem[]>> {
  if (!userId) return authRequired("يجب تسجيل الدخول لعرض المفضلة.");
  const favorites = await fetchFavorites(userId);
  if (!favorites.ok) return favorites;

  return {
    ok: true,
    data: favorites.data.map((favorite) => {
      const listing = favorite.listing;
      const snapshot: FavoriteListingSnapshot = {
        userId: favorite.userId,
        listingId: favorite.listingId,
        title: listing?.title ?? "إعلان غير متاح",
        price: listing?.price ?? null,
        currency: listing?.currency ?? "SYP",
        status: listing?.status ?? "approved",
        createdAt: favorite.createdAt,
        updatedAt: listing?.updatedAt ?? favorite.createdAt,
      };
      return {
        listingId: favorite.listingId,
        availability: listing ? "available" : "unavailable",
        snapshot,
        listing,
      };
    }),
  };
}

export async function favoriteListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  return setFavorite(userId, listingId, true);
}

export async function unfavoriteListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  return setFavorite(userId, listingId, false);
}

async function setFavorite(
  userId: string | null,
  listingId: string,
  favorited: boolean,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return authRequired(
      favorited ? "يجب تسجيل الدخول لحفظ الإعلان." : "يجب تسجيل الدخول لتعديل المفضلة.",
    );
  }
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return validation("تعذر تحديد الإعلان المطلوب.");

  const result = await cloudflareApiRequest<{ favorited: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/favorite`,
    { method: favorited ? "POST" : "DELETE", ...(favorited ? { body: {} } : {}) },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result);
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

// Kept as a named export for older consumers that imported the row helper.
export function mapFavoritePriceSnapshot(row: Record<string, unknown>): number | null {
  return rowNullableNumber(row, "price_snapshot");
}
