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
export interface AdminEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

function asAuthEnv(env: AdminEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleAdmin(request: Request, env: AdminEnv): Promise<Response | null> {
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
  if (path === "/v1/admin/notifications/summary" && request.method === "GET") {
    return adminNotificationsSummary(request, env, cors);
  }
  if (path === "/v1/admin/notifications" && request.method === "GET") {
    return adminListNotifications(request, env, cors);
  }
  if (path === "/v1/admin/notifications" && request.method === "POST") {
    return adminCreateNotification(request, env, cors);
  }
  if (path === "/v1/admin/notifications/read-by-entity" && request.method === "POST") {
    return adminMarkNotificationsReadByEntity(request, env, cors);
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
  ).first<{ count: number }>();
  const activeUsers = await env.DB.prepare(
    `SELECT count(*) AS count FROM auth_users u
     WHERE u.disabled_at IS NULL
       AND EXISTS (SELECT 1 FROM listings l WHERE l.owner_id = u.id AND l.created_at > datetime('now', '-30 days'))`,
  ).first<{ count: number }>();
  const frozenUsers = await env.DB.prepare(
    `SELECT count(*) AS count FROM public_profiles WHERE account_status = 'frozen'`,
  ).first<{ count: number }>();
  const disabledUsers = await env.DB.prepare(
    `SELECT count(*) AS count FROM public_profiles WHERE account_status = 'disabled'`,
  ).first<{ count: number }>();
  const pendingListings = await env.DB.prepare(
    "SELECT count(*) AS count FROM listings WHERE status = 'pending_review'",
  ).first<{ count: number }>();
  const pendingPromotions = await env.DB.prepare(
    "SELECT count(*) AS count FROM listing_promotion_requests WHERE status = 'pending_review'",
  ).first<{ count: number }>();
  const openListingReports = await env.DB.prepare(
    "SELECT count(*) AS count FROM listing_reports WHERE status IN ('open', 'reviewing')",
  ).first<{ count: number }>();
  const activeRestrictions = await env.DB.prepare(
    "SELECT count(*) AS count FROM user_restrictions WHERE ends_at IS NULL OR ends_at > datetime('now')",
  ).first<{ count: number }>();
  const adminCount = await env.DB.prepare(
    "SELECT count(*) AS count FROM user_roles WHERE role IN ('admin', 'owner')",
  ).first<{ count: number }>();
  const moderatorCount = await env.DB.prepare(
    "SELECT count(*) AS count FROM user_roles WHERE role = 'moderator'",
  ).first<{ count: number }>();

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
        pendingPromotions: numberValue(pendingPromotions?.count),
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
    metadata: parseAuditMetadata(row.metadata),
    createdAt: nullableString(row.created_at),
  }));

  return json({ data: logs }, 200, cors);
}

function parseAuditMetadata(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  if (!value.length) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // malformed JSON, fall through to fallback
  }
  return {};
}

async function adminPendingListings(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "moderator")) return forbidden(cors);

  const result = await env.DB.prepare(
    `SELECT l.id, l.owner_id, l.title, l.status, l.category_id, l.governorate_id,
            l.expires_at, l.published_at, l.archived_at, l.created_at, l.updated_at,
            (SELECT a.reason FROM listing_moderation_actions a
              WHERE a.listing_id = l.id
              ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS rejection_reason,
            (SELECT a.created_at FROM listing_moderation_actions a
              WHERE a.listing_id = l.id
              ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS reviewed_at
       FROM listings l
      WHERE l.status IN ('pending_review', 'approved', 'rejected', 'archived', 'expired')
      ORDER BY l.updated_at DESC
      LIMIT 250`,
  ).all<Row>();

  if (!result.success) return databaseError(cors);

  const listings = (result.results ?? []).map((row) => ({
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    title: stringValue(row.title),
    status: stringValue(row.status, "pending_review"),
    categoryId: stringValue(row.category_id),
    governorateId: stringValue(row.governorate_id),
    rejectionReason: nullableString(row.rejection_reason),
    expiresAt: nullableString(row.expires_at),
    reviewedAt: nullableString(row.reviewed_at),
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
            l.expires_at, l.published_at, l.archived_at, l.created_at, l.updated_at,
            (SELECT a.reason FROM listing_moderation_actions a
              WHERE a.listing_id = l.id
              ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS rejection_reason,
            (SELECT a.created_at FROM listing_moderation_actions a
              WHERE a.listing_id = l.id
              ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS reviewed_at
       FROM listings l
      WHERE l.status IN ('pending_review', 'approved', 'rejected', 'archived', 'expired')
      ORDER BY l.updated_at DESC
      LIMIT 250`,
  ).all<Row>();

  if (!result.success) return databaseError(cors);

  const listings = (result.results ?? []).map((row) => ({
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    title: stringValue(row.title),
    status: stringValue(row.status, "pending_review"),
    categoryId: stringValue(row.category_id),
    governorateId: stringValue(row.governorate_id),
    rejectionReason: nullableString(row.rejection_reason),
    expiresAt: nullableString(row.expires_at),
    reviewedAt: nullableString(row.reviewed_at),
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
  const action = normalizeModerationAction(clean(body.data.action, 40));
  const reason = clean(body.data.reason, 500);
  const expectedUpdatedAt = clean(body.data.expectedUpdatedAt, 120);
  const extendDays = body.data.extendDays ?? null;

  if (!listingId || !expectedUpdatedAt) {
    return validation(cors, "Listing id and expected update timestamp are required.");
  }
  if (!action) {
    return json(
      {
        error: {
          code: "unsupported_moderation_action",
          message:
            "Moderation action must be approve, reject, request_changes, suspend, unpublish, archive, expire_now, or extend_expiry.",
        },
      },
      400,
      cors,
    );
  }
  if (action === "reject" && !reason) {
    return validation(cors, "A rejection reason is required.");
  }

  const listing = await env.DB.prepare("SELECT status, updated_at FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ status: string; updated_at: string }>();
  if (!listing) {
    return json(
      { error: { code: "listing_not_found", message: "The listing to moderate was not found." } },
      404,
      cors,
    );
  }
  if (listing.updated_at !== expectedUpdatedAt) {
    return json(
      { error: { code: "stale_review", message: "Listing changed since loaded." } },
      409,
      cors,
    );
  }
  if (
    ["approve", "reject", "request_changes"].includes(action) &&
    listing.status !== "pending_review"
  ) {
    return json(
      { error: { code: "invalid_transition", message: "Listing is not pending review." } },
      409,
      cors,
    );
  }

  const timestamp = now();
  let updateSql: string;
  let updateParams: Value[];
  let moderationAction: string;
  let nextStatus = listing.status;
  let auditAction = `listing_${action}`;
  let auditMetadata: Record<string, unknown> = { reason };

  switch (action) {
    case "approve":
      nextStatus = "approved";
      updateSql = `UPDATE listings SET status = ?, published_at = COALESCE(?, published_at), updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [nextStatus, timestamp, timestamp, listingId, expectedUpdatedAt];
      moderationAction = "approve";
      auditAction = "listing_approve";
      break;
    case "reject":
      nextStatus = "rejected";
      updateSql = `UPDATE listings SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [nextStatus, null, timestamp, listingId, expectedUpdatedAt];
      moderationAction = "reject";
      auditAction = "listing_reject";
      break;
    case "request_changes":
      nextStatus = "rejected";
      updateSql = `UPDATE listings SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [nextStatus, null, timestamp, listingId, expectedUpdatedAt];
      moderationAction = "request_changes";
      auditAction = "listing_request_changes";
      auditMetadata = { reason };
      break;
    case "suspend":
      nextStatus = "archived";
      updateSql = `UPDATE listings SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [nextStatus, null, timestamp, listingId, expectedUpdatedAt];
      moderationAction = "suspend";
      auditAction = "listing_suspend";
      break;
    case "unpublish":
      nextStatus = "archived";
      updateSql = `UPDATE listings SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [nextStatus, null, timestamp, listingId, expectedUpdatedAt];
      moderationAction = "unpublish";
      auditAction = "listing_unpublish";
      break;
    case "archive":
      nextStatus = "archived";
      updateSql = `UPDATE listings SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [nextStatus, null, timestamp, listingId, expectedUpdatedAt];
      moderationAction = "archive";
      auditAction = "listing_archive";
      break;
    case "expire_now":
      nextStatus = "expired";
      updateSql = `UPDATE listings SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [nextStatus, null, timestamp, listingId, expectedUpdatedAt];
      moderationAction = "expire_now";
      auditAction = "listing_expire_now";
      break;
    case "extend_expiry": {
      const days =
        Number.isInteger(extendDays) && typeof extendDays === "number" && extendDays > 0
          ? extendDays
          : 30;
      const newExpires = new Date();
      newExpires.setDate(newExpires.getDate() + days);
      nextStatus = listing.status;
      updateSql = `UPDATE listings SET expires_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`;
      updateParams = [newExpires.toISOString(), timestamp, listingId, expectedUpdatedAt];
      moderationAction = "extend_expiry";
      auditAction = "listing_extend_expiry";
      auditMetadata = { extendDays: days };
      break;
    }
    default:
      return validation(cors, "Unsupported action.");
  }

  const moderationActionId = crypto.randomUUID();
  const auditLogId = crypto.randomUUID();

  const results = await env.DB.batch([
    env.DB.prepare(updateSql).bind(...updateParams),
    env.DB.prepare(
      `INSERT INTO listing_moderation_actions
          (id, listing_id, actor_id, action, reason, metadata, created_at)
         SELECT ?, ?, ?, ?, ?, '{}', ?
         FROM listings WHERE id = ? AND updated_at = ?`,
    ).bind(
      moderationActionId,
      listingId,
      auth.userId,
      moderationAction,
      reason,
      timestamp,
      listingId,
      timestamp,
    ),
    env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?
       FROM listings WHERE id = ? AND updated_at = ?`,
    ).bind(
      auditLogId,
      auth.userId,
      auditAction,
      "listings",
      listingId,
      JSON.stringify(auditMetadata),
      timestamp,
      listingId,
      timestamp,
    ),
  ]);

  if (results.some((result) => !result.success)) {
    console.error(
      "rawaj_listing_moderation_batch_failed",
      results.map((result) => result.error ?? "unknown_error"),
    );
    return databaseError(cors);
  }

  const persisted = await env.DB.prepare(
    `SELECT l.status, l.updated_at,
            EXISTS(
              SELECT 1 FROM listing_moderation_actions
               WHERE id = ? AND listing_id = ? AND actor_id = ? AND action = ?
            ) AS moderation_ok,
            EXISTS(
              SELECT 1 FROM audit_logs
               WHERE id = ? AND actor_id = ? AND action = ?
                 AND entity_type = 'listings' AND entity_id = ?
            ) AS audit_ok
       FROM listings l
      WHERE l.id = ?`,
  )
    .bind(
      moderationActionId,
      listingId,
      auth.userId,
      moderationAction,
      auditLogId,
      auth.userId,
      auditAction,
      listingId,
      listingId,
    )
    .first<{
      status: string;
      updated_at: string;
      moderation_ok: number;
      audit_ok: number;
    }>();

  if (!persisted || persisted.status !== nextStatus || persisted.updated_at !== timestamp) {
    return json(
      { error: { code: "stale_review", message: "Listing changed since loaded." } },
      409,
      cors,
    );
  }
  if (!persisted.moderation_ok || !persisted.audit_ok) return databaseError(cors);

  return json(
    {
      data: {
        listingId,
        previousStatus: listing.status,
        nextStatus,
        updatedAt: timestamp,
      },
    },
    200,
    cors,
  );
}

function normalizeModerationAction(value: string | null): string | null {
  return [
    "approve",
    "reject",
    "request_changes",
    "suspend",
    "unpublish",
    "archive",
    "expire_now",
    "extend_expiry",
  ].includes(value ?? "")
    ? value
    : null;
}

const NOTIFICATION_EVENT_TYPES = new Set([
  "user_created",
  "listing_submitted",
  "feedback_created",
  "support_created",
  "report_created",
]);
const NOTIFICATION_ENTITY_TYPES = new Set(["users", "listings", "feedback", "support", "reports"]);

export async function ensureAdminNotification(
  env: AdminEnv,
  input: {
    eventType: string;
    entityType: string;
    entityId: string;
    title: string;
    body: string;
    eventKey: string;
  },
): Promise<void> {
  if (
    !NOTIFICATION_EVENT_TYPES.has(input.eventType) ||
    !NOTIFICATION_ENTITY_TYPES.has(input.entityType) ||
    !input.entityId ||
    !input.eventKey
  ) {
    return;
  }
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO admin_notifications
        (id, event_type, entity_type, entity_id, title, body, event_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        input.eventType,
        input.entityType,
        input.entityId.slice(0, 160),
        input.title.slice(0, 300),
        input.body.slice(0, 1000),
        input.eventKey.slice(0, 200),
        now(),
      )
      .run();
  } catch {
    // Notification creation failure must not corrupt the user's primary operation.
  }
}

async function adminNotificationsSummary(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "moderator")) return forbidden(cors);

  const rows = await env.DB.prepare(
    `SELECT an.entity_type,
            COUNT(*) AS total,
            SUM(CASE WHEN anr.read_at IS NULL THEN 1 ELSE 0 END) AS unread
       FROM admin_notifications an
       LEFT JOIN admin_notification_reads anr
         ON anr.notification_id = an.id AND anr.admin_user_id = ?
       GROUP BY an.entity_type`,
  )
    .bind(auth.userId)
    .all<{ entity_type: string; total: number; unread: number }>();

  if (!rows.success) return databaseError(cors);

  const byType: Record<string, number> = {};
  let unreadTotal = 0;
  for (const row of rows.results ?? []) {
    const key = stringValue(row.entity_type);
    const unread = numberValue(row.unread);
    if (unread > 0) {
      byType[key] = unread;
      unreadTotal += unread;
    }
  }

  return json({ data: { unreadTotal, byType } }, 200, cors);
}

async function adminListNotifications(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!requireAdminRole(auth, "moderator")) return forbidden(cors);

  const url = new URL(request.url);
  const entityType = clean(url.searchParams.get("entityType"), 50);
  const limit = integerParam(request, 50, 1, 200);

  const whereClause =
    entityType && NOTIFICATION_ENTITY_TYPES.has(entityType) ? "WHERE an.entity_type = ?" : null;
  const statement = env.DB.prepare(
    `SELECT an.id, an.event_type, an.entity_type, an.entity_id, an.title, an.body,
            an.event_key, an.created_at,
            anr.read_at
       FROM admin_notifications an
       LEFT JOIN admin_notification_reads anr
         ON anr.notification_id = an.id AND anr.admin_user_id = ?
     ${whereClause ?? ""}
     ORDER BY an.created_at DESC
     LIMIT ?`,
  );

  const result = whereClause
    ? await statement.bind(auth.userId, entityType, limit).all<Row>()
    : await statement.bind(auth.userId, limit).all<Row>();

  if (!result.success) return databaseError(cors);

  const items = (result.results ?? []).map((row) => ({
    id: stringValue(row.id),
    eventType: stringValue(row.event_type),
    entityType: stringValue(row.entity_type),
    entityId: stringValue(row.entity_id),
    title: stringValue(row.title),
    body: stringValue(row.body),
    eventKey: stringValue(row.event_key),
    createdAt: stringValue(row.created_at),
    readAt: nullableString(row.read_at),
  }));

  return json({ data: items }, 200, cors);
}

async function adminCreateNotification(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!requireAdminRole(auth, "admin")) return forbidden(cors);

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const eventType = clean(body.data.eventType, 50);
  const entityType = clean(body.data.entityType, 50);
  const entityId = clean(body.data.entityId, 160);
  const title = clean(body.data.title, 300);
  const bodyText = clean(body.data.body, 1000);
  const eventKey = clean(body.data.eventKey, 200);

  if (
    !eventType ||
    !NOTIFICATION_EVENT_TYPES.has(eventType) ||
    !entityType ||
    !NOTIFICATION_ENTITY_TYPES.has(entityType) ||
    !entityId ||
    !title ||
    !bodyText ||
    !eventKey
  ) {
    return validation(cors, "Invalid admin notification payload.");
  }

  await ensureAdminNotification(env, {
    eventType,
    entityType,
    entityId,
    title,
    body: bodyText,
    eventKey,
  });

  return json({ data: { eventKey } }, 201, cors);
}

async function adminMarkNotificationsReadByEntity(request: Request, env: AdminEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!requireAdminRole(auth, "moderator")) return forbidden(cors);

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const entityType = clean(body.data.entityType, 50);
  const entityId = clean(body.data.entityId, 160);
  if (!entityType || !NOTIFICATION_ENTITY_TYPES.has(entityType) || !entityId) {
    return validation(cors, "Entity type and entity id are required.");
  }

  const timestamp = now();
  const notifications = await env.DB.prepare(
    `SELECT an.id FROM admin_notifications an
      WHERE an.entity_type = ? AND an.entity_id = ?`,
  )
    .bind(entityType, entityId)
    .all<{ id: string }>();

  if (!notifications.success) return databaseError(cors);

  const ids = (notifications.results ?? []).map((row) => stringValue(row.id));
  if (ids.length === 0) {
    return json({ data: { markedRead: 0 } }, 200, cors);
  }

  const timestamp2 = timestamp;
  let marked = 0;
  for (const id of ids) {
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO admin_notification_reads (notification_id, admin_user_id, read_at)
       VALUES (?, ?, ?)`,
    )
      .bind(id, auth.userId, timestamp2)
      .run();
    if (result.success) marked += 1;
  }

  return json({ data: { markedRead: marked } }, 200, cors);
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
  Array.from({ length: 256 }, (_, byte) => [windows1256Decoder.decode(Uint8Array.of(byte)), byte]),
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
