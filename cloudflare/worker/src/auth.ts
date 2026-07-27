import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";
import { corsHeadersForRequest } from "./cors";

type D1Value = string | number | null;
type JsonRecord = Record<string, unknown>;

interface D1Result<T> {
  results?: T[];
  success: boolean;
  error?: string;
}

interface D1Statement {
  bind(...values: D1Value[]): D1Statement;
  first<T = JsonRecord>(): Promise<T | null>;
  all<T = JsonRecord>(): Promise<D1Result<T>>;
  run<T = JsonRecord>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = JsonRecord>(statements: D1Statement[]): Promise<D1Result<T>[]>;
}

export interface AuthEnv {
  DB: D1Database;
  API_ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_AUTH_TEST_JWKS?: string;
  SUPABASE_JWKS_URL?: string;
}

type Authenticated = {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string | null;
  roles: string[];
};

type VerifiedIdentity = {
  subject: string;
  sessionId: string;
  email: string;
  displayName: string | null;
};

const MAX_BODY_BYTES = 16_384;
const encoder = new TextEncoder();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_SUPABASE_URL = "https://dpymopdckflnpmowhlyq.supabase.co";
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

export async function authenticate(request: Request, env: AuthEnv): Promise<Authenticated | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const identity = await verifySupabaseAccessToken(token, env);
  if (!identity) return null;

  const userId = await ensureApplicationIdentity(env, identity);
  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.disabled_at, p.display_name
       FROM auth_users u
       JOIN public_profiles p ON p.id = u.id
      WHERE u.id = ? AND u.auth_provider = 'supabase' AND u.auth_user_id = ?`,
  )
    .bind(userId, identity.subject)
    .first<JsonRecord>();
  if (!user || user.disabled_at) return null;

  const rolesResult = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?")
    .bind(userId)
    .all<{ role: string }>();
  if (!rolesResult.success) throw new Error("role_lookup_failed");

  return {
    userId,
    sessionId: identity.sessionId,
    email: typeof user.email === "string" ? user.email : identity.email,
    displayName: typeof user.display_name === "string" ? user.display_name : null,
    roles: (rolesResult.results ?? []).map((item) => item.role),
  };
}

export async function requireMutationAuth(
  request: Request,
  env: AuthEnv,
  cors: Headers,
): Promise<Authenticated | Response> {
  const auth = await authenticate(request, env);
  if (!auth) {
    return json(
      { error: { code: "auth_required", message: "Authentication required." } },
      401,
      cors,
    );
  }

  const path = normalizeApiPath(new URL(request.url).pathname);
  if (path === "/v1/admin/system-controls") return auth;

  const blocked = await blockedMutationControl(request, env);
  if (blocked) return systemControlResponse(blocked, cors);
  return auth;
}

type MutationControlKey =
  | "freeze_new_listings"
  | "freeze_new_messages"
  | "freeze_promotions"
  | "freeze_verifications"
  | "maintenance_mode"
  | "emergency_read_only";

type ActiveMutationControl = {
  key: MutationControlKey;
  reason: string;
};

async function blockedMutationControl(
  request: Request,
  env: AuthEnv,
): Promise<ActiveMutationControl | null> {
  let result: D1Result<{ key: MutationControlKey; reason: string }>;
  try {
    result = await env.DB.prepare(
      `SELECT key, reason
         FROM system_controls
        WHERE enabled = 1`,
    ).all<{ key: MutationControlKey; reason: string }>();
  } catch (error) {
    console.error("rawaj_system_control_lookup_failed", error);
    return { key: "emergency_read_only", reason: "تعذر التحقق من حالة النظام بأمان." };
  }

  if (!result.success) {
    console.error("rawaj_system_control_lookup_failed", result.error ?? "unknown_error");
    return { key: "emergency_read_only", reason: "تعذر التحقق من حالة النظام بأمان." };
  }

  const active = new Map<MutationControlKey, string>();
  for (const row of result.results ?? []) {
    if (isMutationControlKey(row.key)) active.set(row.key, cleanControlReason(row.reason));
  }

  for (const key of ["emergency_read_only", "maintenance_mode"] as const) {
    if (active.has(key)) return { key, reason: active.get(key) ?? "" };
  }

  const scoped = scopedMutationControl(request);
  return scoped && active.has(scoped) ? { key: scoped, reason: active.get(scoped) ?? "" } : null;
}

function scopedMutationControl(request: Request): MutationControlKey | null {
  const method = request.method.toUpperCase();
  const path = normalizeApiPath(new URL(request.url).pathname);

  if (method === "POST" && path === "/v1/listings") return "freeze_new_listings";
  if (
    method === "POST" &&
    (path === "/v1/conversations" ||
      /^\/v1\/conversations\/[^/]+\/(?:messages|attachments)$/.test(path))
  ) {
    return "freeze_new_messages";
  }
  if (method === "POST" && path === "/v1/account/promotions") return "freeze_promotions";
  if (method === "POST" && path === "/v1/account/verifications") return "freeze_verifications";
  return null;
}

function normalizeApiPath(pathname: string): string {
  return pathname.replace(/^\/api\b/, "/v1");
}

function isMutationControlKey(value: unknown): value is MutationControlKey {
  return (
    value === "freeze_new_listings" ||
    value === "freeze_new_messages" ||
    value === "freeze_promotions" ||
    value === "freeze_verifications" ||
    value === "maintenance_mode" ||
    value === "emergency_read_only"
  );
}

function cleanControlReason(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 1000) : "";
}

function systemControlResponse(control: ActiveMutationControl, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set("Retry-After", "60");
  const messages: Record<MutationControlKey, string> = {
    freeze_new_listings: "تم إيقاف إنشاء الإعلانات الجديدة مؤقتًا.",
    freeze_new_messages: "تم إيقاف إرسال الرسائل والمرفقات مؤقتًا.",
    freeze_promotions: "تم إيقاف طلبات الترويج الجديدة مؤقتًا.",
    freeze_verifications: "تم إيقاف طلبات التوثيق الجديدة مؤقتًا.",
    maintenance_mode: "الخدمة تحت الصيانة حاليًا. حاول مرة أخرى لاحقًا.",
    emergency_read_only: "الخدمة في وضع القراءة فقط حاليًا.",
  };
  return json(
    {
      error: {
        code: "system_control_active",
        message: control.reason || messages[control.key],
        control: control.key,
        retryable: true,
      },
    },
    503,
    headers,
  );
}

export async function verifySupabaseAccessToken(
  token: string,
  env: Pick<AuthEnv, "SUPABASE_URL" | "SUPABASE_AUTH_TEST_JWKS" | "SUPABASE_JWKS_URL">,
): Promise<VerifiedIdentity | null> {
  const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL);
  const issuer = `${supabaseUrl}/auth/v1`;

  try {
    const { payload } = await jwtVerify(token, verificationKeySet(env, issuer), {
      issuer,
      audience: "authenticated",
      algorithms: ["RS256", "ES256"],
      requiredClaims: ["exp", "iat", "iss", "aud", "sub", "role", "session_id"],
    });
    if (payload.role !== "authenticated") return null;
    if (typeof payload.sub !== "string" || !validSupabaseUserId(payload.sub)) return null;
    if (typeof payload.session_id !== "string" || !payload.session_id.trim()) return null;
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    if (!email || !validEmail(email)) return null;
    return {
      subject: payload.sub,
      sessionId: payload.session_id,
      email,
      displayName: safeSupabaseDisplayName(payload),
    };
  } catch (error) {
    if (error instanceof joseErrors.JOSEError) return null;
    console.error("rawaj_supabase_jwt_verification_failed", error);
    return null;
  }
}

async function ensureApplicationIdentity(
  env: AuthEnv,
  identity: VerifiedIdentity,
): Promise<string> {
  const linked = await env.DB.prepare(
    `SELECT id FROM auth_users
      WHERE auth_provider = 'supabase' AND auth_user_id = ?`,
  )
    .bind(identity.subject)
    .first<{ id: string }>();
  if (linked) {
    if (identity.displayName) {
      const defaultDisplayName = identity.email.split("@")[0].slice(0, 100);
      const synchronized = await env.DB.prepare(
        `UPDATE public_profiles
            SET display_name = ?, updated_at = ?
          WHERE id = ?
            AND (display_name IS NULL OR trim(display_name) = '' OR display_name = ?)`,
      )
        .bind(identity.displayName, new Date().toISOString(), linked.id, defaultDisplayName)
        .run();
      if (!synchronized.success) throw new Error("identity_profile_sync_failed");
    }
    return linked.id;
  }

  const existingSameId = UUID_PATTERN.test(identity.subject)
    ? await env.DB.prepare("SELECT id, auth_provider, auth_user_id FROM auth_users WHERE id = ?")
        .bind(identity.subject)
        .first<{ id: string; auth_provider: string | null; auth_user_id: string | null }>()
    : null;
  const now = new Date().toISOString();

  if (
    existingSameId &&
    (!existingSameId.auth_user_id ||
      (existingSameId.auth_provider === "legacy_import" &&
        existingSameId.auth_user_id === identity.subject))
  ) {
    const result = await env.DB.prepare(
      `UPDATE auth_users
          SET auth_provider = 'supabase', auth_user_id = ?, email = ?,
              email_normalized = ?, updated_at = ?
        WHERE id = ?`,
    )
      .bind(identity.subject, identity.email, identity.email, now, identity.subject)
      .run();
    if (!result.success) throw new Error("identity_link_failed");
    return identity.subject;
  }
  if (existingSameId) throw new Error("identity_collision");

  const applicationUserId = UUID_PATTERN.test(identity.subject)
    ? identity.subject
    : crypto.randomUUID();
  const displayName = identity.displayName ?? identity.email.split("@")[0].slice(0, 100);
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO public_profiles
        (id, display_name, verification_status, account_status, created_at, updated_at, email)
       VALUES (?, ?, 'unverified', 'active', ?, ?, ?)`,
    ).bind(applicationUserId, displayName, now, now, identity.email),
    env.DB.prepare(
      `INSERT OR IGNORE INTO auth_users
        (id, email, email_normalized, email_confirmed_at, created_at, updated_at,
         auth_provider, auth_user_id)
       VALUES (?, ?, ?, ?, ?, ?, 'supabase', ?)`,
    ).bind(applicationUserId, identity.email, identity.email, now, now, now, identity.subject),
    env.DB.prepare(
      `INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES (?, 'user', ?)`,
    ).bind(applicationUserId, now),
  ]);
  if (results.some((result) => !result.success)) throw new Error("identity_create_failed");

  const created = await env.DB.prepare(
    `SELECT id FROM auth_users
      WHERE auth_provider = 'supabase' AND auth_user_id = ?`,
  )
    .bind(identity.subject)
    .first<{ id: string }>();
  if (!created) throw new Error("identity_create_failed");
  return created.id;
}

function verificationKeySet(
  env: Pick<AuthEnv, "SUPABASE_AUTH_TEST_JWKS" | "SUPABASE_JWKS_URL">,
  issuer: string,
): JWTVerifyGetKey {
  const jwksUrl = env.SUPABASE_JWKS_URL ?? `${issuer}/.well-known/jwks.json`;
  if (env.SUPABASE_AUTH_TEST_JWKS) {
    const parsed = JSON.parse(env.SUPABASE_AUTH_TEST_JWKS) as JSONWebKeySet;
    return createLocalJWKSet(parsed);
  }
  const cached = remoteKeySets.get(jwksUrl);
  if (cached) return cached;
  const remote = createRemoteJWKSet(new URL(jwksUrl), {
    cacheMaxAge: 10 * 60 * 1000,
    cooldownDuration: 30 * 1000,
  });
  remoteKeySets.set(jwksUrl, remote);
  return remote;
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function validSupabaseUserId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function safeSupabaseDisplayName(payload: JsonRecord): string | null {
  const metadata =
    payload.user_metadata &&
    typeof payload.user_metadata === "object" &&
    !Array.isArray(payload.user_metadata)
      ? (payload.user_metadata as JsonRecord)
      : {};
  for (const key of ["display_name", "full_name", "name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 100);
  }
  return null;
}

export async function readJson(
  request: Request,
): Promise<{ ok: true; data: JsonRecord } | { ok: false; status: number; error: JsonRecord }> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return {
      ok: false,
      status: 415,
      error: { code: "unsupported_media_type", message: "JSON required." },
    };
  }
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      error: { code: "payload_too_large", message: "Request body is too large." },
    };
  }
  try {
    const text = await request.text();
    if (encoder.encode(text).byteLength > MAX_BODY_BYTES) throw new Error("large");
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("shape");
    return { ok: true, data: value as JsonRecord };
  } catch {
    return {
      ok: false,
      status: 400,
      error: { code: "validation_error", message: "Invalid request." },
    };
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function corsHeaders(request: Request, env: AuthEnv): Headers {
  return corsHeadersForRequest(request, env);
}

export function json(payload: unknown, status: number, headers: Headers): Response {
  const output = new Headers(headers);
  output.set("Content-Type", "application/json; charset=utf-8");
  output.set("X-Content-Type-Options", "nosniff");
  output.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status, headers: output });
}
