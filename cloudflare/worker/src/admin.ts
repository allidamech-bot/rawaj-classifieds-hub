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
export interface AdminEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

function asAuthEnv(env: AdminEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleAdmin(
  request: Request,
  env: AdminEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (path === "/v1/admin/metrics" && request.method === "GET") {
    return adminMetrics(request, env, cors);
  }
  if (path === "/v1/admin/users" && request.method === "GET") {
    return adminUsers(request, env, cors);
  }
  if (path === "/v1/admin/audit" && request.method === "GET") {
    return adminAuditLogs(request, env, cors);
  }
  if (path === "/v1/admin/listings/pending" && request.method === "GET") {
    return adminPendingListings(request, env, cors);
  }
  if (path === "/v1/admin/listings/moderate" && request.method === "POST") {
    return adminModerateListing(request, env, cors);
  }
  if (path === "/v1/admin/listings" && request.method === "GET") {
    return adminModerationListings(request, env, cors);
  }

  return null;
}

function requireAdminRole(
  auth: { roles: string[] },
  minRole: "moderator" | "admin" | "owner",
): boolean {
  const hierarchy = ["user", "moderator", "admin", "owner"];
  const actorLevel = Math.max(...auth.roles.map((role) => hierarchy.indexOf(role) || 0));
  const requiredLevel = hierarchy.indexOf(minRole);
  return actorLevel >= requiredLevel;
}

async function adminMetrics(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "admin")) return forbidden(cors);

  const totalUsers = await env.DB.prepare(
    "SELECT count(*) AS count FROM auth_users WHERE disabled_at IS NULL",
  )
    .first<{ count: number }>();
  const activeUsers = await env.DB.prepare(
    `SELECT count(*) AS count FROM auth_users u
     WHERE u.disabled_at IS NULL
       AND EXISTS (SELECT 1 FROM listings l WHERE l.owner_id = u.id AND l.created_at > datetime('now', '-30 days'))`,
  )
    .first<{ count: number }>();
  const frozenUsers = await env.DB.prepare(
    `SELECT count(*) AS count FROM public_profiles WHERE account_status = 'frozen'`,
  )
    .first<{ count: number }>();
  const disabledUsers = await env.DB.prepare(
    `SELECT count(*) AS count FROM public_profiles WHERE account_status = 'disabled'`,
  )
    .first<{ count: number }>();
  const pendingListings = await env.DB.prepare(
    "SELECT count(*) AS count FROM listings WHERE status = 'pending_review'",
  )
    .first<{ count: number }>();
  const openListingReports = await env.DB.prepare(
    "SELECT count(*) AS count FROM listing_reports WHERE status IN ('new', 'under_review')",
  )
    .first<{ count: number }>();
  const activeRestrictions = await env.DB.prepare(
    "SELECT count(*) AS count FROM user_restrictions WHERE ends_at IS NULL OR ends_at > datetime('now')",
  )
    .first<{ count: number }>();
  const adminCount = await env.DB.prepare(
    "SELECT count(*) AS count FROM user_roles WHERE role IN ('admin', 'owner')",
  )
    .first<{ count: number }>();
  const moderatorCount = await env.DB.prepare(
    "SELECT count(*) AS count FROM user_roles WHERE role = 'moderator'",
  )
    .first<{ count: number }>();

  return json(
    {
      data: {
        totalUsers: numberValue(totalUsers?.count),
        activeUsers: numberValue(activeUsers?.count),
        frozenUsers: numberValue(frozenUsers?.count),
        disabledUsers: numberValue(disabledUsers?.count),
        pendingListings: numberValue(pendingListings?.count),
        openListingReports: numberValue(openListingReports?.count),
        openMessageReports: 0,
        pendingVerifications: 0,
        pendingPromotions: 0,
        activeRestrictions: numberValue(activeRestrictions?.count),
        adminCount: numberValue(adminCount?.count),
        moderatorCount: numberValue(moderatorCount?.count),
      },
    },
    200,
    cors,
  );
}

async function adminUsers(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "owner")) return forbidden(cors);

  const limit = integerParam(request, 100, 1, 200);
  const result = await env.DB.prepare(
    `SELECT u.id, u.email, p.account_status, p.verification_status,
            p.display_name, p.business_name,
            group_concat(DISTINCT ur.role) AS roles,
            (SELECT count(*) FROM listings WHERE owner_id = u.id) AS listing_count,
            (SELECT count(*) FROM listing_reports WHERE reporter_id = u.id) AS reports_submitted,
            0 AS reports_received
       FROM auth_users u
       JOIN public_profiles p ON p.id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ?`,
  )
    .bind(limit)
    .all<Row>();

  if (!result.success) return databaseError(cors);

  const users = (result.results ?? []).map((row) => ({
    id: stringValue(row.id),
    email: nullableString(row.email),
    displayName: nullableString(row.display_name) ?? nullableString(row.business_name),
    accountStatus: stringValue(row.account_status, "active"),
    verificationStatus: stringValue(row.verification_status, "unverified"),
    createdAt: nullableString(row.created_at),
    roles: (row.roles as string | null)?.split(",").filter(Boolean) ?? [],
    listingCount: numberValue(row.listing_count),
    reportsSubmitted: numberValue(row.reports_submitted),
    reportsReceived: numberValue(row.reports_received),
    activeRestrictions: [],
  }));

  return json({ data: users }, 200, cors);
}

async function adminAuditLogs(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "admin")) return forbidden(cors);

  const limit = integerParam(request, 50, 1, 100);
  const result = await env.DB.prepare(
    `SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at
       FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ?`,
  )
    .bind(limit)
    .all<Row>();

  if (!result.success) return databaseError(cors);

  const logs = (result.results ?? []).map((row) => ({
    id: stringValue(row.id),
    actorId: nullableString(row.actor_id),
    actorRole: null,
    action: stringValue(row.action),
    targetTable: nullableString(row.entity_type),
    targetId: nullableString(row.entity_id),
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {},
    createdAt: nullableString(row.created_at),
  }));

  return json({ data: logs }, 200, cors);
}

async function adminPendingListings(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "moderator")) return forbidden(cors);

  const result = await env.DB.prepare(
    `SELECT l.id, l.owner_id, l.title, l.status, l.category_id, l.governorate_id,
            l.expires_at, l.published_at, l.archived_at, l.created_at, l.updated_at
       FROM listings l
      WHERE l.status IN ('pending_review', 'approved', 'rejected', 'archived', 'expired')
      ORDER BY l.updated_at DESC
      LIMIT 250`,
  )
    .all<Row>();

  if (!result.success) return databaseError(cors);

  const listings = (result.results ?? []).map((row) => ({
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    title: stringValue(row.title),
    status: stringValue(row.status, "pending_review"),
    categoryId: stringValue(row.category_id),
    governorateId: stringValue(row.governorate_id),
    rejectionReason: null,
    expiresAt: nullableString(row.expires_at),
    reviewedAt: null,
    publishedAt: nullableString(row.published_at),
    archivedAt: nullableString(row.archived_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  }));

  return json({ data: listings }, 200, cors);
}

async function adminModerationListings(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "moderator")) return forbidden(cors);

  const result = await env.DB.prepare(
    `SELECT l.id, l.owner_id, l.title, l.status, l.category_id, l.governorate_id,
            l.expires_at, l.published_at, l.archived_at, l.created_at, l.updated_at
       FROM listings l
      WHERE l.status IN ('pending_review', 'approved', 'rejected', 'archived', 'expired')
      ORDER BY l.updated_at DESC
      LIMIT 250`,
  )
    .all<Row>();

  if (!result.success) return databaseError(cors);

  const listings = (result.results ?? []).map((row) => ({
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    title: stringValue(row.title),
    status: stringValue(row.status, "pending_review"),
    categoryId: stringValue(row.category_id),
    governorateId: stringValue(row.governorate_id),
    rejectionReason: null,
    expiresAt: nullableString(row.expires_at),
    reviewedAt: null,
    publishedAt: nullableString(row.published_at),
    archivedAt: nullableString(row.archived_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  }));

  return json({ data: listings }, 200, cors);
}

async function adminModerateListing(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!requireAdminRole(auth, "moderator")) return forbidden(cors);

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const listingId = clean(body.data.listingId, 120);
  const action = clean(body.data.action, 40);
  const reason = clean(body.data.reason, 500);
  const expectedUpdatedAt = clean(body.data.expectedUpdatedAt, 120);
  const extendDays = body.data.extendDays ?? null;

  if (!listingId || !action || !expectedUpdatedAt || (action === "reject" && !reason)) {
    return validation(cors, "Invalid moderation payload.");
  }

  const listing = await env.DB.prepare(
    "SELECT status, updated_at FROM listings WHERE id = ?",
  )
    .bind(listingId)
    .first<{ status: string; updated_at: string }>();
  if (!listing) return notFound(cors);
  if (listing.updated_at !== expectedUpdatedAt) {
    return json(
      { error: { code: "stale_review", message: "Listing changed since loaded." } },
      409,
      cors,
    );
  }

  let nextStatus = listing.status;
  switch (action) {
    case "approve":
      nextStatus = "approved";
      break;
    case "reject":
      nextStatus = "rejected";
      break;
    case "request_changes":
      nextStatus = "rejected";
      break;
    case "suspend":
      nextStatus = "archived";
      break;
    case "unpublish":
      nextStatus = "archived";
      break;
    case "archive":
      nextStatus = "archived";
      break;
    case "expire_now":
      nextStatus = "expired";
      break;
    case "extend_expiry": {
      const days = Number.isInteger(extendDays) && typeof extendDays === "number" && extendDays > 0 ? extendDays : 30;
      const newExpires = new Date();
      newExpires.setDate(newExpires.getDate() + days);
      const result = await env.DB.prepare(
        "UPDATE listings SET expires_at = ?, updated_at = ? WHERE id = ?",
      )
        .bind(newExpires.toISOString(), now(), listingId)
        .run();
      if (!result.success) return databaseError(cors);
      await writeAuditLog(env, auth.userId, auth.roles[0] ?? "admin", "listing_extend_expiry", "listings", listingId, { extendDays: days });
      return json(
        {
          data: {
            listingId,
            previousStatus: listing.status,
            nextStatus: listing.status,
            updatedAt: now(),
          },
        },
        200,
        cors,
      );
    }
    default:
      return validation(cors, "Unsupported action.");
  }

  const reviewedAt = ["approved", "rejected", "archived"].includes(nextStatus) ? now() : null;
  const result = await env.DB.prepare(
    `UPDATE listings SET status = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(nextStatus, now(), listingId)
    .run();

  if (!result.success) return databaseError(cors);

  await writeAuditLog(env, auth.userId, auth.roles[0] ?? "admin", `listing_${action}`, "listings", listingId, { reason });

  return json(
    {
      data: {
        listingId,
        previousStatus: listing.status,
        nextStatus,
        updatedAt: now(),
      },
    },
    200,
    cors,
  );
}

async function writeAuditLog(
  env: AdminEnv,
  actorId: string,
  actorRole: string,
  action: string,
  targetTable: string | null,
  targetId: string | null,
  metadata: Record<string, unknown>,
) {
  const id = crypto.randomUUID();
  const timestamp = now();
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, actorId, action, targetTable, targetId, JSON.stringify(metadata), timestamp)
    .run();
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const repaired = repairWindows1256Mojibake(value);
  return repaired || fallback;
}

function nullableString(value: unknown): string | null {
  if (typeof value !== "string" || !value.length) return null;
  return repairWindows1256Mojibake(value);
}

function numberValue(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim()
    : null;
}

function integerParam(request: Request, fallback: number, min: number, max: number): number {
  const value = new URL(request.url).searchParams.get("limit");
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function now() {
  return new Date().toISOString();
}

function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}

function unauthorized(cors: Headers) {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}

function forbidden(cors: Headers) {
  return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors);
}

function notFound(cors: Headers) {
  return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
}

function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_unavailable", message: "Data service unavailable." } },
    503,
    cors,
  );
}

const windows1256Decoder = new TextDecoder("windows-1256");
const windows1256Reverse = new Map<string, number>(
  Array.from({ length: 256 }, (_, byte) => [
    windows1256Decoder.decode(Uint8Array.of(byte)),
    byte,
  ]),
);

function repairWindows1256Mojibake(value: string): string {
  if (!/[طظ]/.test(value)) return value;
  const bytes: number[] = [];
  for (const character of value) {
    const byte = windows1256Reverse.get(character);
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  const repaired = new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
  return repaired.includes("\uFFFD") ? value : repaired;
}
