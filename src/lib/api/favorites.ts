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
import { getClient, mapError, rowString } from "@/lib/api/shared";

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
    .select("id")
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
  return { ok: true, data: null };
}
