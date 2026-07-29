import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
} from "@/lib/classifieds-types";
import { mapListing } from "@/lib/api/listings";
import { cloudflareApiRequest, cloudflareApiUrl } from "@/lib/cloudflare-auth";
import { fetchCloudflareListingDetail } from "@/lib/public-data/cloudflare-client";

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

function writeLocalRecentViews(rows: LocalRecentListingView[]): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(
      localRecentViewsKey,
      JSON.stringify(rows.slice(0, maxLocalRecentViews)),
    );
  } catch {
    // Browsing remains functional when local storage is blocked or full.
  }
}

function recordLocalRecentView(listingId: string): void {
  const timestamp = new Date().toISOString();
  const existing = readLocalRecentViews();
  const previous = existing.find((row) => row.listingId === listingId);
  writeLocalRecentViews([
    {
      listingId,
      viewedAt: timestamp,
      viewCount: Math.min((previous?.viewCount ?? 0) + 1, 2147483647),
    },
    ...existing.filter((row) => row.listingId !== listingId),
  ]);
}

function removeLocalRecentView(listingId: string): void {
  writeLocalRecentViews(readLocalRecentViews().filter((row) => row.listingId !== listingId));
}

function clearLocalRecentViews(): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(localRecentViewsKey);
  } catch {
    // No further cleanup is required when storage is unavailable.
  }
}

export async function recordRecentListingView(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return validationFailure("تعذر تحديد الإعلان الذي تمت مشاهدته.");
  if (!userId) {
    recordLocalRecentView(cleanListingId);
    return { ok: true, data: null };
  }
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/recent-view`,
    { method: "POST", body: {} },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

export async function syncAnonymousRecentListingViews(
  userId: string | null,
): Promise<ClassifiedsResult<number>> {
  if (!userId) return { ok: true, data: 0 };
  const localRows = readLocalRecentViews().slice().reverse();
  if (localRows.length === 0) return { ok: true, data: 0 };

  let synced = 0;
  for (const row of localRows) {
    const result = await recordRecentListingView(userId, row.listingId);
    if (!result.ok) return result;
    synced += 1;
  }
  clearLocalRecentViews();
  return { ok: true, data: synced };
}

async function hydrateAnonymousRows(
  rows: LocalRecentListingView[],
): Promise<ClassifiedsResult<RecentListingViewItem[]>> {
  if (rows.length === 0) return { ok: true, data: [] };
  const details = await Promise.all(
    rows.map(async (row) => ({ row, result: await fetchCloudflareListingDetail(row.listingId) })),
  );
  return {
    ok: true,
    data: details.flatMap(({ row, result }) =>
      result.ok ? [{ ...row, listing: result.data.listing }] : [],
    ),
  };
}

export async function fetchRecentListingViews(
  userId: string | null,
  limit = 12,
): Promise<ClassifiedsResult<RecentListingViewItem[]>> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 30));
  if (!userId) return hydrateAnonymousRows(readLocalRecentViews().slice(0, safeLimit));

  const result = await cloudflareApiRequest<
    Array<{
      listingId: string;
      viewedAt: string;
      viewCount: number;
      listing: Record<string, unknown>;
    }>
  >(`/v1/account/recent-views?limit=${safeLimit}`);
  if (!result.ok) return apiFailure(result);
  return {
    ok: true,
    data: result.data.map((row) => ({
      listingId: row.listingId,
      viewedAt: row.viewedAt,
      viewCount: Math.max(1, Number(row.viewCount) || 1),
      listing: mapListing(row.listing),
    })),
  };
}

export async function removeRecentListingView(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return validationFailure("تعذر تحديد الإعلان.");
  removeLocalRecentView(cleanListingId);
  if (!userId) return { ok: true, data: null };
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/account/recent-views/${encodeURIComponent(cleanListingId)}`,
    { method: "DELETE" },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

export async function clearRecentListingViews(
  userId: string | null,
): Promise<ClassifiedsResult<null>> {
  clearLocalRecentViews();
  if (!userId) return { ok: true, data: null };
  const result = await cloudflareApiRequest<{ success: boolean }>("/v1/account/recent-views", {
    method: "DELETE",
  });
  return result.ok ? { ok: true, data: null } : apiFailure(result);
}

export async function fetchSellerFollowSummary(
  sellerId: string,
): Promise<ClassifiedsResult<SellerFollowSummary>> {
  const cleanSellerId = sellerId.trim();
  if (!cleanSellerId) return validationFailure("تعذر تحديد البائع.");
  const result = await cloudflareApiRequest<SellerFollowSummary>(
    `/v1/sellers/${encodeURIComponent(cleanSellerId)}/follow`,
  );
  return result.ok ? { ok: true, data: result.data } : apiFailure(result);
}

export async function setSellerFollow(
  userId: string | null,
  sellerId: string,
  following: boolean,
): Promise<ClassifiedsResult<SellerFollowSummary>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لمتابعة البائع.");
  const cleanSellerId = sellerId.trim();
  if (!cleanSellerId || cleanSellerId === userId) {
    return validationFailure("لا يمكنك متابعة هذا الحساب.");
  }
  const result = await cloudflareApiRequest<SellerFollowSummary>(
    `/v1/sellers/${encodeURIComponent(cleanSellerId)}/follow`,
    { method: following ? "PUT" : "DELETE", body: following ? {} : undefined },
  );
  return result.ok ? { ok: true, data: result.data } : apiFailure(result);
}

export async function fetchFollowedSellers(
  userId: string | null,
  limit = 12,
): Promise<ClassifiedsResult<FollowedSellerSummary[]>> {
  if (!userId) return authFailure("يجب تسجيل الدخول لعرض البائعين المتابَعين.");
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 30));
  const result = await cloudflareApiRequest<FollowedSellerSummary[]>(
    `/v1/account/followed-sellers?limit=${safeLimit}`,
  );
  if (!result.ok) return apiFailure(result);
  return {
    ok: true,
    data: result.data.map((seller) => ({
      ...seller,
      avatarUrl: seller.avatarUrl ? cloudflareApiUrl(seller.avatarUrl) : null,
      approvedListingCount: Math.max(0, Number(seller.approvedListingCount) || 0),
    })),
  };
}

function validationFailure<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}

function authFailure<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "auth_required", message } };
}

function apiFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}
