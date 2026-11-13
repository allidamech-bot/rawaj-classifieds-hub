import {
  corsHeaders,
  json,
  readJson,
  requireMutationAuth,
  type AuthEnv,
} from "./auth";

type Value = string | number | null;
type Result = { success: boolean; meta?: { changes?: number }; error?: string };
type Statement = {
  bind(...values: Value[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<Result>;
};
type Database = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
};
export type AdminUserManagementEnv = {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
};

type Target = {
  id: string;
  account_status: string;
  is_owner: number;
  is_staff: number;
};

const ACCOUNT_STATUSES = new Set(["active", "frozen", "disabled"]);
const RESTRICTION_TYPES = new Set([
  "posting",
  "messaging",
  "reviews",
  "promotions",
  "uploads",
]);

export async function handleAdminUserManagement(
  request: Request,
  env: AdminUserManagementEnv,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const path = pathname.startsWith("/api/")
    ? "/v1/" + pathname.slice(5)
    : pathname;
  const operation =
    path === "/v1/admin/users/status"
      ? "status"
      : path === "/v1/admin/users/restrictions"
        ? "restrictions"
        : path === "/v1/admin/users/roles"
          ? "roles"
          : null;
  if (!operation) return null;
  const cors = corsHeaders(request, env as unknown as AuthEnv);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") {
    return json(
      { error: { code: "method_not_allowed", message: "Method not allowed." } },
      405,
      cors,
    );
  }

  const auth = await requireMutationAuth(
    request,
    env as unknown as AuthEnv,
    cors,
  );
  if (auth instanceof Response) return auth;
  if (!auth.roles.includes("owner") && !auth.roles.includes("admin"))
    return denied(cors);
  if (operation === "roles" && !auth.roles.includes("owner"))
    return denied(cors);

  const parsed = await readJson(request);
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status, cors);
  const data = parsed.data;
  const userId = text(data.userId, 120);
  if (!userId || userId === auth.userId) return denied(cors);

  const target = await env.DB.prepare(
    "SELECT u.id, p.account_status, " +
      "EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'owner') AS is_owner, " +
      "EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id = u.id " +
      "AND r.role IN ('owner', 'admin', 'moderator')) AS is_staff " +
      "FROM auth_users u JOIN public_profiles p ON p.id = u.id WHERE u.id = ?",
  )
    .bind(userId)
    .first<Target>();
  if (!target)
    return json(
      { error: { code: "not_found", message: "User not found." } },
      404,
      cors,
    );
  if (target.is_owner || (!auth.roles.includes("owner") && target.is_staff))
    return denied(cors);

  if (operation === "status") {
    const status = text(data.status, 32);
    const reason = text(data.reason, 1000);
    if (
      !status ||
      !ACCOUNT_STATUSES.has(status) ||
      !reason ||
      reason.length < 3
    ) {
      return invalid(cors);
    }
    // Only the owner can permanently disable an account.
    if (status === "disabled" && !auth.roles.includes("owner"))
      return denied(cors);
    if (target.account_status === status)
      return json({ data: null }, 200, cors);
    const timestamp = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE public_profiles SET account_status = ?, updated_at = ? " +
          "WHERE id = ? AND account_status = ? " +
          "AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = ? AND r.role = 'owner') " +
          // Administrators may never freeze or ban staff, even if roles change concurrently.
          (!auth.roles.includes("owner")
            ? "AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = ? " +
              "AND r.role IN ('admin', 'moderator'))"
            : ""),
      ).bind(
        status,
        timestamp,
        userId,
        target.account_status,
        userId,
        ...(!auth.roles.includes("owner") ? [userId] : []),
      ),
      env.DB.prepare(
        "UPDATE auth_users SET disabled_at = CASE WHEN ? = 'disabled' THEN ? ELSE NULL END, " +
          "updated_at = ? WHERE id = ? AND EXISTS (" +
          "SELECT 1 FROM public_profiles WHERE id = ? AND account_status = ? AND updated_at = ?)",
      ).bind(status, timestamp, timestamp, userId, userId, status, timestamp),
      auditStatement(
        env,
        auth.userId,
        "user.status_changed",
        userId,
        {
          previousStatus: target.account_status,
          status,
          reason,
        },
        true,
      ),
    ]);
    if (results.some((result) => !result.success)) return failed(cors);
    if (
      changed(results[0]) !== 1 ||
      changed(results[1]) !== 1 ||
      changed(results[2]) !== 1
    ) {
      return stale(cors);
    }
    return json({ data: null }, 200, cors);
  }

  if (operation === "roles") {
    const action = text(data.action, 15);
    const role = text(data.role, 20);
    if (
      !["assign", "remove"].includes(action ?? "") ||
      !["admin", "moderator"].includes(role ?? "")
    ) {
      return invalid(cors);
    }
    if (action === "assign" && target.account_status !== "active")
      return denied(cors);
    const note =
      text(action === "assign" ? data.note : data.reason, 1000) ?? "";
    const exists = await env.DB.prepare(
      "SELECT role FROM user_roles WHERE user_id = ? AND role = ?",
    )
      .bind(userId, role)
      .first<{ role: string }>();
    if ((action === "assign" && exists) || (action === "remove" && !exists)) {
      return json({ data: null }, 200, cors);
    }
    const timestamp = new Date().toISOString();
    const change =
      action === "assign"
        ? env.DB.prepare(
            "INSERT OR IGNORE INTO user_roles (user_id, role, created_at) " +
              "SELECT ?, ?, ? WHERE EXISTS (" +
              "SELECT 1 FROM public_profiles WHERE id = ? AND account_status = 'active') " +
              "AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'owner')",
          ).bind(userId, role, timestamp, userId, userId)
        : env.DB.prepare(
            "DELETE FROM user_roles WHERE user_id = ? AND role = ?",
          ).bind(userId, role);
    const results = await env.DB.batch([
      change,
      auditStatement(
        env,
        auth.userId,
        action === "assign" ? "user.role_assigned" : "user.role_removed",
        userId,
        {
          role,
          note,
        },
        true,
      ),
    ]);
    if (results.some((result) => !result.success)) return failed(cors);
    if (changed(results[0]) !== 1 || changed(results[1]) !== 1)
      return stale(cors);
    return json({ data: null }, 200, cors);
  }

  const action = text(data.action, 15);
  const restrictionType = text(data.restrictionType, 25);
  const reason = text(data.reason, 1000);
  if (
    !["set", "lift"].includes(action ?? "") ||
    !restrictionType ||
    !RESTRICTION_TYPES.has(restrictionType) ||
    !reason ||
    reason.length < 3
  )
    return invalid(cors);

  const timestamp = new Date().toISOString();
  const isActive = "starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)";
  if (action === "set") {
    const endsAtText =
      data.endsAt == null || data.endsAt === "" ? null : text(data.endsAt, 60);
    const endsAtMs = endsAtText ? Date.parse(endsAtText) : null;
    if (
      (data.endsAt != null && data.endsAt !== "" && !endsAtText) ||
      (endsAtText &&
        (!Number.isFinite(endsAtMs) || Number(endsAtMs) <= Date.now()))
    ) {
      return invalid(cors);
    }
    const endsAt = endsAtMs ? new Date(endsAtMs).toISOString() : null;
    const existing = await env.DB.prepare(
      "SELECT id FROM user_restrictions WHERE user_id = ? AND restriction_type = ? " +
        "AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?) LIMIT 1",
    )
      .bind(userId, restrictionType, timestamp, timestamp)
      .first<{ id: string }>();
    if (existing) return json({ data: existing.id }, 200, cors);
    const id = crypto.randomUUID();
    const results = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO user_restrictions " +
          "(id, user_id, restriction_type, reason, starts_at, ends_at, created_by, created_at) " +
          "SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (" +
          "SELECT 1 FROM user_restrictions WHERE user_id = ? AND restriction_type = ? " +
          "AND " +
          isActive +
          ")",
      ).bind(
        id,
        userId,
        restrictionType,
        reason,
        timestamp,
        endsAt,
        auth.userId,
        timestamp,
        userId,
        restrictionType,
        timestamp,
        timestamp,
      ),
      auditStatement(
        env,
        auth.userId,
        "user.restriction_set",
        userId,
        {
          restrictionType,
          restrictionId: id,
          reason,
          endsAt,
        },
        true,
      ),
    ]);
    if (results.some((result) => !result.success)) return failed(cors);
    if (changed(results[0]) !== 1 || changed(results[1]) !== 1)
      return stale(cors);
    return json({ data: id }, 201, cors);
  }

  const results = await env.DB.batch([
    env.DB.prepare(
      "UPDATE user_restrictions SET ends_at = ? WHERE user_id = ? AND restriction_type = ? AND " +
        isActive,
    ).bind(timestamp, userId, restrictionType, timestamp, timestamp),
    auditStatement(
      env,
      auth.userId,
      "user.restriction_lifted",
      userId,
      {
        restrictionType,
        reason,
      },
      true,
    ),
  ]);
  if (results.some((result) => !result.success)) return failed(cors);
  return json({ data: null }, 200, cors);
}

function auditStatement(
  env: AdminUserManagementEnv,
  actorId: string,
  action: string,
  userId: string,
  metadata: Record<string, unknown>,
  onlyWhenPreviousChanged: boolean,
): Statement {
  return env.DB.prepare(
    "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) " +
      "SELECT ?, ?, ?, 'users', ?, ?, ? " +
      (onlyWhenPreviousChanged ? "WHERE changes() > 0" : ""),
  ).bind(
    crypto.randomUUID(),
    actorId,
    action,
    userId,
    JSON.stringify(metadata),
    new Date().toISOString(),
  );
}

function changed(result: Result): number {
  return result.meta?.changes ?? 0;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const item = value.trim();
  return item.length > 0 && item.length <= max ? item : null;
}

function denied(cors: Headers): Response {
  return json(
    { error: { code: "permission_denied", message: "Permission denied." } },
    403,
    cors,
  );
}
function invalid(cors: Headers): Response {
  return json(
    {
      error: {
        code: "validation_error",
        message: "Invalid administrative action.",
      },
    },
    400,
    cors,
  );
}
function failed(cors: Headers): Response {
  return json(
    {
      error: {
        code: "database_unavailable",
        message: "Data service unavailable.",
      },
    },
    503,
    cors,
  );
}
function stale(cors: Headers): Response {
  return json(
    {
      error: {
        code: "stale_write",
        message: "State changed. Reload and try again.",
      },
    },
    409,
    cors,
  );
}
