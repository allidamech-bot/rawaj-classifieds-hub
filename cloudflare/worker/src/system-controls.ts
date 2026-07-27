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
  batch(statements: Statement[]): Promise<Result[]>;
}

export interface SystemControlsEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_AUTH_TEST_JWKS?: string;
  SUPABASE_JWKS_URL?: string;
}

const CONTROL_KEYS = [
  "freeze_new_listings",
  "freeze_new_messages",
  "freeze_promotions",
  "freeze_verifications",
  "maintenance_mode",
  "emergency_read_only",
] as const;
type ControlKey = (typeof CONTROL_KEYS)[number];

function asAuthEnv(env: SystemControlsEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleSystemControls(
  request: Request,
  env: SystemControlsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  if (path !== "/v1/admin/system-controls") return null;
  const cors = corsHeaders(request, asAuthEnv(env));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (request.method === "GET") {
    const auth = await authenticate(request, asAuthEnv(env));
    if (!auth) return unauthorized(cors);
    if (!auth.roles.includes("owner")) return forbidden(cors);
    const result = await env.DB.prepare(
      `SELECT key, enabled, reason, version, updated_by, updated_at
         FROM system_controls
        ORDER BY CASE key
          WHEN 'freeze_new_listings' THEN 1
          WHEN 'freeze_new_messages' THEN 2
          WHEN 'freeze_promotions' THEN 3
          WHEN 'freeze_verifications' THEN 4
          WHEN 'maintenance_mode' THEN 5
          ELSE 6 END`,
    ).all<Row>();
    if (!result.success) return databaseError(cors);
    return json({ data: (result.results ?? []).map(mapControl) }, 200, cors);
  }

  if (request.method === "POST" || request.method === "PATCH") {
    const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
    if (auth instanceof Response) return auth;
    if (!auth.roles.includes("owner")) return forbidden(cors);
    const body = await readJson(request);
    if (!body.ok) return json({ error: body.error }, body.status, cors);

    const key = typeof body.data.key === "string" ? body.data.key : "";
    const enabled = body.data.enabled;
    const reason = typeof body.data.reason === "string" ? body.data.reason.trim() : "";
    const expectedVersion = Number(body.data.expectedVersion);
    if (!CONTROL_KEYS.includes(key as ControlKey))
      return validation(cors, "Invalid system control.");
    if (typeof enabled !== "boolean") return validation(cors, "Invalid control state.");
    if (reason.length < 3 || reason.length > 1000) {
      return validation(cors, "A clear reason between 3 and 1000 characters is required.");
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return validation(cors, "Invalid control version.");
    }

    const timestamp = new Date().toISOString();
    const nextVersion = expectedVersion + 1;
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE system_controls
            SET enabled = ?, reason = ?, version = ?, updated_by = ?, updated_at = ?
          WHERE key = ? AND version = ?`,
      ).bind(enabled ? 1 : 0, reason, nextVersion, auth.userId, timestamp, key, expectedVersion),
      env.DB.prepare(
        `INSERT INTO audit_logs
          (id, actor_id, action, entity_type, entity_id, metadata, created_at)
         SELECT ?, ?, 'system_control.changed', 'system_controls', ?, ?, ?
          WHERE changes() > 0`,
      ).bind(
        crypto.randomUUID(),
        auth.userId,
        key,
        JSON.stringify({ enabled, reason, expectedVersion, nextVersion }),
        timestamp,
      ),
    ]);
    if (results.some((result) => !result.success)) return databaseError(cors);
    if ((results[0].meta?.changes ?? 0) < 1) {
      return json(
        {
          error: {
            code: "stale_write",
            message: "System control changed since it was loaded. Refresh and retry.",
          },
        },
        409,
        cors,
      );
    }

    return json({ data: { key, enabled, version: nextVersion, updatedAt: timestamp } }, 200, cors);
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function mapControl(row: Row) {
  return {
    key: stringValue(row.key),
    enabled: row.enabled === 1 || row.enabled === true,
    reason: stringValue(row.reason),
    version: numberValue(row.version, 1),
    updatedBy: nullableString(row.updated_by) ?? "system-default",
    updatedAt: stringValue(row.updated_at),
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function unauthorized(cors: Headers): Response {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers): Response {
  return json(
    { error: { code: "permission_denied", message: "Owner permission required." } },
    403,
    cors,
  );
}
function validation(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function databaseError(cors: Headers): Response {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
