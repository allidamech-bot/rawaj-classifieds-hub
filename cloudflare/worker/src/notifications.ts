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
}
interface Statement {
  bind(...values: Value[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<Result<T>>;
  run(): Promise<Result>;
}
interface Database {
  prepare(query: string): Statement;
}

export interface NotificationsEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  PUSH_TOKEN_ENCRYPTION_KEY?: string;
}

const PREFERENCE_COLUMNS = {
  messagesEnabled: "messages_enabled",
  priceChangesEnabled: "price_changes_enabled",
  savedSearchMatchesEnabled: "saved_search_matches_enabled",
  listingStatusEnabled: "listing_status_enabled",
  reviewsEnabled: "reviews_enabled",
  promotionsEnabled: "promotions_enabled",
} as const;

const PREFERENCE_SELECT = `push_enabled, messages_enabled, price_changes_enabled,
  saved_search_matches_enabled, listing_status_enabled, reviews_enabled,
  promotions_enabled, updated_at`;
const PUSH_PLATFORMS = new Set(["android", "ios", "web"]);
const PUSH_PERMISSION_STATUSES = new Set(["granted", "denied", "prompt"]);

export async function handleNotifications(
  request: Request,
  env: NotificationsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/v1/account/notifications") &&
      !path.startsWith("/v1/account/notification-preferences") &&
      !path.startsWith("/v1/account/push-devices")) {
    return null;
  }

  const cors = corsHeaders(request, env as unknown as AuthEnv);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/account/notification-preferences") {
    if (request.method === "GET") return getPreferences(request, env, cors);
    if (request.method === "PATCH") return updatePreference(request, env, cors);
  }

  if (path === "/v1/account/push-devices/status" && request.method === "GET") {
    return pushChannelStatus(request, env, cors, url);
  }
  if (path === "/v1/account/push-devices" && request.method === "POST") {
    return registerPushDevice(request, env, cors);
  }
  const pushDevice = path.match(/^\/v1\/account\/push-devices\/([^/]+)$/);
  if (pushDevice && request.method === "DELETE") {
    return disablePushDevice(
      request,
      env,
      cors,
      decodeURIComponent(pushDevice[1]),
      url.searchParams.get("disableChannel") !== "false",
    );
  }

  if (path === "/v1/account/notifications" && request.method === "GET") {
    return listNotifications(request, env, cors, url);
  }
  if (path === "/v1/account/notifications/unread-count" && request.method === "GET") {
    return unreadCount(request, env, cors);
  }
  if (path === "/v1/account/notifications/read-all" && request.method === "POST") {
    return markAllRead(request, env, cors);
  }

  const match = path.match(/^\/v1\/account\/notifications\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (request.method === "GET") return getNotification(request, env, cors, id);
    if (request.method === "PATCH" || request.method === "POST") {
      return markRead(request, env, cors, id);
    }
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function getPreferences(request: Request, env: NotificationsEnv, cors: Headers) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    `SELECT ${PREFERENCE_SELECT} FROM notification_preferences WHERE user_id = ?`,
  )
    .bind(auth.userId)
    .first<Row>();
  return json({ data: row ? preferenceRow(row) : defaultPreferences() }, 200, cors);
}

async function updatePreference(request: Request, env: NotificationsEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const key = typeof body.data.key === "string" ? body.data.key : "";
  const column = PREFERENCE_COLUMNS[key as keyof typeof PREFERENCE_COLUMNS];
  if (!column || typeof body.data.enabled !== "boolean") {
    return validation(cors, "Invalid notification preference.");
  }
  const timestamp = now();
  const enabled = body.data.enabled ? 1 : 0;
  const result = await env.DB.prepare(
    `INSERT INTO notification_preferences
      (user_id, push_enabled, messages_enabled, listing_updates_enabled, marketing_enabled,
       ${column}, updated_at)
     VALUES (?, 0, 1, 1, 0, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at`,
  )
    .bind(auth.userId, enabled, timestamp)
    .run();
  return result.success ? getPreferences(request, env, cors) : databaseError(cors);
}

async function pushChannelStatus(
  request: Request,
  env: NotificationsEnv,
  cors: Headers,
  url: URL,
) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const deviceKey = clean(url.searchParams.get("deviceKey"), 200);
  if (!deviceKey || deviceKey.length < 8) return validation(cors, "Invalid device key.");
  const deviceKeyHash = await sha256Hex(deviceKey);
  const [device, preference] = await Promise.all([
    env.DB.prepare(
      `SELECT platform, permission_status, active, last_seen_at FROM push_devices
       WHERE user_id = ? AND device_key_hash = ? LIMIT 1`,
    )
      .bind(auth.userId, deviceKeyHash)
      .first<Row>(),
    env.DB.prepare("SELECT push_enabled FROM notification_preferences WHERE user_id = ?")
      .bind(auth.userId)
      .first<Row>(),
  ]);
  return json(
    {
      data: {
        pushEnabled: booleanValue(preference?.push_enabled, false),
        registered: Boolean(device && booleanValue(device.active, false)),
        permissionStatus: permissionValue(device?.permission_status),
        platform: platformValue(device?.platform),
        lastSeenAt: nullableString(device?.last_seen_at),
      },
    },
    200,
    cors,
  );
}

async function registerPushDevice(request: Request, env: NotificationsEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  if (!env.PUSH_TOKEN_ENCRYPTION_KEY || env.PUSH_TOKEN_ENCRYPTION_KEY.length < 32) {
    return json(
      { error: { code: "setup_required", message: "Push registration is not configured." } },
      503,
      cors,
    );
  }
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const deviceKey = clean(body.data.deviceKey, 200);
  const deviceToken = clean(body.data.deviceToken, 4096);
  const platform = platformValue(body.data.platform);
  const permissionStatus = permissionValue(body.data.permissionStatus);
  const appVersion = clean(body.data.appVersion, 80);
  const locale = clean(body.data.locale, 20);
  if (!deviceKey || deviceKey.length < 8 || !deviceToken || deviceToken.length < 20) {
    return validation(cors, "Invalid push device registration.");
  }

  const [deviceKeyHash, tokenHash, encryptedToken] = await Promise.all([
    sha256Hex(deviceKey),
    sha256Hex(deviceToken),
    encryptToken(deviceToken, env.PUSH_TOKEN_ENCRYPTION_KEY),
  ]);
  const existing = await env.DB.prepare(
    `SELECT id FROM push_devices
     WHERE token_hash = ? OR (user_id = ? AND device_key_hash = ?)
     ORDER BY CASE WHEN token_hash = ? THEN 0 ELSE 1 END LIMIT 1`,
  )
    .bind(tokenHash, auth.userId, deviceKeyHash, tokenHash)
    .first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const timestamp = now();
  const active = permissionStatus === "granted" ? 1 : 0;
  const result = existing
    ? await env.DB.prepare(
        `UPDATE push_devices SET user_id = ?, platform = ?, token_hash = ?, encrypted_token = ?,
          active = ?, device_key_hash = ?, permission_status = ?, app_version = ?, locale = ?,
          last_seen_at = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(
          auth.userId,
          platform,
          tokenHash,
          encryptedToken,
          active,
          deviceKeyHash,
          permissionStatus,
          appVersion,
          locale,
          timestamp,
          timestamp,
          id,
        )
        .run()
    : await env.DB.prepare(
        `INSERT INTO push_devices
          (id, user_id, platform, token_hash, encrypted_token, active, created_at, updated_at,
           device_key_hash, permission_status, app_version, locale, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          auth.userId,
          platform,
          tokenHash,
          encryptedToken,
          active,
          timestamp,
          timestamp,
          deviceKeyHash,
          permissionStatus,
          appVersion,
          locale,
          timestamp,
        )
        .run();
  if (!result.success) return databaseError(cors);

  if (permissionStatus === "granted") {
    const preference = await env.DB.prepare(
      `INSERT INTO notification_preferences
        (user_id, push_enabled, messages_enabled, listing_updates_enabled, marketing_enabled, updated_at)
       VALUES (?, 1, 1, 1, 0, ?)
       ON CONFLICT(user_id) DO UPDATE SET push_enabled = 1, updated_at = excluded.updated_at`,
    )
      .bind(auth.userId, timestamp)
      .run();
    if (!preference.success) return databaseError(cors);
  }

  return json({ data: id }, existing ? 200 : 201, cors);
}

async function disablePushDevice(
  request: Request,
  env: NotificationsEnv,
  cors: Headers,
  deviceKey: string,
  disableChannel: boolean,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const cleanDeviceKey = deviceKey.trim();
  if (cleanDeviceKey.length < 8 || cleanDeviceKey.length > 200) {
    return validation(cors, "Invalid device key.");
  }
  const deviceKeyHash = await sha256Hex(cleanDeviceKey);
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE push_devices SET active = 0, permission_status = 'denied',
      last_seen_at = ?, updated_at = ? WHERE user_id = ? AND device_key_hash = ?`,
  )
    .bind(timestamp, timestamp, auth.userId, deviceKeyHash)
    .run();
  if (!result.success) return databaseError(cors);
  if (disableChannel) {
    const preference = await env.DB.prepare(
      `INSERT INTO notification_preferences
        (user_id, push_enabled, messages_enabled, listing_updates_enabled, marketing_enabled, updated_at)
       VALUES (?, 0, 1, 1, 0, ?)
       ON CONFLICT(user_id) DO UPDATE SET push_enabled = 0, updated_at = excluded.updated_at`,
    )
      .bind(auth.userId, timestamp)
      .run();
    if (!preference.success) return databaseError(cors);
  }
  return json({ data: true }, 200, cors);
}

async function listNotifications(
  request: Request,
  env: NotificationsEnv,
  cors: Headers,
  url: URL,
) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const limit = integer(url.searchParams.get("limit"), 20, 1, 50);
  const cursorAt = clean(url.searchParams.get("cursorAt"), 80);
  const cursorId = clean(url.searchParams.get("cursorId"), 120);
  const cursorClause = cursorAt && cursorId ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : "";
  const statement = env.DB.prepare(
    `SELECT id, type, title, body, data, read_at, created_at
       FROM notifications
      WHERE user_id = ? ${cursorClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
  );
  const result = cursorClause
    ? await statement.bind(auth.userId, cursorAt, cursorAt, cursorId, limit + 1).all<Row>()
    : await statement.bind(auth.userId, limit + 1).all<Row>();
  if (!result.success) return databaseError(cors);
  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  return json(
    {
      data: {
        items: visible.map(notificationRow),
        hasMore,
        nextCursor:
          hasMore && visible.length
            ? {
                createdAt: stringValue(visible[visible.length - 1].created_at),
                id: stringValue(visible[visible.length - 1].id),
              }
            : null,
      },
    },
    200,
    cors,
  );
}

async function getNotification(request: Request, env: NotificationsEnv, cors: Headers, id: string) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    "SELECT id, type, title, body, data, read_at, created_at FROM notifications WHERE id = ? AND user_id = ?",
  )
    .bind(id, auth.userId)
    .first<Row>();
  return json({ data: row ? notificationRow(row) : null }, 200, cors);
}

async function unreadCount(request: Request, env: NotificationsEnv, cors: Headers) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    "SELECT count(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL",
  )
    .bind(auth.userId)
    .first<{ count: number }>();
  return json({ data: Math.max(0, Number(row?.count ?? 0)) }, 200, cors);
}

async function markRead(request: Request, env: NotificationsEnv, cors: Headers, id: string) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const result = await env.DB.prepare(
    "UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?",
  )
    .bind(now(), id, auth.userId)
    .run();
  return result.success ? json({ data: null }, 200, cors) : databaseError(cors);
}

async function markAllRead(request: Request, env: NotificationsEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const cutoff = now();
  const result = await env.DB.prepare(
    "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND created_at <= ?",
  )
    .bind(cutoff, auth.userId, cutoff)
    .run();
  return result.success
    ? json({ data: { cutoff, updatedCount: null } }, 200, cors)
    : databaseError(cors);
}

function preferenceRow(row: Row) {
  return {
    pushEnabled: booleanValue(row.push_enabled, false),
    messagesEnabled: booleanValue(row.messages_enabled, true),
    priceChangesEnabled: booleanValue(row.price_changes_enabled, true),
    savedSearchMatchesEnabled: booleanValue(row.saved_search_matches_enabled, true),
    listingStatusEnabled: booleanValue(row.listing_status_enabled, true),
    reviewsEnabled: booleanValue(row.reviews_enabled, true),
    promotionsEnabled: booleanValue(row.promotions_enabled, true),
    updatedAt: nullableString(row.updated_at),
  };
}

function defaultPreferences() {
  return {
    pushEnabled: false,
    messagesEnabled: true,
    priceChangesEnabled: true,
    savedSearchMatchesEnabled: true,
    listingStatusEnabled: true,
    reviewsEnabled: true,
    promotionsEnabled: true,
    updatedAt: null,
  };
}

function notificationRow(row: Row) {
  const data = jsonRecord(row.data);
  const targetType = nullableString(data.targetType ?? data.target_type);
  const targetId = nullableString(data.targetId ?? data.target_id);
  return {
    id: stringValue(row.id),
    type: stringValue(row.type, "system.notice"),
    titleAr: stringValue(row.title),
    titleEn: nullableString(data.titleEn ?? data.title_en),
    bodyAr: nullableString(row.body),
    bodyEn: nullableString(data.bodyEn ?? data.body_en),
    targetType: targetId ? targetType : null,
    targetId: targetId ?? null,
    readAt: nullableString(row.read_at),
    createdAt: stringValue(row.created_at),
  };
}

async function encryptToken(token: string, secret: string): Promise<string> {
  const secretDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", secretDigest, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  );
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);
  return base64Url(payload);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function permissionValue(value: unknown): "granted" | "denied" | "prompt" {
  return typeof value === "string" && PUSH_PERMISSION_STATUSES.has(value)
    ? (value as "granted" | "denied" | "prompt")
    : "prompt";
}
function platformValue(value: unknown): "android" | "ios" | "web" {
  return typeof value === "string" && PUSH_PLATFORMS.has(value)
    ? (value as "android" | "ios" | "web")
    : "android";
}
function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return fallback;
}
function unauthorized(cors: Headers) {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function databaseError(cors: Headers) {
  return json({ error: { code: "database_unavailable", message: "Data service unavailable." } }, 503, cors);
}
function integer(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
function clean(value: unknown, max: number): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}
function now() {
  return new Date().toISOString();
}
function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}
function jsonRecord(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Row) : {};
  } catch {
    return {};
  }
}
