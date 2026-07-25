import {
  authenticate,
  corsHeaders,
  json,
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
}

export async function handleNotifications(
  request: Request,
  env: NotificationsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/v1/account/notifications")) return null;

  const cors = corsHeaders(request, env as unknown as AuthEnv);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

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

async function getNotification(
  request: Request,
  env: NotificationsEnv,
  cors: Headers,
  id: string,
) {
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

async function markRead(
  request: Request,
  env: NotificationsEnv,
  cors: Headers,
  id: string,
) {
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

function unauthorized(cors: Headers) {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function databaseError(cors: Headers) {
  return json({ error: { code: "database_unavailable", message: "Data service unavailable." } }, 503, cors);
}
function integer(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
function clean(value: string | null, max: number) {
  const text = value?.trim() ?? "";
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
