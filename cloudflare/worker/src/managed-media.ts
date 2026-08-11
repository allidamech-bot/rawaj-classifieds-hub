import { authenticate, corsHeaders, json, type AuthEnv } from "./auth";

type Value = string | number | null;
type Row = Record<string, unknown>;
interface Result<T = Row> {
  results?: T[];
  success: boolean;
}
interface Statement {
  bind(...values: Value[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<Result<T>>;
}
interface Database {
  prepare(query: string): Statement;
}
interface R2Object {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

export interface ManagedMediaEnv {
  DB: Database;
  MEDIA: R2Bucket;
  API_ALLOWED_ORIGINS?: string;
}

function asAuthEnv(env: ManagedMediaEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleManagedMedia(
  request: Request,
  env: ManagedMediaEnv,
): Promise<Response | null> {
  if (request.method !== "GET") return null;
  const path = new URL(request.url).pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));

  const publicAsset = path.match(/^\/v1\/media\/assets\/([^/]+)$/);
  if (publicAsset) {
    return publicAdPlacementMedia(env, cors, decodeURIComponent(publicAsset[1]));
  }

  const adminImages = path.match(/^\/v1\/admin\/listings\/([^/]+)\/images$/);
  if (adminImages) {
    const auth = await authenticate(request, asAuthEnv(env));
    if (!auth) return unauthorized(cors);
    if (!hasModeratorRole(auth.roles)) return forbidden(cors);
    const listingId = decodeURIComponent(adminImages[1]);
    const images = await env.DB.prepare(
      `SELECT li.id, li.listing_id, li.media_asset_id, li.alt_ar, li.sort_order, li.created_at
         FROM listing_images li
         JOIN media_assets m ON m.id = li.media_asset_id
        WHERE li.listing_id = ? AND m.status = 'ready'
        ORDER BY li.sort_order, li.id`,
    )
      .bind(listingId)
      .all<Row>();
    if (!images.success) return databaseError(cors);
    return json(
      {
        data: (images.results ?? []).map((image) => ({
          id: stringValue(image.id),
          listingId: stringValue(image.listing_id),
          mediaAssetId: stringValue(image.media_asset_id),
          storagePath: null,
          publicUrl: `/v1/admin/media/assets/${encodeURIComponent(stringValue(image.media_asset_id))}`,
          altAr: nullableString(image.alt_ar),
          sortOrder: numberValue(image.sort_order),
          createdAt: stringValue(image.created_at),
        })),
      },
      200,
      cors,
    );
  }

  const adminAsset = path.match(/^\/v1\/admin\/media\/assets\/([^/]+)$/);
  if (adminAsset) {
    const auth = await authenticate(request, asAuthEnv(env));
    if (!auth) return unauthorized(cors);
    if (!hasModeratorRole(auth.roles)) return forbidden(cors);
    return adminListingMedia(env, cors, decodeURIComponent(adminAsset[1]));
  }

  return null;
}

async function publicAdPlacementMedia(
  env: ManagedMediaEnv,
  cors: Headers,
  assetId: string,
): Promise<Response | null> {
  const asset = await env.DB.prepare(
    `SELECT object_key, content_type, etag
       FROM media_assets
      WHERE id = ? AND status = 'ready' AND object_key LIKE 'ad-placements/%'
      LIMIT 1`,
  )
    .bind(assetId)
    .first<Row>();
  if (!asset) return null;
  return readObject(env, cors, asset, "public, max-age=31536000, immutable");
}

async function adminListingMedia(
  env: ManagedMediaEnv,
  cors: Headers,
  assetId: string,
): Promise<Response> {
  const asset = await env.DB.prepare(
    `SELECT m.object_key, m.content_type, m.etag
       FROM media_assets m
      WHERE m.id = ? AND m.status = 'ready'
        AND EXISTS (
          SELECT 1 FROM listing_images li WHERE li.media_asset_id = m.id
        )
      LIMIT 1`,
  )
    .bind(assetId)
    .first<Row>();
  if (!asset) return notFound(cors);
  return (await readObject(env, cors, asset, "private, no-store")) ?? notFound(cors);
}

async function readObject(
  env: ManagedMediaEnv,
  cors: Headers,
  asset: Row,
  cacheControl: string,
): Promise<Response | null> {
  const objectKey = nullableString(asset.object_key);
  if (!objectKey) return null;
  const object = await env.MEDIA.get(objectKey);
  if (!object) return null;

  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  const contentType = nullableString(asset.content_type);
  if (contentType) headers.set("Content-Type", contentType);
  headers.set("Cache-Control", cacheControl);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("ETag", nullableString(asset.etag) ?? object.httpEtag);
  return new Response(object.body, { status: 200, headers });
}

function hasModeratorRole(roles: string[]): boolean {
  return roles.some((role) => role === "moderator" || role === "admin" || role === "owner");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function unauthorized(cors: Headers) {
  return json({ error: { code: "unauthorized", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers) {
  return json({ error: { code: "forbidden", message: "Insufficient permissions." } }, 403, cors);
}
function notFound(cors: Headers) {
  return json({ error: { code: "not_found", message: "Media not found." } }, 404, cors);
}
function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
