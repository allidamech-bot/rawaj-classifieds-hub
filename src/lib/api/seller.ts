import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  PublicSellerProfile,
  PublicSellerSearchResult,
  SellerRatingSummary,
  SellerReview,
} from "@/lib/classifieds-types";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  readReferences,
} from "@/lib/api/references";
import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { publicListingSelect, publicSellerReviewSelect } from "@/lib/api/public-fields";
import { buildRatingSummary, mapReview } from "@/lib/api/reviews";
import { getClient, mapError, rowNullableString, rowNumber, rowString } from "@/lib/api/shared";

function publicProfileMediaUrl(client: SupabaseClient, path: string | null): string | null {
  if (!path) return null;
  const { data } = client.storage.from("profile-media").getPublicUrl(path);
  return data.publicUrl ?? null;
}

function emptyRatingSummary(): SellerRatingSummary {
  return {
    average: null,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

export async function fetchPublicSellerProfile(
  sellerId: string,
): Promise<ClassifiedsResult<PublicSellerProfile>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const cleanSellerId = sellerId.trim();
  if (!cleanSellerId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البائع." },
    };
  }

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const { data: listingData, error: listingError } = await clientResult.data
    .from("listings")
    .select(publicListingSelect)
    .eq("owner_id", cleanSellerId)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter())
    .order("created_at", { ascending: false })
    .limit(60);

  if (listingError) return { ok: false, error: mapError(listingError) };

  const listings = await hydrateListingsWithPrimaryImages(
    clientResult.data,
    ((listingData ?? []) as Record<string, unknown>[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  );

  const { data: profileData, error: profileError } = await clientResult.data
    .rpc("get_public_seller_profile", { p_seller_id: cleanSellerId })
    .maybeSingle();

  if (profileError && profileError.code !== "42P01" && profileError.code !== "42703") {
    return { ok: false, error: mapError(profileError) };
  }

  if (listings.length === 0 && !profileData) {
    return {
      ok: false,
      error: { code: "not_found", message: "تعذر عرض ملف هذا البائع الآن." },
    };
  }

  const { data: reviewData, error: reviewError } = await clientResult.data
    .from("seller_reviews")
    .select(publicSellerReviewSelect)
    .eq("seller_user_id", cleanSellerId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  if (reviewError && reviewError.code !== "42P01" && reviewError.code !== "42703") {
    return { ok: false, error: mapError(reviewError) };
  }

  const profile = (profileData ?? {}) as Record<string, unknown>;
  const firstListing = listings[0];
  const firstName = rowNullableString(profile, "first_name");
  const lastName = rowNullableString(profile, "last_name");
  const displayName =
    rowNullableString(profile, "display_name") ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    firstListing?.contactName?.trim() ||
    "بائع رواجا";
  const reviews = ((reviewData ?? []) as Record<string, unknown>[]).map(mapReview);

  return {
    ok: true,
    data: {
      id: cleanSellerId,
      firstName,
      lastName,
      displayName,
      verified: rowString(profile, "verified") === "true",
      joinedAt: rowNullableString(profile, "created_at") ?? listings.at(-1)?.createdAt ?? null,
      locationAr:
        rowNullableString(profile, "governorate") ?? firstListing?.governorateNameAr ?? null,
      bio: rowNullableString(profile, "bio"),
      businessName: rowNullableString(profile, "business_name"),
      avatarUrl:
        rowNullableString(profile, "avatar_url") ??
        publicProfileMediaUrl(clientResult.data, rowNullableString(profile, "avatar_path")),
      coverUrl:
        rowNullableString(profile, "cover_url") ??
        publicProfileMediaUrl(clientResult.data, rowNullableString(profile, "cover_path")),
      approvedListingCount: listings.length,
      ratingSummary: buildRatingSummary(reviews),
      reviews,
      listings,
    },
  };
}

export async function searchPublicSellers(
  query: string,
  limit = 8,
): Promise<ClassifiedsResult<PublicSellerSearchResult[]>> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return { ok: true, data: [] };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("search_public_sellers", {
    p_query: cleanQuery,
    p_limit: limit,
  });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapPublicSellerSearchResult),
  };
}

function mapPublicSellerSearchResult(row: Record<string, unknown>): PublicSellerSearchResult {
  const firstName = rowNullableString(row, "first_name");
  const lastName = rowNullableString(row, "last_name");
  const displayName =
    rowNullableString(row, "display_name") ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    rowNullableString(row, "business_name") ||
    "معلن على رواجا";

  return {
    id: rowString(row, "id"),
    displayName,
    firstName,
    lastName,
    businessName: rowNullableString(row, "business_name"),
    governorate: rowNullableString(row, "governorate"),
    bio: rowNullableString(row, "bio"),
    avatarUrl: rowNullableString(row, "avatar_url"),
    approvedListingCount: rowNumber(row, "approved_listing_count"),
  };
}
