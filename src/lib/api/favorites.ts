import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  Favorite,
  ListingFilters,
  PaginatedListingsResponse,
} from "@/lib/classifieds-types";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";
import { fetchPublicGovernorates, mapGovernorate, readReferences } from "@/lib/api/references";
import {
  getClient,
  mapError,
  rowNullableNumber,
  rowString,
} from "@/lib/api/shared";

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
    .eq("status", "approved");

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
    .eq("status", "approved");

  const listings =
    references.ok && !listingsResult.error
      ? await hydrateListingsWithPrimaryImages(
          clientResult.data,
          ((listingsResult.data ?? []) as Record<string, unknown>[]).map((row) =>
            mapListing(row, references.data.categories, references.data.governorates),
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  if (!listingId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان المطلوب." },
    };
  }

  const { data: listing, error: listingError } = await clientResult.data
    .from("listings")
    .select("id, title, price, status")
    .eq("id", listingId)
    .eq("status", "approved")
    .maybeSingle();

  if (listingError) return { ok: false, error: mapError(listingError) };
  if (!listing) {
    return {
      ok: false,
      error: { code: "not_found", message: "لا يمكن حفظ إعلان غير متاح." },
    };
  }

  const { error } = await clientResult.data
    .from("favorites")
    .upsert({ user_id: userId, listing_id: listingId }, { onConflict: "user_id,listing_id" });
  if (error) return { ok: false, error: mapError(error) };

  const { error: snapshotError } = await clientResult.data.from("favorite_listing_snapshots").upsert(
    {
      user_id: userId,
      listing_id: listingId,
      title_snapshot: listing.title,
      price_snapshot: listing.price,
      currency_snapshot: "SYP",
      status_snapshot: listing.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,listing_id" },
  );
  if (snapshotError) return { ok: false, error: mapError(snapshotError) };

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", listingId);
  if (error) return { ok: false, error: mapError(error) };

  const { error: snapshotError } = await clientResult.data
    .from("favorite_listing_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", listingId);
  if (snapshotError) return { ok: false, error: mapError(snapshotError) };

  return { ok: true, data: null };
}
