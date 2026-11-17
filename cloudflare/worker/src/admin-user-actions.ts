import {
  corsHeaders,
  json,
  readJson,
  requireMutationAuth,
  type AuthEnv,
} from "./auth";

// Owner-only user mutations. Never treat a UI permission flag as authorization.
// The worker verifies the persisted owner role for every operation.
const ACTION_PATHS = new Set([
  "/v1/admin/users/status",
  "/v1/admin/users/restrictions",
  "/v1/admin/users/roles",
]);
const RESTRICTION_TYPES = new Set(["posting", "messaging", "reviews", "promotions", "uploads"]);
const STAFF_ROLES = new Set(["admin", "moderator"]);
const ACCOUNT_STATUSES = new Set(["active", "frozen", "disabled", "pending_review"]);

type Target = { account_status: string; is_owner: number };

function field(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : "";
}
function failure(cors: Headers, code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status, cors);
}
function audited(
  env: AuthEnv,
  actor: string,
  target: string,
  action: string,
  metadata: Record<string, unknown>,
  timestamp: string,
) {
  return env.DB.prepare(
    "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) " +
      "SELECT ?, ?, ?, 'users', ?, ?, ? WHERE changes() > 0",
  ).bind(crypto.randomUUID(), actor, action, target, JSON.stringify(metadata), timestamp);
}

export async function handleAdminUserActions(
  request: Request,
  env: AuthEnv,
): Promise<Response | null> {
  const path = new URL(request.url).pathname.replace(/^\/api\b/, "/v1");
  if (!ACTION_PATHS.has(path)) return null;

  const cors = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return failure(cors, "method_not_allowed", "POST required.", 405);

  const auth = await requireMutationAuth(request, env, cors);
  if (auth instanceof Response) return auth;
  if (!auth.roles.includes("owner")) {
    return failure(cors, "permission_denied", "Owner authorization required.", 403);
  }

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const userId = field(body.data.userId, 128);
  if (!userId) return failure(cors, "validation_error", "A user must be selected.", 400);

  const target = await env.DB.prepare(
    "SELECT p.account_status, " +
      "EXISTS(SELECT 1 FROM user_roles WHERE user_id = p.id AND role = 'owner') AS is_owner " +
      "FROM public_profiles p JOIN auth_users u ON u.id = p.id WHERE p.id = ?",
  ).bind(userId).first<Target>();
  if (!target) return failure(cors, "not_found", "User not found.", 404);
  if (userId === auth.userId || Number(target.is_owner) !== 0) {
    return failure(cors, "permission_denied", "Owner accounts cannot be modified.", 403);
  }

  const timestamp = new Date().toISOString();

  if (path.endsWith("/status")) {
    const status = field(body.data.status, 32);
    const reason = field(body.data.reason);
    if (!ACCOUNT_STATUSES.has(status) || reason.length < 3) {
      return failure(cors, "validation_error", "Valid status and a clear reason are required.", 400);
    }
    if (target.account_status === status) {
      return failure(cors, "invalid_transition", "Account is already in this state.", 409);
    }

    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE public_profiles SET account_status = ?, updated_at = ? WHERE id = ? " +
          "AND account_status = ? AND NOT EXISTS " +
          "(SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner')",
      ).bind(status, timestamp, userId, target.account_status, userId),
      env.DB.prepare(
        "UPDATE auth_users SET disabled_at = ?, updated_at = ? WHERE id = ? " +
          "AND EXISTS (SELECT 1 FROM public_profiles WHERE id = ? AND account_status = ?) " +
          "AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner')",
      ).bind(status === "disabled" ? timestamp : null, timestamp, userId, userId, status, userId),
      audited(env, auth.userId, userId, "user.status_changed",
        { previousStatus: target.account_status, status, reason }, timestamp),
    ]);
    if (results.some((result) => !result.success)) return failure(cors, "database_error", "Failed to save account state.", 500);
    if (!results[0].meta?.changes || !results[1].meta?.changes || !results[2].meta?.changes) {
      return failure(cors, "stale_write", "Account state changed. Refresh and retry.", 409);
    }
    return json({ data: null }, 200, cors);
  }

  if (path.endsWith("/restrictions")) {
    const action = field(body.data.action, 12);
    const restrictionType = field(body.data.restrictionType, 32);
    const reason = field(body.data.reason);
    if (!RESTRICTION_TYPES.has(restrictionType) ||
        !["set", "lift"].includes(action) || reason.length < 3) {
      return failure(cors, "validation_error", "Valid restriction, action and reason are required.", 400);
    }
    const active = await env.DB.prepare(
      "SELECT id FROM user_restrictions WHERE user_id = ? AND restriction_type = ? " +
        "AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?) LIMIT 1",
    ).bind(userId, restrictionType, timestamp, timestamp).first<{ id: string }>();
    if (action === "set" && active) {
      return failure(cors, "invalid_transition", "Restriction is already active.", 409);
    }
    if (action === "lift" && !active) {
      return failure(cors, "invalid_transition", "No active restriction to lift.", 409);
    }
    const endsAt = body.data.endsAt == null ? null : field(body.data.endsAt, 50);
    if (action === "set" && endsAt !== null &&
      (!endsAt || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(timestamp))) {
      return failure(cors, "validation_error", "Restriction expiry must be a future date.", 400);
    }

    const restrictionId = crypto.randomUUID();
    const mutation = action === "set"
      ? env.DB.prepare(
        "INSERT INTO user_restrictions " +
          "(id, user_id, restriction_type, reason, starts_at, ends_at, created_by, created_at) " +
          "SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS " +
          "(SELECT 1 FROM user_restrictions WHERE user_id = ? AND restriction_type = ? " +
          "AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)) " +
          "AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner')",
      ).bind(restrictionId, userId, restrictionType, reason, timestamp, endsAt, auth.userId,
        timestamp, userId, restrictionType, timestamp, timestamp, userId)
      : env.DB.prepare(
        "UPDATE user_restrictions SET ends_at = ? WHERE user_id = ? AND restriction_type = ? " +
          "AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?) " +
          "AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner')",
      ).bind(timestamp, userId, restrictionType, timestamp, timestamp, userId);
    const results = await env.DB.batch([
      mutation,
      audited(env, auth.userId, userId,
        action === "set" ? "user.restriction_set" : "user.restriction_lifted",
        { restrictionType, reason, ...(action === "set" ? { endsAt } : {}) }, timestamp),
    ]);
    if (results.some((result) => !result.success)) return failure(cors, "database_error", "Failed to save restriction.", 500);
    if (!results[0].meta?.changes || !results[1].meta?.changes) {
      return failure(cors, "stale_write", "Restriction changed. Refresh and retry.", 409);
    }
    return json({ data: action === "set" ? restrictionId : null }, 200, cors);
  }

  const action = field(body.data.action, 12);
  const role = field(body.data.role, 32);
  const reason = field(body.data.note ?? body.data.reason);
  if (!STAFF_ROLES.has(role) || !["assign", "remove"].includes(action) || reason.length < 3) {
    return failure(cors, "validation_error", "Valid staff role, action and reason are required.", 400);
  }
  const existing = await env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ? AND role = ?",
  ).bind(userId, role).first<{ role: string }>();
  if ((action === "assign" && existing) || (action === "remove" && !existing)) {
    return failure(cors, "invalid_transition", "Staff role is already in the requested state.", 409);
  }

  const mutation = action === "assign"
    ? env.DB.prepare(
      "INSERT OR IGNORE INTO user_roles (user_id, role, created_at) " +
        "SELECT id, ?, ? FROM auth_users WHERE id = ? " +
        "AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner')",
    ).bind(role, timestamp, userId, userId)
    : env.DB.prepare(
      "DELETE FROM user_roles WHERE user_id = ? AND role = ? " +
        "AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner')",
    ).bind(userId, role, userId);
  const results = await env.DB.batch([
    mutation,
    audited(env, auth.userId, userId,
      action === "assign" ? "user.staff_role_assigned" : "user.staff_role_removed",
      { role, reason }, timestamp),
  ]);
  if (results.some((result) => !result.success)) return failure(cors, "database_error", "Failed to save staff role.", 500);
  if (!results[0].meta?.changes || !results[1].meta?.changes) {
    return failure(cors, "stale_write", "Staff role changed. Refresh and retry.", 409);
  }
  return json({ data: null }, 200, cors);
}
