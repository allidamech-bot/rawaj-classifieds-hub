import type { ClassifiedsResult } from "@/lib/classifieds-types";

export type PublicDataProviderName = "cloudflare";

export interface PublicDataRuntimeConfig {
  provider: PublicDataProviderName;
  cloudflareApiBaseUrl: string | null;
}

const cloudflareApiBaseUrl = normalizeApiBaseUrl(
  String(import.meta.env.VITE_PUBLIC_DATA_API_BASE_URL ?? ""),
);

/**
 * RAWAJ has one runtime data provider: Cloudflare Worker + D1 + R2.
 *
 * This is intentionally not environment-switchable. A missing or malformed
 * Cloudflare URL must fail closed instead of falling back to a retired backend.
 */
export const publicDataRuntimeConfig: PublicDataRuntimeConfig = {
  provider: "cloudflare",
  cloudflareApiBaseUrl,
};

export function isCloudflarePublicDataProvider(): true {
  return true;
}

export function requireCloudflarePublicApiBaseUrl(): ClassifiedsResult<string> {
  if (!publicDataRuntimeConfig.cloudflareApiBaseUrl) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "تعذر الوصول إلى خدمة بيانات رَوَاج الجديدة الآن.",
        details: "VITE_PUBLIC_DATA_API_BASE_URL is missing or invalid.",
        operation: "cloudflare_public_api_config",
      },
    };
  }

  return { ok: true, data: publicDataRuntimeConfig.cloudflareApiBaseUrl };
}

function normalizeApiBaseUrl(value: string): string | null {
  const clean = value.trim();
  if (!clean) return null;

  try {
    const url = new URL(clean);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(isLocalhost && url.protocol === "http:")) return null;
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
