import type { ClassifiedsResult } from "@/lib/classifieds-types";

export type PublicDataProviderName = "supabase" | "cloudflare";

export interface PublicDataRuntimeConfig {
  provider: PublicDataProviderName;
  cloudflareApiBaseUrl: string | null;
}

const configuredProvider = String(import.meta.env.VITE_PUBLIC_DATA_PROVIDER ?? "supabase")
  .trim()
  .toLowerCase();

const provider: PublicDataProviderName =
  configuredProvider === "cloudflare" ? "cloudflare" : "supabase";

const cloudflareApiBaseUrl = normalizeApiBaseUrl(
  String(import.meta.env.VITE_PUBLIC_DATA_API_BASE_URL ?? ""),
);

export const publicDataRuntimeConfig: PublicDataRuntimeConfig = {
  provider,
  cloudflareApiBaseUrl,
};

export function isCloudflarePublicDataProvider(): boolean {
  return publicDataRuntimeConfig.provider === "cloudflare";
}

export function requireCloudflarePublicApiBaseUrl(): ClassifiedsResult<string> {
  if (!isCloudflarePublicDataProvider()) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "Cloudflare public data provider is not enabled.",
        operation: "cloudflare_public_api_config",
      },
    };
  }

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
