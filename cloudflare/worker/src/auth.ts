import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";

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
  SUPABASE_AUTH_ISSUER?: string;
  SUPABASE_AUTH_AUDIENCE?: string;
  SUPABASE_AUTH_TEST_JWKS?: string;
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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  return auth;
}

export async function verifySupabaseAccessToken(
  token: string,
  env: Pick<
    AuthEnv,
    "SUPABASE_AUTH_ISSUER" | "SUPABASE_AUTH_AUDIENCE" | "SUPABASE_AUTH_TEST_JWKS"
  >,
): Promise<VerifiedIdentity | null> {
  const issuer = normalizedIssuer(env.SUPABASE_AUTH_ISSUER);
  if (!issuer) throw new Error("supabase_auth_issuer_missing");
  const audience = env.SUPABASE_AUTH_AUDIENCE?.trim() || "authenticated";

  try {
    const { payload } = await jwtVerify(token, verificationKeySet(env, issuer), {
      issuer,
      audience,
      algorithms: ["RS256", "ES256", "EdDSA"],
      requiredClaims: ["exp", "iat", "iss", "aud", "sub"],
    });
    if (
      typeof payload.sub !== "string" ||
      !UUID_PATTERN.test(payload.sub) ||
      payload.role !== "authenticated" ||
      payload.is_anonymous === true
    ) {
      return null;
    }
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    if (!email || !validEmail(email)) return null;
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    if (!sessionId || !UUID_PATTERN.test(sessionId)) return null;
    return {
      subject: payload.sub,
      sessionId,
      email,
      displayName: safeDisplayName(payload.user_metadata),
    };
  } catch (error) {
    if (error instanceof joseErrors.JOSEError) return null;
    console.error("rawaj_auth_jwt_verification_failed", error);
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
  if (linked) return linked.id;

  const existingSameId = await env.DB.prepare(
    "SELECT id, auth_provider, auth_user_id FROM auth_users WHERE id = ?",
  )
    .bind(identity.subject)
    .first<{ id: string; auth_provider: string | null; auth_user_id: string | null }>();
  const now = new Date().toISOString();

  if (existingSameId && !existingSameId.auth_user_id) {
    const result = await env.DB.prepare(
      `UPDATE auth_users
          SET auth_provider = 'supabase', auth_user_id = ?, email = ?,
              email_normalized = ?, updated_at = ?
        WHERE id = ? AND auth_user_id IS NULL`,
    )
      .bind(identity.subject, identity.email, identity.email, now, identity.subject)
      .run();
    if (!result.success) throw new Error("identity_link_failed");
    return identity.subject;
  }
  if (existingSameId) throw new Error("identity_collision");

  const displayName = identity.displayName ?? identity.email.split("@")[0].slice(0, 100);
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO public_profiles
        (id, display_name, verification_status, account_status, created_at, updated_at, email)
       VALUES (?, ?, 'unverified', 'active', ?, ?, ?)`,
    ).bind(identity.subject, displayName, now, now, identity.email),
    env.DB.prepare(
      `INSERT OR IGNORE INTO auth_users
        (id, email, email_normalized, email_confirmed_at, created_at, updated_at,
         auth_provider, auth_user_id)
       VALUES (?, ?, ?, ?, ?, ?, 'supabase', ?)`,
    ).bind(
      identity.subject,
      identity.email,
      identity.email,
      now,
      now,
      now,
      identity.subject,
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES (?, 'user', ?)`,
    ).bind(identity.subject, now),
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
  env: Pick<AuthEnv, "SUPABASE_AUTH_TEST_JWKS">,
  issuer: string,
): JWTVerifyGetKey {
  if (env.SUPABASE_AUTH_TEST_JWKS && new URL(issuer).hostname === "localhost") {
    const parsed = JSON.parse(env.SUPABASE_AUTH_TEST_JWKS) as JSONWebKeySet;
    return createLocalJWKSet(parsed);
  }
  const jwksUrl = new URL(`${issuer}/.well-known/jwks.json`).toString();
  const cached = remoteKeySets.get(jwksUrl);
  if (cached) return cached;
  const remote = createRemoteJWKSet(new URL(jwksUrl), {
    cacheMaxAge: 10 * 60 * 1000,
    cooldownDuration: 30 * 1000,
  });
  remoteKeySets.set(jwksUrl, remote);
  return remote;
}

function normalizedIssuer(value: string | undefined): string | null {
  try {
    const url = new URL(value?.trim() ?? "");
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function safeDisplayName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const source = metadata as JsonRecord;
  for (const key of ["display_name", "full_name", "name"]) {
    const value = source[key];
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
  const headers = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  });
  const origin = request.headers.get("Origin");
  const allowed = new Set(
    (env.API_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  if (origin && allowed.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export function json(payload: unknown, status: number, headers: Headers): Response {
  const output = new Headers(headers);
  output.set("Content-Type", "application/json; charset=utf-8");
  output.set("X-Content-Type-Options", "nosniff");
  output.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status, headers: output });
}
