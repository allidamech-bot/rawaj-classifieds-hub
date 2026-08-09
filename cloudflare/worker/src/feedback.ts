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
  meta?: { changes?: number };
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

export interface FeedbackEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

const FEEDBACK_TYPES = new Set(["complaint", "suggestion", "technical_issue", "other"]);
const FEEDBACK_STATUSES = new Set(["new", "under_review", "resolved", "closed"]);
const FEEDBACK_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const FLAG_KEY = "feedback_widget_enabled";

function asAuthEnv(env: FeedbackEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleFeedback(request: Request, env: FeedbackEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!isFeedbackPath(path)) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/feedback/config" && request.method === "GET") {
    return publicConfig(env, cors);
  }
  if (path === "/v1/feedback" && request.method === "POST") {
    return createFeedback(request, env, cors);
  }
  if (path === "/v1/admin/feedback/config") {
    if (request.method === "GET") return adminConfig(request, env, cors);
    if (request.method === "POST" || request.method === "PATCH") {
      return updateConfig(request, env, cors);
    }
  }
  if (path === "/v1/admin/feedback" && request.method === "GET") {
    return listFeedback(request, env, cors, url);
  }
  const adminItem = path.match(/^\/v1\/admin\/feedback\/([^/]+)$/);
  if (adminItem && request.method === "PATCH") {
    return updateFeedback(request, env, cors, decodeURIComponent(adminItem[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

export function isFeedbackPath(path: string): boolean {
  const normalized = path.replace(/^\/api\b/, "/v1");
  return (
    normalized === "/v1/feedback" ||
    normalized === "/v1/feedback/config" ||
    /^\/v1\/admin\/feedback(?:\/|$)/.test(normalized)
  );
}

async function publicConfig(env: FeedbackEnv, cors: Headers): Promise<Response> {
  const row = await env.DB.prepare("SELECT enabled FROM feature_flags WHERE key = ?")
    .bind(FLAG_KEY)
    .first<Row>();
  const headers = new Headers(cors);
  headers.set("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=45");
  return json({ data: { enabled: row?.enabled === 1 || row?.enabled === true } }, 200, headers);
}

async function adminConfig(request: Request, env: FeedbackEnv, cors: Headers): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!auth.roles.includes("owner")) return forbidden(cors, "Owner permission required.");
  const row = await readFlag(env);
  return row ? json({ data: mapFlag(row) }, 200, cors) : databaseError(cors);
}

async function updateConfig(request: Request, env: FeedbackEnv, cors: Headers): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!auth.roles.includes("owner")) return forbidden(cors, "Owner permission required.");
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const enabled = body.data.enabled;
  const reason = cleanText(body.data.reason, 1000);
  const expectedVersion = integerValue(body.data.expectedVersion);
  if (typeof enabled !== "boolean" || reason.length < 3 || expectedVersion === null || expectedVersion < 1) {
    return validation(cors, "A clear reason and valid feature version are required.");
  }

  const timestamp = now();
  const nextVersion = expectedVersion + 1;
  const result = await env.DB.prepare(
    `UPDATE feature_flags
        SET enabled = ?, reason = ?, version = ?, updated_by = ?, updated_at = ?
      WHERE key = ? AND version = ?`,
  )
    .bind(enabled ? 1 : 0, reason, nextVersion, auth.userId, timestamp, FLAG_KEY, expectedVersion)
    .run();
  if (!result.success) return databaseError(cors);
  if (changedRows(result) !== 1) return stale(cors);

  await insertAudit(env, auth.userId, "feature_flag.changed", "feature_flag", FLAG_KEY, {
    enabled,
    reason,
    expectedVersion,
    nextVersion,
  });
  return json(
    { data: { key: FLAG_KEY, enabled, reason, version: nextVersion, updatedAt: timestamp } },
    200,
    cors,
  );
}

async function createFeedback(request: Request, env: FeedbackEnv, cors: Headers): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const flag = await readFlag(env);
  if (!flag || !(flag.enabled === 1 || flag.enabled === true)) {
    return json(
      { error: { code: "feature_disabled", message: "Feedback submissions are currently disabled." } },
      409,
      cors,
    );
  }

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const type = cleanText(body.data.type, 40);
  const subject = cleanText(body.data.subject, 160);
  const message = cleanText(body.data.message, 3000);
  if (!FEEDBACK_TYPES.has(type) || subject.length < 4 || message.length < 10) {
    return validation(cors, "Invalid feedback submission.");
  }

  const context = normalizeContext(body.data.context);
  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO user_feedback
      (id, user_id, email, type, subject, message, context_json, status, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 'normal', ?, ?)`,
  )
    .bind(
      id,
      auth.userId,
      auth.email,
      type,
      subject,
      message,
      JSON.stringify(context),
      timestamp,
      timestamp,
    )
    .run();
  if (!result.success) return databaseError(cors);
  const row = await readFeedback(env, id);
  return row ? json({ data: mapFeedback(row) }, 201, cors) : databaseError(cors);
}

async function listFeedback(
  request: Request,
  env: FeedbackEnv,
  cors: Headers,
  url: URL,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canModerate(auth.roles)) return forbidden(cors);
  const status = optionalText(url.searchParams.get("status"), 30);
  if (status && !FEEDBACK_STATUSES.has(status)) return validation(cors, "Invalid feedback status.");
  const limit = boundedInteger(url.searchParams.get("limit"), 100, 1, 200);
  const result = status
    ? await env.DB.prepare(`${feedbackSelect()} WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ?`)
        .bind(status, limit)
        .all<Row>()
    : await env.DB.prepare(`${feedbackSelect()} ORDER BY created_at DESC, id DESC LIMIT ?`)
        .bind(limit)
        .all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapFeedback) }, 200, cors)
    : databaseError(cors);
}

async function updateFeedback(
  request: Request,
  env: FeedbackEnv,
  cors: Headers,
  feedbackIdRaw: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!canModerate(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const feedbackId = cleanText(feedbackIdRaw, 120);
  const status = cleanText(body.data.status, 30);
  const priority = cleanText(body.data.priority, 20);
  const expectedUpdatedAt = cleanText(body.data.expectedUpdatedAt, 80);
  const adminNote = optionalText(body.data.adminNote, 2000);
  const publicResponse = optionalText(body.data.publicResponse, 3000);
  if (
    !feedbackId ||
    !FEEDBACK_STATUSES.has(status) ||
    !FEEDBACK_PRIORITIES.has(priority) ||
    !expectedUpdatedAt
  ) {
    return validation(cors, "Invalid feedback update.");
  }

  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE user_feedback
        SET status = ?, priority = ?, assigned_to = ?, admin_note = ?, public_response = ?, updated_at = ?
      WHERE id = ? AND updated_at = ?`,
  )
    .bind(
      status,
      priority,
      auth.userId,
      adminNote,
      publicResponse,
      timestamp,
      feedbackId,
      expectedUpdatedAt,
    )
    .run();
  if (!result.success) return databaseError(cors);
  if (changedRows(result) !== 1) {
    const exists = await env.DB.prepare("SELECT id FROM user_feedback WHERE id = ?")
      .bind(feedbackId)
      .first<Row>();
    return exists ? stale(cors) : notFound(cors);
  }

  await insertAudit(env, auth.userId, "user_feedback.updated", "user_feedback", feedbackId, {
    status,
    priority,
  });
  const row = await readFeedback(env, feedbackId);
  return row ? json({ data: mapFeedback(row) }, 200, cors) : databaseError(cors);
}

async function readFlag(env: FeedbackEnv): Promise<Row | null> {
  return env.DB.prepare(
    "SELECT key, enabled, reason, version, updated_by, updated_at FROM feature_flags WHERE key = ?",
  )
    .bind(FLAG_KEY)
    .first<Row>();
}

function mapFlag(row: Row) {
  return {
    key: stringValue(row.key, FLAG_KEY),
    enabled: row.enabled === 1 || row.enabled === true,
    reason: stringValue(row.reason),
    version: numberValue(row.version, 1),
    updatedBy: nullableString(row.updated_by),
    updatedAt: stringValue(row.updated_at),
  };
}

function feedbackSelect(): string {
  return `SELECT id, user_id, email, type, subject, message, context_json, status, priority,
    assigned_to, admin_note, public_response, created_at, updated_at FROM user_feedback`;
}

async function readFeedback(env: FeedbackEnv, id: string): Promise<Row | null> {
  return env.DB.prepare(`${feedbackSelect()} WHERE id = ?`).bind(id).first<Row>();
}

function mapFeedback(row: Row) {
  return {
    id: stringValue(row.id),
    userId: nullableString(row.user_id),
    email: nullableString(row.email),
    type: stringValue(row.type, "other"),
    subject: stringValue(row.subject),
    message: stringValue(row.message),
    context: jsonObject(row.context_json),
    status: stringValue(row.status, "new"),
    priority: stringValue(row.priority, "normal"),
    assignedTo: nullableString(row.assigned_to),
    adminNote: nullableString(row.admin_note),
    publicResponse: nullableString(row.public_response),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function normalizeContext(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Row;
  const output: Row = {};
  const path = optionalText(input.path, 500);
  const url = optionalText(input.url, 1000);
  const clientTimestamp = optionalText(input.clientTimestamp, 80);
  const userAgent = optionalText(input.userAgent, 500);
  if (path) output.path = path;
  if (url) output.url = url;
  if (clientTimestamp) output.clientTimestamp = clientTimestamp;
  if (userAgent) output.userAgent = userAgent;
  output.language = input.language === "en" ? "en" : "ar";
  output.theme = input.theme === "dark" ? "dark" : "light";
  const width = integerValue(input.viewportWidth);
  const height = integerValue(input.viewportHeight);
  if (width !== null && width >= 0 && width <= 10000) output.viewportWidth = width;
  if (height !== null && height >= 0 && height <= 10000) output.viewportHeight = height;
  return output;
}

async function insertAudit(
  env: FeedbackEnv,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Row,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_logs
      (id, actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), actorId, action, entityType, entityId, JSON.stringify(metadata), now())
    .run();
}

function canModerate(roles: string[]): boolean {
  return roles.includes("owner") || roles.includes("admin") || roles.includes("moderator");
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) return "";
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || code === 127 ? " " : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  const clean = cleanText(value, maxLength);
  return clean || null;
}

function integerValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function jsonObject(value: unknown): Row {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Row) : {};
  } catch {
    return {};
  }
}

function changedRows(result: Result): number {
  return Number.isFinite(result.meta?.changes) ? Number(result.meta?.changes) : 0;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function now(): string {
  return new Date().toISOString();
}

function unauthorized(cors: Headers): Response {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}

function forbidden(cors: Headers, message = "Permission denied."): Response {
  return json({ error: { code: "permission_denied", message } }, 403, cors);
}

function validation(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}

function stale(cors: Headers): Response {
  return json(
    { error: { code: "stale_review", message: "Resource changed since it was loaded." } },
    409,
    cors,
  );
}

function notFound(cors: Headers): Response {
  return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
}

function databaseError(cors: Headers): Response {
  return json(
    { error: { code: "database_unavailable", message: "Data service unavailable." } },
    503,
    cors,
  );
}
