import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  Favorite,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { fetchPublicGovernorates, mapGovernorate, readReferences } from "@/lib/api/references";
import { getClient, mapError, rowNullableNumber, rowString } from "@/lib/api/shared";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

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
  if (!userId) {
    return { ok: false, error: { code: "auth_required", message: "يجب تسجيل الدخول." } };
  }

  if (!listingId.trim()) {
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد الإعلان." } };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ favorited: boolean }>(
      `/v1/listings/${encodeURIComponent(listingId)}/favorite`,
    );
    return result.ok
      ? { ok: true, data: result.data.favorited }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("favorites")
    .select("user_id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: !!data };
}

export async function fetchFavorites(
  userId: string | null,
): Promise<ClassifiedsResult<Favorite[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض المفضلة." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<Record<string, unknown>[]>("/v1/account/favorites");
    if (!result.ok) return { ok: false, error: { code: "unknown", message: result.error } };
    return {
      ok: true,
      data: result.data.map((row) => ({
        userId: rowString(row, "user_id"),
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("favorites")
    .select("user_id, listing_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };

  const favorites = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    userId: rowString(row, "user_id"),
    listingId: rowString(row, "listing_id"),
    createdAt: rowString(row, "created_at"),
  }));

  const listingIds = [...new Set(favorites.map((favorite) => favorite.listingId).filter(Boolean))];
  if (listingIds.length === 0) return { ok: true, data: favorites };

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: true, data: favorites };

  const listingsResult = await clientResult.data
    .from("listings")
    .select("*")
    .in("id", listingIds)
    .eq("status", "approved")
    .or(publicListingExpiryFilter());

  if (listingsResult.error) return { ok: true, data: favorites };

  const listings = await hydrateListingsWithPrimaryImages(
    clientResult.data,
    ((listingsResult.data ?? []) as Record<string, unknown>[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  );
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));

  return {
    ok: true,
    data: favorites.map((favorite) => ({
      ...favorite,
      listing: listingById.get(favorite.listingId),
    })),
  };
}

export async function fetchFavoriteJourneyItems(
  userId: string | null,
): Promise<ClassifiedsResult<FavoriteJourneyItem[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض المفضلة." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const favorites = await fetchFavorites(userId);
    if (!favorites.ok) return favorites;
    return {
      ok: true,
      data: favorites.data.map((favorite) => ({
        listingId: favorite.listingId,
        availability: "available" as const,
        snapshot: {
          userId: favorite.userId,
          listingId: favorite.listingId,
          title: favorite.listing?.title ?? "إعلان غير متاح",
          price: favorite.listing?.price ?? null,
          currency: favorite.listing?.currency ?? "SYP",
          status: favorite.listing?.status ?? "approved",
          createdAt: favorite.createdAt,
          updatedAt: favorite.listing?.updatedAt ?? favorite.createdAt,
        },
        listing: favorite.listing,
      })),
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("favorite_listing_snapshots")
    .select(
      "user_id, listing_id, title_snapshot, price_snapshot, currency_snapshot, status_snapshot, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };

  const snapshots = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    userId: rowString(row, "user_id"),
    listingId: rowString(row, "listing_id"),
    title: rowString(row, "title_snapshot", "إعلان غير متاح"),
    price: rowNullableNumber(row, "price_snapshot"),
    currency: rowString(row, "currency_snapshot", "SYP"),
    status: rowString(row, "status_snapshot", "approved"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  }));

  const listingIds = [...new Set(snapshots.map((snapshot) => snapshot.listingId).filter(Boolean))];
  if (listingIds.length === 0) return { ok: true, data: [] };

  const references = await readReferences(clientResult.data);
  const listingsResult = await clientResult.data
    .from("listings")
    .select("*")
    .in("id", listingIds)
    .eq("status", "approved")
    .or(publicListingExpiryFilter());

  const listings =
    references.ok && !listingsResult.error
      ? await hydrateListingsWithPrimaryImages(
          clientResult.data,
          ((listingsResult.data ?? []) as Record<string, unknown>[]).map((row) =>
            mapListing(row, references.categories, references.governorates),
          ),
        )
      : [];
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));

  return {
    ok: true,
    data: snapshots.map((snapshot) => {
      const listing = listingById.get(snapshot.listingId);
      return {
        listingId: snapshot.listingId,
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
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ الإعلان." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ favorited: boolean }>(
      `/v1/listings/${encodeURIComponent(listingId)}/favorite`,
      { method: "POST", body: {} },
    );
    return result.ok
      ? { ok: true, data: null }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const { data, error } = await clientResult.data.rpc("rawaj_set_favorite_v1", {
    p_listing_id: cleanListingId,
    p_favorited: true,
  });

  if (error) return { ok: false, error: mapError(error, "favorite_listing") };
  if (data !== true) {
    return {
      ok: false,
      error: { code: "not_found", message: "لا يمكن حفظ إعلان غير متاح." },
    };
  }

  return { ok: true, data: null };
}

export async function unfavoriteListing(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتعديل المفضلة." },
    };
  }
  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ favorited: boolean }>(
      `/v1/listings/${encodeURIComponent(listingId)}/favorite`,
      { method: "DELETE" },
    );
    return result.ok
      ? { ok: true, data: null }
      : { ok: false, error: { code: "unknown", message: result.error } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_set_favorite_v1", {
    p_listing_id: listingId,
    p_favorited: false,
  });

  if (error) return { ok: false, error: mapError(error, "unfavorite_listing") };
  return { ok: true, data: null };
}
