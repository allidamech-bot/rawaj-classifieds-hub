import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  ClassifiedListing,
  PublicSellerProfile,
  PublicSellerSearchResult,
  PublicSellerSectionStatus,
} from "@/lib/classifieds-types";
import { readReferences } from "@/lib/api/references";
import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { publicListingSelect, publicSellerReviewSelect } from "@/lib/api/public-fields";
import {
  getClient,
  mapError,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";
import { fetchCloudflarePublicSellerProfile } from "@/lib/api/seller-cloudflare";
import { sanitizePublicListing } from "@/lib/public-listing-presentation";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { publicSellerProfileSelect } from "@/lib/profile-dto";
import {
  buildPublicSellerRatingSummary,
  cleanPublicSellerText,
  mapPublicSellerReview,
  PUBLIC_SELLER_LISTING_LIMIT,
  PUBLIC_SELLER_REVIEW_DISPLAY_LIMIT,
  PUBLIC_SELLER_REVIEW_SUMMARY_LIMIT,
  safePublicSellerMediaUrl,
} from "@/lib/public-seller-storefront";

export async function fetchPublicSellerProfile(
  sellerId: string,
): Promise<ClassifiedsResult<PublicSellerProfile>> {
  if (isCloudflarePublicDataProvider()) {
    return fetchCloudflarePublicSellerProfile(sellerId);
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const cleanSellerId = sellerId.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      cleanSellerId,
    )
  ) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البائع." },
    };
  }

  const [profileResult, inventory, reviewPopulation] = await Promise.all([
    clientResult.data
      .rpc("get_public_seller_profile", { p_seller_id: cleanSellerId })
      .select(publicSellerProfileSelect)
      .maybeSingle(),
    readPublicSellerInventory(clientResult.data, cleanSellerId),
    readPublicSellerReviews(clientResult.data, cleanSellerId),
  ]);

  const profileError = profileResult.error;
  const profileSchemaMissing =
    profileError?.code === "42P01" ||
    profileError?.code === "42703" ||
    profileError?.code === "PGRST202";
  if (profileError && !profileSchemaMissing) {
    return { ok: false, error: mapError(profileError, "public_seller_identity_read") };
  }

  if (!profileResult.data && !profileSchemaMissing) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا البائع غير متاح للعرض العام." },
    };
  }

  if (profileSchemaMissing && (inventory.status !== "ready" || inventory.listings.length === 0)) {
    return {
      ok: false,
      error: {
        code: "schema_missing",
        message: "تعذر تحميل هوية البائع العامة مؤقتًا.",
        operation: "public_seller_identity_read",
      },
    };
  }

  const profile = (profileResult.data ?? {}) as Record<string, unknown>;
  const firstListing = inventory.listings[0];
  const displayName =
    cleanPublicSellerText(rowNullableString(profile, "display_name"), 120) ||
    cleanPublicSellerText(firstListing?.contactName, 120) ||
    "بائع رواج";
  const reviews = reviewPopulation.status === "ready" ? reviewPopulation.reviews : [];
  const ratingSummary =
    reviewPopulation.status === "ready" ? buildPublicSellerRatingSummary(reviews) : null;

  return {
    ok: true,
    data: {
      id: cleanSellerId,
      displayName,
      verified: rowBoolean(profile, "verified"),
      joinedAt:
        rowNullableString(profile, "created_at") ?? inventory.listings.at(-1)?.createdAt ?? null,
      locationAr:
        cleanPublicSellerText(rowNullableString(profile, "governorate"), 120) ??
        firstListing?.governorateNameAr ??
        null,
      bio: cleanPublicSellerText(rowNullableString(profile, "bio"), 1000),
      businessName: cleanPublicSellerText(rowNullableString(profile, "business_name"), 120),
      avatarUrl: resolvePublicProfileMediaUrl(profile, "avatar"),
      coverUrl: resolvePublicProfileMediaUrl(profile, "cover"),
      approvedListingCount: inventory.totalCount,
      inventoryStatus: inventory.status,
      listingDisplayLimit: PUBLIC_SELLER_LISTING_LIMIT,
      ratingSummary,
      reviews: reviews.slice(0, PUBLIC_SELLER_REVIEW_DISPLAY_LIMIT),
      reviewsStatus: reviewPopulation.status,
      approvedReviewCount: ratingSummary?.count ?? null,
      reviewDisplayLimit: PUBLIC_SELLER_REVIEW_DISPLAY_LIMIT,
      listings: inventory.listings,
    },
  };
}

async function readPublicSellerInventory(
  client: SupabaseClient,
  sellerId: string,
): Promise<{
  status: PublicSellerSectionStatus;
  totalCount: number | null;
  listings: ClassifiedListing[];
}> {
  const references = await readReferences(client);
  if (!references.ok) {
    return {
      status: sectionStatus(references.error.code),
      totalCount: null,
      listings: [],
    } as const;
  }

  const { data, error, count } = await client
    .from("listings")
    .select(publicListingSelect, { count: "exact" })
    .eq("owner_id", sellerId)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter())
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PUBLIC_SELLER_LISTING_LIMIT);

  if (error) {
    const mapped = mapError(error, "public_seller_inventory_read");
    return { status: sectionStatus(mapped.code), totalCount: null, listings: [] } as const;
  }

  const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    sanitizePublicListing(mapListing(row, references.categories, references.governorates)),
  );
  const deduplicated = [...new Map(mapped.map((listing) => [listing.id, listing])).values()];
  return {
    status: "ready" as const,
    totalCount: count ?? deduplicated.length,
    listings: await hydrateListingsWithPrimaryImages(client, deduplicated),
  };
}

async function readPublicSellerReviews(client: SupabaseClient, sellerId: string) {
  const { data, error, count } = await client
    .from("seller_reviews")
    .select(publicSellerReviewSelect, { count: "exact" })
    .eq("seller_user_id", sellerId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PUBLIC_SELLER_REVIEW_SUMMARY_LIMIT);

  if (error) {
    const mapped = mapError(error, "public_seller_reviews_read");
    return { status: sectionStatus(mapped.code), reviews: [] } as const;
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if ((count ?? rows.length) > rows.length) {
    return { status: "unavailable" as const, reviews: [] };
  }
  return { status: "ready" as const, reviews: rows.map(mapPublicSellerReview) };
}

function sectionStatus(errorCode: string): Exclude<PublicSellerSectionStatus, "ready"> {
  return errorCode === "schema_missing" ? "unsupported" : "unavailable";
}

function resolvePublicProfileMediaUrl(profile: Record<string, unknown>, kind: "avatar" | "cover") {
  return safePublicSellerMediaUrl(rowNullableString(profile, `${kind}_url`));
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
  const displayName =
    rowNullableString(row, "display_name") ||
    rowNullableString(row, "business_name") ||
    "معلن على رواج";

  return {
    id: rowString(row, "id"),
    displayName,
    firstName: null,
    lastName: null,
    businessName: rowNullableString(row, "business_name"),
    governorate: rowNullableString(row, "governorate"),
    bio: rowNullableString(row, "bio"),
    avatarUrl: safePublicSellerMediaUrl(rowNullableString(row, "avatar_url")),
    approvedListingCount: rowNumber(row, "approved_listing_count"),
  };
}
