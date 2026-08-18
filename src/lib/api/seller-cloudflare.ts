import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  PublicSellerProfile,
  PublicSellerSearchResult,
} from "@/lib/classifieds-types";
import { requireCloudflarePublicApiBaseUrl } from "@/lib/public-data/config";

interface ApiEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; details?: string };
}

export async function fetchCloudflarePublicSellerProfile(
  sellerId: string,
): Promise<ClassifiedsResult<PublicSellerProfile>> {
  const cleanId = sellerId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId)) {
    return { ok: false, error: { code: "validation_error", message: "تعذر تحديد البائع." } };
  }

  const result = await requestJson<PublicSellerProfile>(
    `/v1/sellers/${encodeURIComponent(cleanId)}`,
    "cloudflare_public_seller_read",
  );
  if (!result.ok) return result;

  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return base;
  return {
    ok: true,
    data: {
      ...result.data,
      avatarUrl: absoluteUrl(result.data.avatarUrl, base.data),
      coverUrl: absoluteUrl(result.data.coverUrl, base.data),
      listings: result.data.listings.map((listing) => ({
        ...listing,
        primaryImageUrl: absoluteUrl(listing.primaryImageUrl ?? null, base.data),
      })),
    },
  };
}

export async function searchCloudflarePublicSellers(
  query: string,
  limit = 8,
): Promise<ClassifiedsResult<PublicSellerSearchResult[]>> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return { ok: true, data: [] };
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 20));
  const result = await requestJson<PublicSellerSearchResult[]>(
    `/v1/sellers?q=${encodeURIComponent(cleanQuery)}&limit=${boundedLimit}`,
    "cloudflare_public_seller_search",
  );
  if (!result.ok) return result;

  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return base;
  return {
    ok: true,
    data: result.data.map((seller) => ({
      ...seller,
      avatarUrl: absoluteUrl(seller.avatarUrl, base.data),
    })),
  };
}

async function requestJson<T>(path: string, operation: string): Promise<ClassifiedsResult<T>> {
  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return base;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(new URL(path, `${base.data}/`), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || payload?.data === undefined) {
      const code = responseErrorCode(response.status);
      return {
        ok: false,
        error: {
          code,
          message: publicSellerErrorMessage(operation, code),
          details: payload?.error?.details,
          operation,
        },
      };
    }
    return { ok: true, data: payload.data };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: publicSellerErrorMessage(operation, "unknown"),
        details: error instanceof Error ? error.message : String(error),
        operation,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function responseErrorCode(status: number): ClassifiedsErrorCode {
  if (status === 404) return "not_found";
  if (status === 400) return "validation_error";
  if (status === 503) return "setup_required";
  return "unknown";
}

function publicSellerErrorMessage(operation: string, code: ClassifiedsErrorCode): string {
  if (operation === "cloudflare_public_seller_search") {
    return "تعذر البحث عن البائعين الآن. حاول مرة أخرى.";
  }
  if (code === "not_found") return "بيانات المتجر غير متاحة حالياً.";
  return "تعذر تحميل بيانات المتجر الآن. حاول مرة أخرى.";
}

function absoluteUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, `${base}/`).toString();
  } catch {
    return value;
  }
}
