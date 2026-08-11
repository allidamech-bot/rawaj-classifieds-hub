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

function rememberResolvedMediaUrl(source: string, objectUrl: string): void {
  resolvedMediaUrls.set(source, objectUrl);
  while (resolvedMediaUrls.size > MAX_RESOLVED_MEDIA_URLS) {
    const oldest = resolvedMediaUrls.entries().next().value as [string, string] | undefined;
    if (!oldest) break;
    resolvedMediaUrls.delete(oldest[0]);
    URL.revokeObjectURL(oldest[1]);
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
  if (!path) return value;

  const cached = resolvedMediaUrls.get(value);
  if (cached) return cached;
  const pending = pendingMediaUrls.get(value);
  if (pending) return pending;

  const request = (async () => {
    const response = await cloudflareAuthorizedFetch(path);
    if (!response?.ok) return value;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return value;
    const objectUrl = URL.createObjectURL(blob);
    rememberResolvedMediaUrl(value, objectUrl);
    return objectUrl;
  })().finally(() => pendingMediaUrls.delete(value));

  pendingMediaUrls.set(value, request);
  return request;
}
