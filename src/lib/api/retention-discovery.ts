import type { ClassifiedListing, ClassifiedsResult } from "@/lib/classifieds-types";
import { publicListingExpiryFilter } from "@/lib/api/listing-expiry";
import { hydrateListingsWithPrimaryImages, mapListing } from "@/lib/api/listings";
import { publicListingSelect } from "@/lib/api/public-fields";
import { readReferences } from "@/lib/api/references";
import {
  getClient,
  mapError,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";

const localRecentViewsKey = "rawaj_recent_listing_views_v1";
const maxLocalRecentViews = 30;

interface LocalRecentListingView {
  listingId: string;
  viewedAt: string;
  viewCount: number;
}

export interface RecentListingViewItem {
  listingId: string;
  viewedAt: string;
  viewCount: number;
  listing: ClassifiedListing;
}

export interface SellerFollowSummary {
  followerCount: number;
  isFollowing: boolean;
}

export interface FollowedSellerSummary {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  governorate: string | null;
  bio: string | null;
  avatarUrl: string | null;
  approvedListingCount: number;
  followedAt: string;
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readLocalRecentViews(): LocalRecentListingView[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(localRecentViewsKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((value): LocalRecentListingView | null => {
        if (!value || typeof value !== "object") return null;
        const row = value as Record<string, unknown>;
        const listingId = typeof row.listingId === "string" ? row.listingId.trim() : "";
        const viewedAt = typeof row.viewedAt === "string" ? row.viewedAt : "";
        const viewCount =
          typeof row.viewCount === "number" && Number.isFinite(row.viewCount)
            ? Math.max(1, Math.floor(row.viewCount))
            : 1;
        if (!listingId || Number.isNaN(new Date(viewedAt).getTime())) return null;
        return { listingId, viewedAt, viewCount };
      })
      .filter((value): value is LocalRecentListingView => value !== null)
      .slice(0, maxLocalRecentViews);
  } catch {
    return [];
  }
}

function writeLocalRecentViews(rows: LocalRecentListingView[]) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(localRecentViewsKey, JSON.stringify(rows.slice(0, maxLocalRecentViews)));
  } catch {
    // Browsing remains functional when storage is blocked or full.
  }
}

function recordLocalRecentView(listingId: string) {
  const now = new Date().toISOString();
  const existing = readLocalRecentViews();
  const previous = existing.find((row) => row.listingId === listingId);
  const next: LocalRecentListingView[] = [
    {
      listingId,
      viewedAt: now,
      viewCount: Math.min((previous?.viewCount ?? 0) + 1, 2147483647),
    },
    ...existing.filter((row) => row.listingId !== listingId),
  ];
  writeLocalRecentViews(next);
}

function removeLocalRecentView(listingId: string) {
  writeLocalRecentViews(readLocalRecentViews().filter((row) => row.listingId !== listingId));
}

function clearLocalRecentViews() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(localRecentViewsKey);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

function isCompatibilityError(error: { code?: string | null } | null): boolean {
  return ["42P01", "42703", "42883", "PGRST202", "PGRST204"].includes(error?.code ?? "");
}

async function recordAuthenticatedRecentView(
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_record_recent_listing_view_v1", {
    p_listing_id: listingId,
  });

  if (error) {
    if (isCompatibilityError(error)) {
      return {
        ok: false,
        error: {
          code: "schema_missing",
          message: "سجل المشاهدة غير متاح على هذه البيئة بعد.",
          operation: "record_recent_listing_view",
        },
      };
    }
    return { ok: false, error: mapError(error, "record_recent_listing_view") };
  }
  if (data !== true) {
    return {
      ok: false,
      error: { code: "not_found", message: "هذا الإعلان لم يعد متاحًا للعرض العام." },
    };
  }

  return { ok: true, data: null };
}

export async function recordRecentListingView(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان الذي تمت مشاهدته." },
    };
  }

  if (!userId) {
    recordLocalRecentView(cleanListingId);
    return { ok: true, data: null };
  }

  const result = await recordAuthenticatedRecentView(cleanListingId);
  if (!result.ok && result.error.code === "schema_missing") {
    recordLocalRecentView(cleanListingId);
    return { ok: true, data: null };
  }
  return result;
}

export async function syncAnonymousRecentListingViews(
  userId: string | null,
): Promise<ClassifiedsResult<number>> {
  if (!userId) return { ok: true, data: 0 };

  const localRows = readLocalRecentViews().slice().reverse();
  if (localRows.length === 0) return { ok: true, data: 0 };

  let synced = 0;
  for (const row of localRows) {
    const result = await recordAuthenticatedRecentView(row.listingId);
    if (!result.ok) return { ok: false, error: result.error };
    synced += 1;
  }

  clearLocalRecentViews();
  return { ok: true, data: synced };
}

async function hydrateRecentRows(
  rows: LocalRecentListingView[],
): Promise<ClassifiedsResult<RecentListingViewItem[]>> {
  if (rows.length === 0) return { ok: true, data: [] };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const references = await readReferences(clientResult.data);
  if (!references.ok) return { ok: false, error: references.error };

  const listingIds = [...new Set(rows.map((row) => row.listingId))];
  const { data, error } = await clientResult.data
    .from("listings")
    .select(publicListingSelect)
    .in("id", listingIds)
    .eq("status", "approved")
    .is("archived_at", null)
    .or(publicListingExpiryFilter());

  if (error) return { ok: false, error: mapError(error, "recent_listing_views_read") };

  const listings = await hydrateListingsWithPrimaryImages(
    clientResult.data,
    ((data ?? []) as Record<string, unknown>[]).map((row) =>
      mapListing(row, references.categories, references.governorates),
    ),
  );
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));

  return {
    ok: true,
    data: rows.flatMap((row) => {
      const listing = listingById.get(row.listingId);
      return listing ? [{ ...row, listing }] : [];
    }),
  };
}

export async function fetchRecentListingViews(
  userId: string | null,
  limit = 12,
): Promise<ClassifiedsResult<RecentListingViewItem[]>> {
  const safeLimit = Math.max(1, Math.min(limit, 30));
  if (!userId) return hydrateRecentRows(readLocalRecentViews().slice(0, safeLimit));

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("recent_listing_views")
    .select("listing_id, viewed_at, view_count")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    if (isCompatibilityError(error)) {
      return hydrateRecentRows(readLocalRecentViews().slice(0, safeLimit));
    }
    return { ok: false, error: mapError(error, "recent_listing_views_read") };
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    listingId: rowString(row, "listing_id"),
    viewedAt: rowString(row, "viewed_at"),
    viewCount: Math.max(1, rowNumber(row, "view_count", 1)),
  }));
  return hydrateRecentRows(rows);
}

export async function removeRecentListingView(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد الإعلان." },
    };
  }

  removeLocalRecentView(cleanListingId);
  if (!userId) return { ok: true, data: null };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { error } = await clientResult.data.rpc("rawaj_remove_recent_listing_view_v1", {
    p_listing_id: cleanListingId,
  });
  if (error && !isCompatibilityError(error)) {
    return { ok: false, error: mapError(error, "remove_recent_listing_view") };
  }
  return { ok: true, data: null };
}

export async function clearRecentListingViews(
  userId: string | null,
): Promise<ClassifiedsResult<null>> {
  clearLocalRecentViews();
  if (!userId) return { ok: true, data: null };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { error } = await clientResult.data.rpc("rawaj_clear_recent_listing_views_v1");
  if (error && !isCompatibilityError(error)) {
    return { ok: false, error: mapError(error, "clear_recent_listing_views") };
  }
  return { ok: true, data: null };
}

export async function fetchSellerFollowSummary(
  sellerId: string,
): Promise<ClassifiedsResult<SellerFollowSummary>> {
  const cleanSellerId = sellerId.trim();
  if (!cleanSellerId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد البائع." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .rpc("rawaj_get_seller_follow_summary_v1", { p_seller_user_id: cleanSellerId })
    .maybeSingle();

  if (error) {
    if (isCompatibilityError(error)) {
      return { ok: true, data: { followerCount: 0, isFollowing: false } };
    }
    return { ok: false, error: mapError(error, "seller_follow_summary") };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      followerCount: Math.max(0, rowNumber(row, "follower_count")),
      isFollowing: rowBoolean(row, "is_following"),
    },
  };
}

export async function setSellerFollow(
  userId: string | null,
  sellerId: string,
  following: boolean,
): Promise<ClassifiedsResult<SellerFollowSummary>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لمتابعة البائع." },
    };
  }

  const cleanSellerId = sellerId.trim();
  if (!cleanSellerId || cleanSellerId === userId) {
    return {
      ok: false,
      error: { code: "validation_error", message: "لا يمكنك متابعة هذا الحساب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_set_seller_follow_v1", {
    p_seller_user_id: cleanSellerId,
    p_following: following,
  });

  if (error) return { ok: false, error: mapError(error, "set_seller_follow") };
  if (data !== true) {
    return {
      ok: false,
      error: { code: "not_found", message: "لا يمكن متابعة بائع غير متاح للعامة." },
    };
  }

  return fetchSellerFollowSummary(cleanSellerId);
}

export async function fetchFollowedSellers(
  userId: string | null,
  limit = 12,
): Promise<ClassifiedsResult<FollowedSellerSummary[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض البائعين المتابَعين." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const safeLimit = Math.max(1, Math.min(limit, 30));
  const { data, error } = await clientResult.data.rpc("rawaj_list_followed_sellers_v1", {
    p_limit: safeLimit,
  });

  if (error) {
    if (isCompatibilityError(error)) return { ok: true, data: [] };
    return { ok: false, error: mapError(error, "followed_sellers_read") };
  }

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const firstName = rowNullableString(row, "first_name");
      const lastName = rowNullableString(row, "last_name");
      const displayName =
        rowNullableString(row, "display_name") ||
        rowNullableString(row, "business_name") ||
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        "بائع على رواج";
      const avatarPath = rowNullableString(row, "avatar_path");
      const storedAvatarUrl = rowNullableString(row, "avatar_url");
      const avatarUrl =
        storedAvatarUrl ||
        (avatarPath
          ? clientResult.data.storage.from("profile-media").getPublicUrl(avatarPath).data.publicUrl
          : null);

      return {
        id: rowString(row, "id"),
        displayName,
        firstName,
        lastName,
        businessName: rowNullableString(row, "business_name"),
        governorate: rowNullableString(row, "governorate"),
        bio: rowNullableString(row, "bio"),
        avatarUrl,
        approvedListingCount: Math.max(0, rowNumber(row, "approved_listing_count")),
        followedAt: rowString(row, "followed_at"),
      };
    }),
  };
}
