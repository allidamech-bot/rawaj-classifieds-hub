import type { ClassifiedsResult, PublicSellerProfile } from "@/lib/classifieds-types";
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

  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return base;

  const url = new URL(`/v1/sellers/${encodeURIComponent(cleanId)}`, `${base.data}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<PublicSellerProfile> | null;
    if (!response.ok || !payload?.data) {
      return {
        ok: false,
        error: {
          code:
            response.status === 404
              ? "not_found"
              : response.status === 400
                ? "validation_error"
                : response.status === 503
                  ? "setup_required"
                  : "unknown",
          message: payload?.error?.message?.trim() || "تعذر تحميل ملف البائع.",
          details: payload?.error?.details,
          operation: "cloudflare_public_seller_read",
        },
      };
    }

    return {
      ok: true,
      data: {
        ...payload.data,
        avatarUrl: absoluteUrl(payload.data.avatarUrl, base.data),
        coverUrl: absoluteUrl(payload.data.coverUrl, base.data),
        listings: payload.data.listings.map((listing) => ({
          ...listing,
          primaryImageUrl: absoluteUrl(listing.primaryImageUrl ?? null, base.data),
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تعذر الاتصال بخدمة بيانات رَوَاج.",
        details: error instanceof Error ? error.message : String(error),
        operation: "cloudflare_public_seller_read",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function absoluteUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, `${base}/`).toString();
  } catch {
    return value;
  }
}
