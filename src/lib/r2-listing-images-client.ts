import type { SupabaseClient } from "@supabase/supabase-js";

export const R2_LISTING_IMAGE_PREFIX = "r2:";
const R2_API_PATH = "/api/listing-images";

export function isR2ListingImagePath(path: string | null | undefined): path is string {
  return Boolean(path?.startsWith(R2_LISTING_IMAGE_PREFIX));
}

export function r2ObjectKeyFromStoragePath(path: string): string {
  return isR2ListingImagePath(path) ? path.slice(R2_LISTING_IMAGE_PREFIX.length) : path;
}

export async function readSupabaseAccessToken(client: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function uploadListingImageToR2(input: {
  listingId: string;
  file: File;
  accessToken: string | null;
}): Promise<
  | { handled: false }
  | { handled: true; ok: true; storagePath: string }
  | { handled: true; ok: false; message: string }
> {
  try {
    const response = await fetch(
      `${R2_API_PATH}?action=upload&listingId=${encodeURIComponent(input.listingId)}&filename=${encodeURIComponent(input.file.name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": input.file.type,
          ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
        },
        body: input.file,
      },
    );

    if (response.status === 503) return { handled: false };
    const payload = (await response.json().catch(() => null)) as {
      storagePath?: unknown;
      error?: unknown;
    } | null;
    if (!response.ok || typeof payload?.storagePath !== "string") {
      return {
        handled: true,
        ok: false,
        message:
          typeof payload?.error === "string" ? payload.error : "تعذر رفع الصورة إلى مخزن الصور.",
      };
    }
    return { handled: true, ok: true, storagePath: payload.storagePath };
  } catch {
    return { handled: false };
  }
}

export async function deleteListingImageFromR2(input: {
  listingId: string;
  storagePath: string;
  accessToken: string | null;
}): Promise<boolean> {
  if (!isR2ListingImagePath(input.storagePath)) return false;
  try {
    const response = await fetch(R2_API_PATH, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
      },
      body: JSON.stringify({ listingId: input.listingId, storagePath: input.storagePath }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function signR2ListingImagePaths(
  paths: string[],
  accessToken: string | null,
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter(isR2ListingImagePath))];
  if (uniquePaths.length === 0) return new Map();

  const endpoint = resolveR2ApiUrl("sign");
  if (!endpoint) return new Map();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ paths: uniquePaths }),
    });
    if (!response.ok) return new Map();
    const payload = (await response.json()) as { urls?: Record<string, unknown> };
    return new Map(
      Object.entries(payload.urls ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
      ),
    );
  } catch {
    return new Map();
  }
}

function resolveR2ApiUrl(action: string): string | null {
  const path = `${R2_API_PATH}?action=${encodeURIComponent(action)}`;
  if (typeof window !== "undefined") return path;

  const deploymentHost =
    typeof process !== "undefined"
      ? process.env.VERCEL_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      : "";
  if (!deploymentHost) return null;
  const origin = /^https?:\/\//i.test(deploymentHost)
    ? deploymentHost
    : `https://${deploymentHost}`;
  return new URL(path, origin).toString();
}
