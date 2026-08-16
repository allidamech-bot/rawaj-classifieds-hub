import { cloudflareAuthorizedFetch } from "@/lib/cloudflare-auth";

const MAX_RESOLVED_MEDIA_URLS = 120;
const resolvedMediaUrls = new Map<string, string>();
const pendingMediaUrls = new Map<string, Promise<string>>();

function mediaPath(value: string): string | null {
  try {
    const url = new URL(value, "https://rawaj.invalid");
    if (/^\/v1\/(?:account|admin)\/media\/assets\/[^/]+$/.test(url.pathname)) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return null;
  }
  return null;
}

function ownerMediaPath(value: string): string | null {
  try {
    const url = new URL(value, "https://rawaj.invalid");
    const match = url.pathname.match(/^\/v1\/media\/assets\/([^/]+)$/);
    if (!match) return null;
    return `/v1/account/media/assets/${encodeURIComponent(decodeURIComponent(match[1]))}${url.search}`;
  } catch {
    return null;
  }
}

function canCreateObjectUrl(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    typeof URL.revokeObjectURL === "function"
  );
}

function rememberResolvedMediaUrl(source: string, objectUrl: string): void {
  resolvedMediaUrls.set(source, objectUrl);
  while (resolvedMediaUrls.size > MAX_RESOLVED_MEDIA_URLS) {
    const oldest = resolvedMediaUrls.entries().next().value as [string, string] | undefined;
    if (!oldest) break;
    resolvedMediaUrls.delete(oldest[0]);
    if (canCreateObjectUrl()) URL.revokeObjectURL(oldest[1]);
  }
}

/**
 * Protected marketplace media requires a Firebase bearer token, which a plain
 * <img> request cannot attach. Resolve those URLs through the authenticated API
 * client and hand the browser a local blob URL instead. Public, data, and blob
 * URLs pass through unchanged.
 */
export async function resolveAuthenticatedMediaUrl(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  const path = mediaPath(value);
  if (!path || !canCreateObjectUrl()) return value;

  const cached = resolvedMediaUrls.get(value);
  if (cached) return cached;
  const pending = pendingMediaUrls.get(value);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await cloudflareAuthorizedFetch(path);
      if (!response?.ok) return value;
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) return value;
      const objectUrl = URL.createObjectURL(blob);
      rememberResolvedMediaUrl(value, objectUrl);
      return objectUrl;
    } catch {
      return value;
    }
  })().finally(() => pendingMediaUrls.delete(value));

  pendingMediaUrls.set(value, request);
  return request;
}

/**
 * Ad-placement records persist the normal public media reference, but draft and
 * paused creative must not be publicly readable. Owners preview that same asset
 * through the authenticated account media endpoint and receive a browser-local
 * blob URL instead. SSR keeps the persisted URL untouched and never creates a
 * blob URL.
 */
export async function resolveOwnedMediaPreviewUrl(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  const protectedPath = ownerMediaPath(value);
  if (!protectedPath) return resolveAuthenticatedMediaUrl(value);
  return resolveAuthenticatedMediaUrl(protectedPath);
}
