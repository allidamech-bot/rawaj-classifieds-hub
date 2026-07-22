import { createClient } from "@supabase/supabase-js";
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

export const Route = createFileRoute("/api/listing-images")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const config = readR2Config();
        if (!config) return json({ error: "R2 is not configured." }, 503);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        if (action === "sign") return handleSign(request, config);
        if (action === "upload") return handleUpload(request, url, config);
        return json({ error: "Unsupported action." }, 400);
      },
      DELETE: async ({ request }: { request: Request }) => {
        const config = readR2Config();
        if (!config) return json({ error: "R2 is not configured." }, 503);
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
  if (!auth) return json({ error: "Authentication required." }, 401);

  const listingId = url.searchParams.get("listingId")?.trim() ?? "";
  if (!listingId) return json({ error: "Listing id is required." }, 400);
  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: "Unsupported image type." }, 415);
  }

  const { data: listing, error } = await auth.client
    .from("listings")
    .select("id,owner_id,status")
    .eq("id", listingId)
    .eq("owner_id", auth.userId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();
  if (error || !listing) return json({ error: "Listing is not editable." }, 403);

  const body = await request.arrayBuffer();
  if (body.byteLength <= 0 || body.byteLength > MAX_IMAGE_BYTES) {
    return json({ error: "Invalid image size." }, 413);
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
  if (!auth) return json({ error: "Authentication required." }, 401);
  const payload = (await request.json().catch(() => null)) as {
    listingId?: unknown;
    storagePath?: unknown;
  } | null;
  const listingId = typeof payload?.listingId === "string" ? payload.listingId.trim() : "";
  const storagePath = typeof payload?.storagePath === "string" ? payload.storagePath : "";
  const key = fromR2StoragePath(storagePath);
  if (!listingId || !key || !key.startsWith(`${auth.userId}/${listingId}/`)) {
    return json({ error: "Invalid image path." }, 400);
  }

  await deleteR2Object(config, key);
  return json({ ok: true });
}

async function authenticatedClient(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const client = createAuthorizedClient(token);
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

async function optionalClient(request: Request) {
  const token = bearerToken(request);
  const client = createAuthorizedClient(token);
  return client ? { client } : null;
}

function createAuthorizedClient(token: string | null) {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
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
