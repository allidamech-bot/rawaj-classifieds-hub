import { fetchMyPromotionRequests } from "@/lib/api/promotions";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedsResult,
  ListingPromotionRequest,
} from "@/lib/classifieds-types";

export type SearchBoostPackageCode = "boost_6h" | "boost_24h" | "boost_3d" | "boost_7d";

export interface SearchBoostPackage {
  code: SearchBoostPackageCode;
  durationMinutes: 360 | 1440 | 4320 | 10080;
  priceMinor: 200 | 350 | 700 | 1300;
  requestedDays: 1 | 3 | 7;
  recommended?: boolean;
}

export interface SearchBoostOrder {
  promotion: ListingPromotionRequest;
  package: SearchBoostPackage;
}

export const SEARCH_BOOST_PACKAGES: readonly SearchBoostPackage[] = [
  { code: "boost_6h", durationMinutes: 360, priceMinor: 200, requestedDays: 1 },
  {
    code: "boost_24h",
    durationMinutes: 1440,
    priceMinor: 350,
    requestedDays: 1,
    recommended: true,
  },
  { code: "boost_3d", durationMinutes: 4320, priceMinor: 700, requestedDays: 3 },
  { code: "boost_7d", durationMinutes: 10080, priceMinor: 1300, requestedDays: 7 },
] as const;

const SEARCH_BOOST_NOTE = /^\[RAWAJ_SEARCH_BOOST:(boost_(?:6h|24h|3d|7d))\]/;
const SEARCH_BOOST_REQUEST_PREFIX = "search-boost";

export async function createSearchBoostRequest(input: {
  listingId: string;
  packageCode: SearchBoostPackageCode;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  clientNonce?: string;
}): Promise<ClassifiedsResult<ListingPromotionRequest>> {
  const listingId = input.listingId.trim();
  const boostPackage = searchBoostPackage(input.packageCode);
  if (!listingId || !boostPackage) return validation("اختر إعلاناً وباقة Boost صحيحة.");

  const nonce = cleanNonce(input.clientNonce) ?? crypto.randomUUID();
  const result = await cloudflareApiRequest<ListingPromotionRequest>("/v1/account/promotions", {
    method: "POST",
    body: {
      listingId,
      clientRequestId: `${SEARCH_BOOST_REQUEST_PREFIX}:${boostPackage.code}:${nonce}`,
      promotionType: "highlighted",
      requestedDays: boostPackage.requestedDays,
      paymentMethod: input.paymentMethod?.trim() || null,
      paymentReference: input.paymentReference?.trim() || null,
    },
  });

  return result.ok
    ? { ok: true, data: result.data }
    : {
        ok: false,
        error: {
          code: normalizeErrorCode(result.code),
          message: result.error,
          operation: "search_boost_create",
        },
      };
}

export async function fetchMySearchBoostOrders(
  userId: string | null,
): Promise<ClassifiedsResult<SearchBoostOrder[]>> {
  const result = await fetchMyPromotionRequests(userId);
  if (!result.ok) return result;
  return {
    ok: true,
    data: result.data.flatMap((promotion) => {
      const boostPackage = searchBoostPackageFromPromotion(promotion);
      return boostPackage ? [{ promotion, package: boostPackage }] : [];
    }),
  };
}

export function searchBoostPackage(code: string): SearchBoostPackage | null {
  return SEARCH_BOOST_PACKAGES.find((item) => item.code === code) ?? null;
}

export function searchBoostPackageFromPromotion(
  promotion: ListingPromotionRequest,
): SearchBoostPackage | null {
  const code =
    promotion.searchBoostPackageCode ?? promotion.adminNote?.match(SEARCH_BOOST_NOTE)?.[1];
  return code ? searchBoostPackage(code) : null;
}

export function searchBoostDurationLabel(
  code: SearchBoostPackageCode,
  text: (ar: string, en: string) => string,
): string {
  if (code === "boost_6h") return text("6 ساعات", "6 hours");
  if (code === "boost_24h") return text("24 ساعة", "24 hours");
  if (code === "boost_3d") return text("3 أيام", "3 days");
  return text("7 أيام", "7 days");
}

export function searchBoostName(
  code: SearchBoostPackageCode,
  text: (ar: string, en: string) => string,
): string {
  if (code === "boost_6h") return text("Boost سريع", "Quick Boost");
  if (code === "boost_24h") return text("Boost يوم كامل", "Full-day Boost");
  if (code === "boost_3d") return text("Boost قوي", "Strong Boost");
  return text("Boost أسبوع", "Weekly Boost");
}

export function formatSearchBoostPrice(priceMinor: number, language: string): string {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "ar-SY", {
    style: "currency",
    currency: "SYP",
    maximumFractionDigits: 0,
  }).format(priceMinor);
}

export function remainingBoostTime(endsAt: string | null, nowMs = Date.now()): number {
  if (!endsAt) return 0;
  const end = Date.parse(endsAt);
  return Number.isFinite(end) ? Math.max(0, end - nowMs) : 0;
}

export function isListingActivelyBoosted(
  listing: Pick<ClassifiedListing, "isFeatured" | "featuredUntil">,
  nowMs = Date.now(),
): boolean {
  if (!listing.isFeatured) return false;
  if (!listing.featuredUntil) return true;
  const end = Date.parse(listing.featuredUntil);
  return Number.isFinite(end) && end > nowMs;
}

export function isSearchBoostRequestOpen(
  promotion: ListingPromotionRequest,
  nowMs = Date.now(),
): boolean {
  if (promotion.status === "pending_review") return true;
  if (promotion.status !== "approved") return false;
  if (!promotion.endsAt) return true;
  const end = Date.parse(promotion.endsAt);
  return Number.isFinite(end) && end > nowMs;
}

export function isListingEligibleForSearchBoost(
  listing: Pick<
    ClassifiedListing,
    "id" | "status" | "archivedAt" | "expiresAt" | "isFeatured" | "featuredUntil"
  >,
  promotions: readonly ListingPromotionRequest[] = [],
  nowMs = Date.now(),
): boolean {
  if (listing.status !== "approved" || listing.archivedAt) return false;
  if (listing.expiresAt) {
    const expiry = Date.parse(listing.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= nowMs) return false;
  }
  if (isListingActivelyBoosted(listing, nowMs)) return false;
  return !promotions.some(
    (promotion) =>
      promotion.listingId === listing.id && isSearchBoostRequestOpen(promotion, nowMs),
  );
}

export function formatBoostCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours + days * 24, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

const BOOST_INTENT_KEY = "rawaj.search-boost-intent.v1";

export function queueSearchBoostIntent(listingId: string): void {
  if (typeof window === "undefined") return;
  const clean = listingId.trim();
  if (!clean) return;
  try {
    window.sessionStorage.setItem(
      BOOST_INTENT_KEY,
      JSON.stringify({ listingId: clean, queuedAt: Date.now() }),
    );
  } catch {
    // Navigation still works without session storage.
  }
  window.location.assign("/promotion");
}

export function consumeSearchBoostIntent(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BOOST_INTENT_KEY);
    window.sessionStorage.removeItem(BOOST_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { listingId?: unknown; queuedAt?: unknown };
    if (
      typeof parsed.listingId !== "string" ||
      typeof parsed.queuedAt !== "number" ||
      Date.now() - parsed.queuedAt > 30 * 60 * 1000
    ) {
      return null;
    }
    return parsed.listingId.trim() || null;
  } catch {
    return null;
  }
}

function cleanNonce(value: string | undefined): string | null {
  if (!value) return null;
  const clean = value.trim();
  return /^[A-Za-z0-9_-]{8,60}$/.test(clean) ? clean : null;
}

function validation(message: string): ClassifiedsResult<never> {
  return {
    ok: false,
    error: { code: "validation_error", message, operation: "search_boost_create" },
  };
}

function normalizeErrorCode(code: string): ClassifiedsError["code"] {
  const supported = new Set<ClassifiedsError["code"]>([
    "auth_required",
    "permission_denied",
    "not_found",
    "validation_error",
    "status_mismatch",
    "rate_limited",
    "unknown",
  ]);
  return supported.has(code as ClassifiedsError["code"])
    ? (code as ClassifiedsError["code"])
    : "unknown";
}
