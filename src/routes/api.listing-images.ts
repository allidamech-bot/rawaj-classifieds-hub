import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import {
  deleteR2Object,
  fromR2StoragePath,
  presignR2Get,
  putR2Object,
  readR2Config,
  toR2StoragePath,
} from "@/lib/server/r2-listing-images";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RAWAJ_SUPABASE_AUTH_HEADER = "x-rawaj-supabase-authorization";
const buildSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const buildSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

type AuthenticatedClientResult =
  | { ok: true; client: SupabaseClient; userId: string }
  | { ok: false; status: 401 | 503; code: string; message: string };

export const Route = createFileRoute("/api/listing-images")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const config = readR2Config();
        if (!config) return json({ error: "R2 is not configured.", code: "r2_unconfigured" }, 503);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        if (action === "sign") return handleSign(request, config);
        if (action === "upload") return handleUpload(request, url, config);
        return json({ error: "Unsupported action.", code: "unsupported_action" }, 400);
      },
      DELETE: async ({ request }: { request: Request }) => {
        const config = readR2Config();
        if (!config) return json({ error: "R2 is not configured.", code: "r2_unconfigured" }, 503);
        return handleDelete(request, config);
      },
    },
  },
});

async function handleUpload(
  request: Request,
  url: URL,
  config: NonNullable<ReturnType<typeof readR2Config>>,
) {
  const auth = await authenticatedClient(request);
  if (!auth.ok) return json({ error: auth.message, code: auth.code }, auth.status);

  const listingId = url.searchParams.get("listingId")?.trim() ?? "";
  if (!listingId) {
    return json({ error: "Listing id is required.", code: "listing_id_required" }, 400);
  }
  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: "Unsupported image type.", code: "unsupported_image_type" }, 415);
  }

  const { data: listing, error } = await auth.client
    .from("listings")
    .select("id,owner_id,status")
    .eq("id", listingId)
    .eq("owner_id", auth.userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();
  if (error || !listing) {
    return json({ error: "Listing is not editable.", code: "listing_not_editable" }, 403);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength <= 0 || body.byteLength > MAX_IMAGE_BYTES) {
    return json({ error: "Invalid image size.", code: "invalid_image_size" }, 413);
  }

  const extension =
    contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `${auth.userId}/${listingId}/${crypto.randomUUID()}.${extension}`;
  await putR2Object(config, key, body, contentType);
  return json({ storagePath: toR2StoragePath(key) }, 201);
}

async function handleSign(request: Request, config: NonNullable<ReturnType<typeof readR2Config>>) {
  const auth = await optionalClient(request);
  if (!auth) return json({ urls: {} });
  const payload = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = Array.isArray(payload?.paths)
    ? [
        ...new Set(
          payload.paths.filter(
            (value): value is string => typeof value === "string" && value.startsWith("r2:"),
          ),
        ),
      ].slice(0, 100)
    : [];
  if (paths.length === 0) return json({ urls: {} });

  const { data, error } = await auth.client
    .from("listing_images")
    .select("storage_path")
    .in("storage_path", paths);
  if (error) return json({ urls: {} });

  const allowed = new Set(
    ((data ?? []) as Array<{ storage_path?: unknown }>)
      .map((row) => row.storage_path)
      .filter((value): value is string => typeof value === "string" && value.startsWith("r2:")),
  );
  const entries = await Promise.all(
    paths
      .filter((path) => allowed.has(path))
      .map(async (path) => {
        const key = fromR2StoragePath(path)!;
        return [path, await presignR2Get(config, key)] as const;
      }),
  );
  return json({ urls: Object.fromEntries(entries) });
}

async function handleDelete(
  request: Request,
  config: NonNullable<ReturnType<typeof readR2Config>>,
) {
  const auth = await authenticatedClient(request);
  if (!auth.ok) return json({ error: auth.message, code: auth.code }, auth.status);
  const payload = (await request.json().catch(() => null)) as {
    listingId?: unknown;
    storagePath?: unknown;
  } | null;
  const listingId = typeof payload?.listingId === "string" ? payload.listingId.trim() : "";
  const storagePath = typeof payload?.storagePath === "string" ? payload.storagePath : "";
  const key = fromR2StoragePath(storagePath);
  if (!listingId || !key || !key.startsWith(`${auth.userId}/${listingId}/`)) {
    return json({ error: "Invalid image path.", code: "invalid_image_path" }, 400);
  }

  await deleteR2Object(config, key);
  return json({ ok: true });
}

async function authenticatedClient(request: Request): Promise<AuthenticatedClientResult> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "missing_access_token",
      message: "Authentication required.",
    };
  }

  const client = createAuthorizedClient(token);
  if (!client) {
    return {
      ok: false,
      status: 503,
      code: "server_supabase_unconfigured",
      message: "Supabase server configuration is unavailable.",
    };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      status: 401,
      code: "invalid_access_token",
      message: "Authentication required.",
    };
  }
  return { ok: true, client, userId: data.user.id };
}

async function optionalClient(request: Request) {
  const token = bearerToken(request);
  const client = createAuthorizedClient(token);
  return client ? { client } : null;
}

function createAuthorizedClient(token: string | null) {
  const config = readSupabasePublicConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

function readSupabasePublicConfig(): { url: string; key: string } | null {
  const url = firstUsableEnvironmentValue(
    runtimeEnvironment("SUPABASE_URL"),
    runtimeEnvironment("VITE_SUPABASE_URL"),
    buildSupabaseUrl,
  );
  const key = firstUsableEnvironmentValue(
    runtimeEnvironment("SUPABASE_ANON_KEY"),
    runtimeEnvironment("VITE_SUPABASE_ANON_KEY"),
    buildSupabaseAnonKey,
  );
  if (!url || !key) return null;
  return { url, key };
}

function runtimeEnvironment(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name]?.trim() || undefined;
}

function firstUsableEnvironmentValue(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    if (normalized === "https://YOUR_PROJECT_REF.supabase.co") continue;
    if (normalized === "YOUR_SUPABASE_ANON_KEY") continue;
    return normalized;
  }
  return null;
}

function bearerToken(request: Request) {
  const rawajHeader = request.headers.get(RAWAJ_SUPABASE_AUTH_HEADER) ?? "";
  const standardHeader = request.headers.get("authorization") ?? "";
  return parseBearerToken(rawajHeader) ?? parseBearerToken(standardHeader);
}

function parseBearerToken(header: string): string | null {
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
