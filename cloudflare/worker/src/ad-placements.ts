import {
  authenticate,
  corsHeaders,
  json,
  readJson,
  requireMutationAuth,
  type AuthEnv,
} from "./auth";

type Value = string | number | null;
type Row = Record<string, unknown>;
interface Result<T = Row> {
  results?: T[];
  success: boolean;
  error?: string;
}
interface Statement {
  bind(...values: Value[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<Result<T>>;
  run(): Promise<Result>;
}
interface Database {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
}
interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<{ httpEtag: string }>;
  delete(key: string): Promise<void>;
}

export interface AdPlacementsEnv {
  DB: Database;
  MEDIA: R2Bucket;
  API_ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_AUTH_TEST_JWKS?: string;
  SUPABASE_JWKS_URL?: string;
}

const PAGE_VALUES = new Set(["home", "search_results", "listing_detail", "categories", "offers"]);
const STATUS_VALUES = new Set(["draft", "active", "paused"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function asAuthEnv(env: AdPlacementsEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleAdPlacements(
  request: Request,
  env: AdPlacementsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!path.startsWith("/v1/admin/ad-placements")) return null;

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/admin/ad-placements" && request.method === "GET") {
    return listPlacements(request, env, cors);
  }
  if (path === "/v1/admin/ad-placements" && request.method === "POST") {
    return savePlacement(request, env, cors, null);
  }
  if (path === "/v1/admin/ad-placements/media" && request.method === "POST") {
    return uploadMedia(request, env, cors);
  }

  const statusMatch = path.match(/^\/v1\/admin\/ad-placements\/([^/]+)\/status$/);
  if (statusMatch && request.method === "PATCH") {
    return setStatus(request, env, cors, decodeURIComponent(statusMatch[1]));
  }

  const itemMatch = path.match(/^\/v1\/admin\/ad-placements\/([^/]+)$/);
  if (itemMatch && (request.method === "PATCH" || request.method === "PUT")) {
    return savePlacement(request, env, cors, decodeURIComponent(itemMatch[1]));
  }
  if (itemMatch && request.method === "DELETE") {
    return deletePlacement(request, env, cors, decodeURIComponent(itemMatch[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function listPlacements(request: Request, env: AdPlacementsEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isOwner(auth.roles)) return forbidden(cors);

  const result = await env.DB.prepare(
    `SELECT p.id, p.name, p.placement_page, p.destination_url, p.starts_at, p.ends_at,
            p.status, p.priority, p.target_mobile, p.target_desktop, p.version,
            p.created_at, p.updated_at, p.media_asset_id
       FROM ad_placements p
      ORDER BY p.updated_at DESC, p.id DESC`,
  ).all<Row>();
  if (!result.success) return databaseError(cors);

  const data = (result.results ?? []).map((row) => mapPlacement(row, request.url));
  return json({ data }, 200, cors);
}

async function uploadMedia(request: Request, env: AdPlacementsEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isOwner(auth.roles)) return forbidden(cors);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return validation(cors, "Invalid multipart upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || !IMAGE_TYPES.has(file.type) || file.size <= 0) {
    return validation(cors, "Upload a valid JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_IMAGE_BYTES) return validation(cors, "Image must not exceed 8MB.");

  const id = crypto.randomUUID();
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const objectKey = `ad-placements/${auth.userId}/${id}.${extension}`;
  const now = new Date().toISOString();
  const bytes = await file.arrayBuffer();

  let etag = "";
  try {
    const stored = await env.MEDIA.put(objectKey, bytes, {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
    });
    etag = stored.httpEtag;
  } catch {
    return json({ error: { code: "storage_error", message: "Image upload failed." } }, 502, cors);
  }

  const inserted = await env.DB.prepare(
    `INSERT INTO media_assets
      (id, owner_id, object_key, content_type, byte_size, checksum_sha256, etag,
       status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`,
  )
    .bind(id, auth.userId, objectKey, file.type, file.size, `r2-etag:${etag}`, etag, now, now)
    .run();
  if (!inserted.success) {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    return databaseError(cors);
  }

  return json({ data: { id, imageUrl: mediaUrl(request.url, id) } }, 201, cors);
}

async function savePlacement(
  request: Request,
  env: AdPlacementsEnv,
  cors: Headers,
  pathId: string | null,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isOwner(auth.roles)) return forbidden(cors);

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const payload = normalizePayload(body.data);
  if (!payload) return validation(cors, "Invalid ad placement fields.");
  const id = pathId ?? clean(body.data.id, 120) ?? crypto.randomUUID();
  const mediaAssetId = mediaAssetIdFromUrl(payload.imageUrl);
  if (!mediaAssetId) return validation(cors, "Invalid ad image reference.");

  const media = await env.DB.prepare(
    "SELECT id, status FROM media_assets WHERE id = ? AND status = 'ready'",
  )
    .bind(mediaAssetId)
    .first<{ id: string; status: string }>();
  if (!media) return validation(cors, "Ad image is unavailable.");

  const now = new Date().toISOString();
  if (pathId) {
    const expectedVersion = integer(body.data.expectedVersion, 0);
    if (expectedVersion < 1) return validation(cors, "Expected version is required.");
    const updated = await env.DB.prepare(
      `UPDATE ad_placements
          SET name = ?, placement_page = ?, media_asset_id = ?, destination_url = ?,
              starts_at = ?, ends_at = ?, status = ?, priority = ?, target_mobile = ?,
              target_desktop = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`,
    )
      .bind(
        payload.name,
        payload.placementPage,
        mediaAssetId,
        payload.destinationUrl,
        payload.startsAt,
        payload.endsAt,
        payload.status,
        payload.priority,
        payload.targetMobile ? 1 : 0,
        payload.targetDesktop ? 1 : 0,
        now,
        id,
        expectedVersion,
      )
      .run();
    if (!updated.success) return databaseError(cors);
    const row = await env.DB.prepare("SELECT version, updated_at FROM ad_placements WHERE id = ?")
      .bind(id)
      .first<{ version: number; updated_at: string }>();
    if (!row || row.version === expectedVersion) {
      return json(
        { error: { code: "stale_ad_placement", message: "Placement changed. Reload and retry." } },
        409,
        cors,
      );
    }
    await audit(env, auth.userId, "ad_placement.update", id, { version: row.version });
    return json({ data: { id, version: row.version, updatedAt: row.updated_at } }, 200, cors);
  }

  const inserted = await env.DB.prepare(
    `INSERT INTO ad_placements
      (id, name, placement_page, media_asset_id, destination_url, starts_at, ends_at,
       status, priority, target_mobile, target_desktop, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(
      id,
      payload.name,
      payload.placementPage,
      mediaAssetId,
      payload.destinationUrl,
      payload.startsAt,
      payload.endsAt,
      payload.status,
      payload.priority,
      payload.targetMobile ? 1 : 0,
      payload.targetDesktop ? 1 : 0,
      now,
      now,
    )
    .run();
  if (!inserted.success) return databaseError(cors);
  await audit(env, auth.userId, "ad_placement.create", id, { version: 1 });
  return json({ data: { id, version: 1, updatedAt: now } }, 201, cors);
}

async function setStatus(request: Request, env: AdPlacementsEnv, cors: Headers, id: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isOwner(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const status = clean(body.data.status, 20);
  const reason = clean(body.data.reason, 500);
  const expectedVersion = integer(body.data.expectedVersion, 0);
  if (
    !status ||
    !STATUS_VALUES.has(status) ||
    !reason ||
    reason.length < 3 ||
    expectedVersion < 1
  ) {
    return validation(cors, "Invalid status change.");
  }
  const now = new Date().toISOString();
  const updated = await env.DB.prepare(
    `UPDATE ad_placements SET status = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`,
  )
    .bind(status, now, id, expectedVersion)
    .run();
  if (!updated.success) return databaseError(cors);
  const row = await env.DB.prepare("SELECT version, updated_at FROM ad_placements WHERE id = ?")
    .bind(id)
    .first<{ version: number; updated_at: string }>();
  if (!row || row.version === expectedVersion) {
    return json(
      { error: { code: "stale_ad_placement", message: "Placement changed. Reload and retry." } },
      409,
      cors,
    );
  }
  await audit(env, auth.userId, "ad_placement.status", id, {
    status,
    reason,
    version: row.version,
  });
  return json({ data: { id, version: row.version, updatedAt: row.updated_at } }, 200, cors);
}

async function deletePlacement(request: Request, env: AdPlacementsEnv, cors: Headers, id: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isOwner(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const expectedVersion = integer(body.data.expectedVersion, 0);
  const reason = clean(body.data.reason, 500);
  if (expectedVersion < 1 || !reason || reason.length < 3)
    return validation(cors, "Invalid delete request.");

  const existing = await env.DB.prepare(
    `SELECT p.media_asset_id, m.object_key
       FROM ad_placements p JOIN media_assets m ON m.id = p.media_asset_id
      WHERE p.id = ? AND p.version = ?`,
  )
    .bind(id, expectedVersion)
    .first<{ media_asset_id: string; object_key: string }>();
  if (!existing)
    return json(
      { error: { code: "stale_ad_placement", message: "Placement changed. Reload and retry." } },
      409,
      cors,
    );

  const deleted = await env.DB.prepare("DELETE FROM ad_placements WHERE id = ? AND version = ?")
    .bind(id, expectedVersion)
    .run();
  if (!deleted.success) return databaseError(cors);
  await audit(env, auth.userId, "ad_placement.delete", id, { reason, version: expectedVersion });

  const inUse = await env.DB.prepare(
    "SELECT id FROM ad_placements WHERE media_asset_id = ? LIMIT 1",
  )
    .bind(existing.media_asset_id)
    .first<{ id: string }>();
  if (!inUse) {
    await env.MEDIA.delete(existing.object_key).catch(() => undefined);
    await env.DB.prepare("UPDATE media_assets SET status = 'deleted', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), existing.media_asset_id)
      .run();
  }

  return json(
    {
      data: {
        id,
        imageUrl: mediaUrl(request.url, existing.media_asset_id),
        storagePath: existing.object_key,
      },
    },
    200,
    cors,
  );
}

function normalizePayload(body: Row) {
  const name = clean(body.name, 160);
  const placementPage = clean(body.placementPage, 40);
  const imageUrl = clean(body.imageUrl, 2048);
  const destinationUrl = clean(body.destinationUrl, 2048);
  const status = clean(body.status, 20);
  const startsAt = nullableDate(body.startsAt);
  const endsAt = nullableDate(body.endsAt);
  const priority = integer(body.priority, 0);
  const targetMobile = body.targetMobile === true;
  const targetDesktop = body.targetDesktop === true;
  if (
    !name ||
    name.length < 2 ||
    !placementPage ||
    !PAGE_VALUES.has(placementPage) ||
    !imageUrl ||
    !destinationUrl ||
    !safeHttps(destinationUrl) ||
    !status ||
    !STATUS_VALUES.has(status) ||
    (!targetMobile && !targetDesktop) ||
    (startsAt && endsAt && startsAt >= endsAt)
  )
    return null;
  return {
    name,
    placementPage,
    imageUrl,
    destinationUrl,
    startsAt,
    endsAt,
    status,
    priority,
    targetMobile,
    targetDesktop,
  };
}

function mapPlacement(row: Row, requestUrl: string) {
  const mediaAssetId = stringValue(row.media_asset_id);
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    placementPage: stringValue(row.placement_page, "home"),
    imageUrl: mediaUrl(requestUrl, mediaAssetId),
    destinationUrl: stringValue(row.destination_url),
    startsAt: nullableString(row.starts_at),
    endsAt: nullableString(row.ends_at),
    status: stringValue(row.status, "draft"),
    priority: numberValue(row.priority),
    targetMobile: booleanValue(row.target_mobile),
    targetDesktop: booleanValue(row.target_desktop),
    version: numberValue(row.version, 1),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

async function audit(
  env: AdPlacementsEnv,
  actorId: string,
  action: string,
  id: string,
  metadata: Row,
) {
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, 'ad_placement', ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      actorId,
      action,
      id,
      JSON.stringify(metadata),
      new Date().toISOString(),
    )
    .run();
}

function mediaAssetIdFromUrl(value: string): string | null {
  try {
    const path = new URL(value).pathname;
    const match = path.match(/^\/v1\/media\/assets\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function mediaUrl(requestUrl: string, id: string): string {
  return new URL(`/v1/media/assets/${encodeURIComponent(id)}`, requestUrl).toString();
}
function isOwner(roles: string[]) {
  return roles.includes("owner");
}
function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function nullableDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
function safeHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
function integer(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) ? number : fallback;
}
function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}
function numberValue(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function booleanValue(value: unknown) {
  return value === true || value === 1 || value === "1";
}
function unauthorized(cors: Headers) {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers) {
  return json(
    { error: { code: "permission_denied", message: "Owner permission required." } },
    403,
    cors,
  );
}
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
