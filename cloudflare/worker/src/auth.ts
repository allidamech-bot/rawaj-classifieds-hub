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

interface RecoveryEmailBinding {
  send(message: {
    to: string;
    from: string | { address: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId?: string }>;
}

export interface AuthEnv {
  DB: D1Database;
  API_ALLOWED_ORIGINS?: string;
  AUTH_RECOVERY_DELIVERY_MODE?: string;
  AUTH_RECOVERY_FROM?: string;
  AUTH_RECOVERY_APP_ORIGIN?: string;
  RECOVERY_EMAIL?: RecoveryEmailBinding;
}

const SESSION_COOKIE = "rawaj_session";
const CSRF_COOKIE = "rawaj_csrf";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const MAX_BODY_BYTES = 16_384;
const PBKDF2_ITERATIONS = 120_000;
const encoder = new TextEncoder();

export async function handleAuthRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/v1/auth/")) return null;
  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    if (url.pathname === "/v1/auth/session" && request.method === "GET") {
      const auth = await authenticate(request, env);
      if (!auth) return json({ data: { session: null } }, 200, cors);
      return json({ data: { session: sessionPayload(auth) } }, 200, cors);
    }
    if (url.pathname === "/v1/auth/signup" && request.method === "POST") {
      return signup(request, env, cors);
    }
    if (url.pathname === "/v1/auth/login" && request.method === "POST") {
      return login(request, env, cors);
    }
    if (url.pathname === "/v1/auth/logout" && request.method === "POST") {
      return logout(request, env, cors);
    }
    if (
      (url.pathname === "/v1/auth/password-reset/request" ||
        url.pathname === "/v1/auth/recovery/request") &&
      request.method === "POST"
    ) {
      return requestPasswordReset(request, env, cors);
    }
    if (
      (url.pathname === "/v1/auth/password-reset/confirm" ||
        url.pathname === "/v1/auth/recovery/complete") &&
      request.method === "POST"
    ) {
      return confirmPasswordReset(request, env, cors);
    }
    if (url.pathname === "/v1/auth/password/change" && request.method === "POST") {
      return changePassword(request, env, cors);
    }
    return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
  } catch (error) {
    console.error("rawaj_auth_unhandled", error);
    return json({ error: { code: "internal_error", message: "تعذر إكمال العملية." } }, 500, cors);
  }
}

async function signup(request: Request, env: AuthEnv, cors: Headers): Promise<Response> {
  if (!(await consumeRateLimit(request, env, "auth_signup", 5, 60 * 60))) return rateLimited(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const email = normalizeEmail(body.data.email);
  const password = typeof body.data.password === "string" ? body.data.password : "";
  const displayName = cleanText(body.data.displayName, 100);
  if (!email || !validEmail(email) || !validPassword(password) || !displayName) {
    return validation(cors, "تحقق من البريد والاسم وكلمة المرور (8 أحرف على الأقل).");
  }
  const existing = await env.DB.prepare("SELECT id FROM auth_users WHERE email_normalized = ?")
    .bind(email)
    .first();
  if (existing)
    return json(
      { error: { code: "conflict", message: "تعذر إنشاء الحساب بهذه البيانات." } },
      409,
      cors,
    );

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO public_profiles
      (id, display_name, verification_status, account_status, created_at, updated_at, email)
      VALUES (?, ?, 'unverified', 'active', ?, ?, ?)`,
    ).bind(id, displayName, now, now, email),
    env.DB.prepare(
      `INSERT INTO auth_users
      (id, email, email_normalized, password_hash, password_algorithm, email_confirmed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pbkdf2-sha256-v1', ?, ?, ?)`,
    ).bind(id, email, email, passwordHash, now, now, now),
    env.DB.prepare("INSERT INTO user_roles (user_id, role, created_at) VALUES (?, 'user', ?)").bind(
      id,
      now,
    ),
  ]);
  if (results.some((result) => !result.success)) {
    console.error(
      "rawaj_auth_signup_database_error",
      results.map((result) => result.error),
    );
    return databaseFailure(cors);
  }
  return createSessionResponse(request, env, cors, id, email, displayName, ["user"], 201);
}

async function login(request: Request, env: AuthEnv, cors: Headers): Promise<Response> {
  if (!(await consumeRateLimit(request, env, "auth_login", 10, 15 * 60))) return rateLimited(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const email = normalizeEmail(body.data.email);
  const password = typeof body.data.password === "string" ? body.data.password : "";
  if (!email || !password) return validation(cors, "بيانات الدخول غير صحيحة.");
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.password_hash, u.password_algorithm,
      u.email_confirmed_at, u.disabled_at, p.display_name
    FROM auth_users u JOIN public_profiles p ON p.id = u.id WHERE u.email_normalized = ?`,
  )
    .bind(email)
    .first<JsonRecord>();
  if (row && !row.disabled_at && typeof row.password_hash !== "string") {
    await constantTimeNoise(password);
    return json(
      {
        error: {
          code: "account_recovery_required",
          message: "يلزم إعداد كلمة مرور جديدة لهذا الحساب.",
        },
      },
      403,
      cors,
    );
  }
  if (
    !row ||
    row.disabled_at ||
    typeof row.password_hash !== "string" ||
    !(await verifyPassword(password, row.password_hash))
  ) {
    await constantTimeNoise(password);
    return json(
      { error: { code: "invalid_credentials", message: "البريد أو كلمة المرور غير صحيحة." } },
      401,
      cors,
    );
  }
  const rolesResult = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?")
    .bind(String(row.id))
    .all<{ role: string }>();
  const roles = (rolesResult.results ?? []).map((item) => item.role);
  await env.DB.prepare("UPDATE auth_users SET last_sign_in_at = ?, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), new Date().toISOString(), String(row.id))
    .run();
  return createSessionResponse(
    request,
    env,
    cors,
    String(row.id),
    String(row.email),
    typeof row.display_name === "string" ? row.display_name : null,
    roles,
    200,
  );
}

async function logout(request: Request, env: AuthEnv, cors: Headers): Promise<Response> {
  const auth = await requireMutationAuth(request, env, cors);
  if (auth instanceof Response) return auth;
  await env.DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), auth.sessionId)
    .run();
  const headers = new Headers(cors);
  clearCookies(headers, request);
  return json({ data: { success: true } }, 200, headers);
}

async function requestPasswordReset(
  request: Request,
  env: AuthEnv,
  cors: Headers,
): Promise<Response> {
  if (!(await consumeRateLimit(request, env, "auth_password_reset", 5, 60 * 60)))
    return rateLimited(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const email = normalizeEmail(body.data.email);
  const user = email
    ? await env.DB.prepare(
        "SELECT id FROM auth_users WHERE email_normalized = ? AND disabled_at IS NULL",
      )
        .bind(email)
        .first<{ id: string }>()
    : null;
  const localDelivery = isLocalRequest(request) && env.AUTH_RECOVERY_DELIVERY_MODE !== "disabled";
  const productionDelivery = recoveryEmailConfiguration(env);
  if (!localDelivery && !productionDelivery) {
    return json(
      {
        error: {
          code: "recovery_delivery_unavailable",
          message: "خدمة استعادة الحساب غير متاحة مؤقتًا.",
        },
      },
      503,
      cors,
    );
  }
  let developmentToken: string | undefined;
  if (user) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE auth_one_time_tokens
       SET consumed_at = ?
       WHERE user_id = ? AND purpose = 'password_reset' AND consumed_at IS NULL`,
    )
      .bind(now, user.id)
      .run();
    developmentToken = await createOneTimeToken(env, user.id, "password_reset", 30 * 60);
    if (!localDelivery && productionDelivery && email) {
      try {
        await env.RECOVERY_EMAIL!.send(
          buildRecoveryEmail(
            email,
            productionDelivery.from,
            productionDelivery.appOrigin,
            developmentToken,
          ),
        );
      } catch (error) {
        await env.DB.prepare(
          `UPDATE auth_one_time_tokens
             SET consumed_at = ?
           WHERE user_id = ? AND purpose = 'password_reset' AND consumed_at IS NULL`,
        )
          .bind(new Date().toISOString(), user.id)
          .run();
        console.error("rawaj_recovery_delivery_failed", {
          code: safeEmailErrorCode(error),
        });
      }
    }
  }
  return json(
    {
      data: {
        accepted: true,
        ...(isLocalRequest(request) && developmentToken ? { developmentToken } : {}),
      },
    },
    202,
    cors,
  );
}

function recoveryEmailConfiguration(env: AuthEnv): { from: string; appOrigin: string } | null {
  if (!env.RECOVERY_EMAIL) return null;
  const from = normalizeEmail(env.AUTH_RECOVERY_FROM);
  if (!from || !validEmail(from) || !from.endsWith("@rawa-j.com")) return null;
  try {
    const origin = new URL(env.AUTH_RECOVERY_APP_ORIGIN ?? "");
    if (origin.protocol !== "https:" || origin.origin !== env.AUTH_RECOVERY_APP_ORIGIN) return null;
    return { from, appOrigin: origin.origin };
  } catch {
    return null;
  }
}

export function buildRecoveryEmail(to: string, from: string, appOrigin: string, token: string) {
  const recoveryUrl = new URL("/reset-password", appOrigin);
  recoveryUrl.searchParams.set("token", token);
  const link = recoveryUrl.toString();
  const escapedLink = escapeHtml(link);
  return {
    to,
    from: { address: from, name: "رواج" },
    subject: "استعادة كلمة المرور في رواج",
    text: [
      "مرحبًا،",
      "",
      "تلقينا طلبًا لاستعادة كلمة المرور لحسابك في رواج.",
      `استخدم الرابط الآمن التالي خلال 30 دقيقة: ${link}`,
      "",
      "الرابط مخصص للاستخدام مرة واحدة فقط. إذا لم تطلب استعادة كلمة المرور فتجاهل هذه الرسالة.",
    ].join("\n"),
    html: `<div dir="rtl" lang="ar" style="font-family:Arial,sans-serif;line-height:1.7;color:#173f35">
      <h1 style="color:#0f4c3a">استعادة كلمة المرور في رواج</h1>
      <p>تلقينا طلبًا لاستعادة كلمة المرور لحسابك.</p>
      <p><a href="${escapedLink}" style="background:#0f4c3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">إنشاء كلمة مرور جديدة</a></p>
      <p>تنتهي صلاحية هذا الرابط بعد 30 دقيقة، ويمكن استخدامه مرة واحدة فقط.</p>
      <p>إذا لم تطلب استعادة كلمة المرور فتجاهل هذه الرسالة.</p>
    </div>`,
  };
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character]);
}

function safeEmailErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.slice(0, 80);
  }
  return "unknown";
}

async function confirmPasswordReset(
  request: Request,
  env: AuthEnv,
  cors: Headers,
): Promise<Response> {
  if (!(await consumeRateLimit(request, env, "auth_password_reset_complete", 10, 15 * 60)))
    return rateLimited(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const token = typeof body.data.token === "string" ? body.data.token.trim() : "";
  const password = typeof body.data.password === "string" ? body.data.password : "";
  if (!token || !validPassword(password)) return validation(cors, "رمز أو كلمة مرور غير صالحين.");
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT id, user_id FROM auth_one_time_tokens
    WHERE token_hash = ? AND purpose = 'password_reset' AND consumed_at IS NULL AND expires_at > ?`,
  )
    .bind(tokenHash, new Date().toISOString())
    .first<{ id: string; user_id: string }>();
  if (!row)
    return json(
      { error: { code: "invalid_token", message: "الرابط غير صالح أو منتهي." } },
      400,
      cors,
    );
  const now = new Date().toISOString();
  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE auth_users SET password_hash = ?, password_algorithm = 'pbkdf2-sha256-v1', email_confirmed_at = COALESCE(email_confirmed_at, ?), updated_at = ? WHERE id = ?",
    ).bind(await hashPassword(password), now, now, row.user_id),
    env.DB.prepare("UPDATE auth_one_time_tokens SET consumed_at = ? WHERE id = ?").bind(
      now,
      row.id,
    ),
    env.DB.prepare(
      "UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
    ).bind(now, row.user_id),
  ]);
  if (results.some((result) => !result.success)) return databaseFailure(cors);
  return json({ data: { success: true } }, 200, cors);
}

async function changePassword(request: Request, env: AuthEnv, cors: Headers): Promise<Response> {
  const auth = await requireMutationAuth(request, env, cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const currentPassword =
    typeof body.data.currentPassword === "string" ? body.data.currentPassword : "";
  const password = typeof body.data.password === "string" ? body.data.password : "";
  if (!validPassword(password)) return validation(cors, "كلمة المرور الجديدة غير صالحة.");
  const row = await env.DB.prepare("SELECT password_hash FROM auth_users WHERE id = ?")
    .bind(auth.userId)
    .first<{ password_hash: string | null }>();
  if (!row?.password_hash || !(await verifyPassword(currentPassword, row.password_hash))) {
    return json(
      { error: { code: "invalid_credentials", message: "كلمة المرور الحالية غير صحيحة." } },
      401,
      cors,
    );
  }
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .bind(await hashPassword(password), now, auth.userId)
    .run();
  await env.DB.prepare(
    "UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL",
  )
    .bind(now, auth.userId, auth.sessionId)
    .run();
  return json({ data: { success: true } }, 200, cors);
}

type Authenticated = {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string | null;
  roles: string[];
  csrf: string;
};

export async function authenticate(request: Request, env: AuthEnv): Promise<Authenticated | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.user_id, u.email,
      p.display_name, s.expires_at
    FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
    JOIN public_profiles p ON p.id = s.user_id
    WHERE s.refresh_token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
      AND u.disabled_at IS NULL`,
  )
    .bind(tokenHash, new Date().toISOString())
    .first<JsonRecord>();
  if (!row) return null;
  const roles = await env.DB.prepare("SELECT role FROM user_roles WHERE user_id = ?")
    .bind(String(row.user_id))
    .all<{ role: string }>();
  return {
    userId: String(row.user_id),
    sessionId: String(row.session_id),
    email: String(row.email),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    roles: (roles.results ?? []).map((item) => item.role),
    csrf: cookieValue(request, CSRF_COOKIE) ?? "",
  };
}

export async function requireMutationAuth(
  request: Request,
  env: AuthEnv,
  cors: Headers,
): Promise<Authenticated | Response> {
  const auth = await authenticate(request, env);
  if (!auth)
    return json({ error: { code: "auth_required", message: "تسجيل الدخول مطلوب." } }, 401, cors);
  const header = request.headers.get("X-CSRF-Token") ?? "";
  if (!header || !auth.csrf || !(await constantTimeEqual(header, auth.csrf))) {
    return json({ error: { code: "csrf_rejected", message: "تعذر التحقق من الطلب." } }, 403, cors);
  }
  return auth;
}

function sessionPayload(auth: Authenticated) {
  return {
    user: { id: auth.userId, email: auth.email, emailConfirmed: true },
    profile: { id: auth.userId, displayName: auth.displayName, roles: auth.roles },
    csrfToken: auth.csrf,
  };
}

async function createSessionResponse(
  request: Request,
  env: AuthEnv,
  cors: Headers,
  userId: string,
  email: string,
  displayName: string | null,
  roles: string[],
  status: number,
): Promise<Response> {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const id = crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_SECONDS * 1000);
  const result = await env.DB.prepare(
    `INSERT INTO auth_sessions
    (id, user_id, refresh_token_hash, user_agent_hash, ip_hash, created_at, last_seen_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      await sha256(token),
      await headerHash(request, "User-Agent"),
      await headerHash(request, "CF-Connecting-IP"),
      now.toISOString(),
      now.toISOString(),
      expires.toISOString(),
    )
    .run();
  if (!result.success) return databaseFailure(cors);
  const headers = new Headers(cors);
  setCookies(headers, request, token, csrf);
  return json(
    {
      data: { session: sessionPayload({ userId, sessionId: id, email, displayName, roles, csrf }) },
    },
    status,
    headers,
  );
}

async function createOneTimeToken(env: AuthEnv, userId: string, purpose: string, seconds: number) {
  const token = randomToken(32);
  const now = new Date();
  await env.DB.prepare(
    `INSERT INTO auth_one_time_tokens
    (id, user_id, purpose, token_hash, payload, created_at, expires_at)
    VALUES (?, ?, ?, ?, '{}', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      userId,
      purpose,
      await sha256(token),
      now.toISOString(),
      new Date(now.getTime() + seconds * 1000).toISOString(),
    )
    .run();
  return token;
}

export async function readJson(
  request: Request,
): Promise<{ ok: true; data: JsonRecord } | { ok: false; status: number; error: JsonRecord }> {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return {
      ok: false,
      status: 415,
      error: { code: "unsupported_media_type", message: "JSON مطلوب." },
    };
  }
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > MAX_BODY_BYTES)
    return {
      ok: false,
      status: 413,
      error: { code: "payload_too_large", message: "الطلب كبير جدًا." },
    };
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
      error: { code: "validation_error", message: "طلب غير صالح." },
    };
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return `v1$${PBKDF2_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [version, iterationsValue, saltValue, hashValue] = stored.split("$");
  const iterations = Number(iterationsValue);
  if (version !== "v1" || iterations !== PBKDF2_ITERATIONS || !saltValue || !hashValue)
    return false;
  const salt = fromBase64Url(saltValue);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return constantTimeEqualBytes(new Uint8Array(bits), fromBase64Url(hashValue));
}

async function constantTimeNoise(password: string) {
  await hashPassword(password || "invalid-password-value");
}

async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function headerHash(request: Request, name: string): Promise<string | null> {
  const value = request.headers.get(name);
  return value ? sha256(value) : null;
}
async function consumeRateLimit(
  request: Request,
  env: AuthEnv,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const ipHash =
    (await headerHash(request, "CF-Connecting-IP")) ?? (await sha256("local-development"));
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const row = await env.DB.prepare(
    "SELECT count(*) AS count FROM audit_logs WHERE action = ? AND ip_hash = ? AND created_at >= ?",
  )
    .bind(action, ipHash, since)
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= limit) return false;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO audit_logs
    (id, actor_id, action, entity_type, entity_id, metadata, ip_hash, user_agent_hash, created_at)
    VALUES (?, NULL, ?, 'auth_attempt', NULL, '{}', ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), action, ipHash, await headerHash(request, "User-Agent"), now)
    .run();
  return true;
}

function randomToken(bytes: number) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value: string) {
  const binary = atob(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "="),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function constantTimeEqual(left: string, right: string) {
  return constantTimeEqualBytes(encoder.encode(left), encoder.encode(right));
}
function constantTimeEqualBytes(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1)
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}
function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function validPassword(value: string) {
  return value.length >= 8 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
function cleanText(value: unknown, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("Cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
function isLocalRequest(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}
function setCookies(headers: Headers, request: Request, session: string, csrf: string) {
  const secure = isLocalRequest(request) ? "" : "; Secure";
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(session)}; HttpOnly; Path=/; Max-Age=${SESSION_SECONDS}; SameSite=Lax${secure}`,
  );
  headers.append(
    "Set-Cookie",
    `${CSRF_COOKIE}=${encodeURIComponent(csrf)}; Path=/; Max-Age=${SESSION_SECONDS}; SameSite=Lax${secure}`,
  );
}
function clearCookies(headers: Headers, request: Request) {
  const secure = isLocalRequest(request) ? "" : "; Secure";
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`,
  );
  headers.append("Set-Cookie", `${CSRF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}
export function corsHeaders(request: Request, env: AuthEnv) {
  const headers = new Headers({
    Vary: "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
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
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function databaseFailure(cors: Headers) {
  return json(
    { error: { code: "database_unavailable", message: "خدمة البيانات غير متاحة مؤقتًا." } },
    503,
    cors,
  );
}
function rateLimited(cors: Headers) {
  const headers = new Headers(cors);
  headers.set("Retry-After", "900");
  return json(
    { error: { code: "rate_limited", message: "محاولات كثيرة. حاول لاحقًا." } },
    429,
    headers,
  );
}
export function json(payload: unknown, status: number, headers: Headers) {
  const output = new Headers(headers);
  output.set("Content-Type", "application/json; charset=utf-8");
  output.set("X-Content-Type-Options", "nosniff");
  output.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(payload), { status, headers: output });
}
