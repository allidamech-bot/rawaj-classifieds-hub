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
export interface AdminSafetyEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

const SOURCES = new Set(["manual", "listing_report", "message_report", "account"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const STATUSES = new Set(["open", "investigating", "mitigated", "closed"]);
const LINK_TYPES = new Set(["listing_report", "message_report", "listing", "account"]);

function asAuthEnv(env: AdminSafetyEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleAdminSafety(
  request: Request,
  env: AdminSafetyEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!path.startsWith("/v1/admin/safety/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/admin/safety/cases") {
    if (request.method === "GET") return listCases(request, env, cors, url);
    if (request.method === "POST") return saveCase(request, env, cors, null);
  }
  if (path === "/v1/admin/safety/staff" && request.method === "GET") {
    return listStaff(request, env, cors);
  }

  const notesMatch = path.match(/^\/v1\/admin\/safety\/cases\/([^/]+)\/notes$/);
  if (notesMatch) {
    const caseId = decodeURIComponent(notesMatch[1]);
    if (request.method === "GET") return listNotes(request, env, cors, caseId);
    if (request.method === "POST") return addNote(request, env, cors, caseId);
  }
  const linksMatch = path.match(/^\/v1\/admin\/safety\/cases\/([^/]+)\/links$/);
  if (linksMatch) {
    const caseId = decodeURIComponent(linksMatch[1]);
    if (request.method === "GET") return listLinks(request, env, cors, caseId);
    if (request.method === "POST") return addLink(request, env, cors, caseId);
  }
  const statusMatch = path.match(/^\/v1\/admin\/safety\/cases\/([^/]+)\/status$/);
  if (statusMatch && request.method === "PATCH") {
    return setStatus(request, env, cors, decodeURIComponent(statusMatch[1]));
  }
  const escalationMatch = path.match(/^\/v1\/admin\/safety\/cases\/([^/]+)\/escalate$/);
  if (escalationMatch && request.method === "POST") {
    return escalate(request, env, cors, decodeURIComponent(escalationMatch[1]));
  }
  const caseMatch = path.match(/^\/v1\/admin\/safety\/cases\/([^/]+)$/);
  if (caseMatch && request.method === "PATCH") {
    return saveCase(request, env, cors, decodeURIComponent(caseMatch[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function listCases(request: Request, env: AdminSafetyEnv, cors: Headers, url: URL) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const requested = clean(url.searchParams.get("status"), 30);
  const status = requested && requested !== "all" ? requested : null;
  if (status && !STATUSES.has(status)) return validation(cors, "حالة القضية غير صالحة.");
  const result = status
    ? await env.DB.prepare(
        `SELECT * FROM safety_cases WHERE status = ?
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                  updated_at DESC LIMIT 200`,
      )
        .bind(status)
        .all<Row>()
    : await env.DB.prepare(
        `SELECT * FROM safety_cases
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                  updated_at DESC LIMIT 200`,
      ).all<Row>();
  if (!result.success) return databaseError(cors);
  return json({ data: (result.results ?? []).map(mapCase) }, 200, cors);
}

async function listStaff(request: Request, env: AdminSafetyEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const result = await env.DB.prepare(
    `SELECT u.id, u.email, p.display_name, group_concat(DISTINCT r.role) AS roles
       FROM auth_users u
       JOIN public_profiles p ON p.id = u.id
       JOIN user_roles r ON r.user_id = u.id
      WHERE p.account_status = 'active' AND r.role IN ('owner', 'admin', 'moderator')
      GROUP BY u.id, u.email, p.display_name
      ORDER BY coalesce(nullif(trim(p.display_name), ''), u.email, u.id)`,
  ).all<Row>();
  if (!result.success) return databaseError(cors);
  return json(
    {
      data: (result.results ?? []).map((row) => ({
        id: stringValue(row.id),
        displayName: nullableString(row.display_name) ?? stringValue(row.email),
        email: stringValue(row.email),
        roles: typeof row.roles === "string" ? row.roles.split(",").filter(Boolean) : [],
      })),
    },
    200,
    cors,
  );
}

async function saveCase(
  request: Request,
  env: AdminSafetyEnv,
  cors: Headers,
  caseId: string | null,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const parsed = parseCase(body.data, caseId !== null);
  if (!parsed.ok) return validation(cors, parsed.message);
  if (parsed.value.assignedTo && !(await isSafetyStaff(env, parsed.value.assignedTo))) {
    return validation(cors, "الموظف المعيّن غير مخول لإدارة قضايا السلامة.");
  }
  const timestamp = now();
  const id = caseId ?? crypto.randomUUID();

  if (!caseId) {
    const inserted = await env.DB.prepare(
      `INSERT INTO safety_cases (
        id, source_type, source_id, subject_user_id, title, summary, severity, status,
        assigned_to, resolution_note, escalated_to_owner, version, created_by, updated_by,
        created_at, updated_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL, 0, 1, ?, ?, ?, ?, NULL)`,
    )
      .bind(
        id,
        parsed.value.sourceType,
        parsed.value.sourceId,
        parsed.value.subjectUserId,
        parsed.value.title,
        parsed.value.summary,
        parsed.value.severity,
        parsed.value.assignedTo,
        auth.userId,
        auth.userId,
        timestamp,
        timestamp,
      )
      .run();
    if (!inserted.success) {
      if ((inserted.error ?? "").includes("UNIQUE")) {
        return conflict(cors, "هذه القضية مرتبطة مسبقًا بالعنصر نفسه.");
      }
      return databaseError(cors);
    }
    await audit(env, auth.userId, "safety_case.created", "safety_cases", id, {
      sourceType: parsed.value.sourceType,
      sourceId: parsed.value.sourceId,
    });
    return json({ data: { id, version: 1, updatedAt: timestamp } }, 201, cors);
  }

  const updated = await env.DB.prepare(
    `UPDATE safety_cases
        SET source_type = ?, source_id = ?, subject_user_id = ?, title = ?, summary = ?,
            severity = ?, assigned_to = ?, version = version + 1, updated_by = ?, updated_at = ?
      WHERE id = ? AND version = ?`,
  )
    .bind(
      parsed.value.sourceType,
      parsed.value.sourceId,
      parsed.value.subjectUserId,
      parsed.value.title,
      parsed.value.summary,
      parsed.value.severity,
      parsed.value.assignedTo,
      auth.userId,
      timestamp,
      id,
      parsed.value.expectedVersion,
    )
    .run();
  if (!updated.success) return databaseError(cors);
  if (!changed(updated)) return conflict(cors, "تغيّرت القضية منذ تحميلها. أعد التحميل قبل الحفظ.");
  const version = parsed.value.expectedVersion + 1;
  await audit(env, auth.userId, "safety_case.updated", "safety_cases", id, { version });
  return json({ data: { id, version, updatedAt: timestamp } }, 200, cors);
}

async function setStatus(request: Request, env: AdminSafetyEnv, cors: Headers, caseId: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const status = clean(body.data.status, 30);
  const reason = clean(body.data.reason, 1000);
  const resolutionNote = nullableClean(body.data.resolutionNote, 6000);
  const expectedVersion = positiveInteger(body.data.expectedVersion);
  if (!STATUSES.has(status) || reason.length < 3 || expectedVersion === null) {
    return validation(cors, "بيانات تغيير حالة القضية غير مكتملة.");
  }
  if (status === "closed" && (resolutionNote?.length ?? 0) < 3) {
    return validation(cors, "أدخل ملاحظة إغلاق واضحة قبل إغلاق القضية.");
  }
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE safety_cases
        SET status = ?, resolution_note = ?, closed_at = ?, version = version + 1,
            updated_by = ?, updated_at = ?
      WHERE id = ? AND version = ?`,
  )
    .bind(
      status,
      resolutionNote,
      status === "closed" ? timestamp : null,
      auth.userId,
      timestamp,
      caseId,
      expectedVersion,
    )
    .run();
  if (!result.success) return databaseError(cors);
  if (!changed(result))
    return conflict(cors, "تغيّرت القضية منذ تحميلها. أعد التحميل قبل تغيير الحالة.");
  const version = expectedVersion + 1;
  await audit(env, auth.userId, "safety_case.status_changed", "safety_cases", caseId, {
    status,
    reason,
    resolutionNote,
    version,
  });
  return json({ data: { id: caseId, version, updatedAt: timestamp } }, 200, cors);
}

async function escalate(request: Request, env: AdminSafetyEnv, cors: Headers, caseId: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reason = clean(body.data.reason, 1000);
  const expectedVersion = positiveInteger(body.data.expectedVersion);
  if (reason.length < 3 || expectedVersion === null)
    return validation(cors, "أدخل سبباً واضحاً للتصعيد.");
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE safety_cases
        SET escalated_to_owner = 1, escalated_at = ?, version = version + 1,
            updated_by = ?, updated_at = ?
      WHERE id = ? AND version = ?`,
  )
    .bind(timestamp, auth.userId, timestamp, caseId, expectedVersion)
    .run();
  if (!result.success) return databaseError(cors);
  if (!changed(result))
    return conflict(cors, "تغيّرت القضية منذ تحميلها. أعد التحميل قبل التصعيد.");
  const version = expectedVersion + 1;
  await audit(env, auth.userId, "safety_case.escalated_to_owner", "safety_cases", caseId, {
    reason,
    version,
  });
  return json({ data: { id: caseId, version, updatedAt: timestamp } }, 200, cors);
}

async function listNotes(request: Request, env: AdminSafetyEnv, cors: Headers, caseId: string) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const result = await env.DB.prepare(
    `SELECT id, case_id, author_id, note, created_at
       FROM safety_case_notes WHERE case_id = ? ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(caseId)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  return json({ data: (result.results ?? []).map(mapNote) }, 200, cors);
}

async function addNote(request: Request, env: AdminSafetyEnv, cors: Headers, caseId: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const note = clean(body.data.note, 4000);
  if (note.length < 2) return validation(cors, "أدخل ملاحظة داخلية واضحة.");
  if (!(await caseExists(env, caseId))) return notFound(cors);
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(
    "INSERT INTO safety_case_notes (id, case_id, author_id, note, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, caseId, auth.userId, note, now())
    .run();
  if (!result.success) return databaseError(cors);
  await audit(env, auth.userId, "safety_case.note_added", "safety_cases", caseId, { noteId: id });
  return json({ data: { id } }, 201, cors);
}

async function listLinks(request: Request, env: AdminSafetyEnv, cors: Headers, caseId: string) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const result = await env.DB.prepare(
    `SELECT id, case_id, link_type, link_id, created_by, created_at
       FROM safety_case_links WHERE case_id = ? ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(caseId)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  return json({ data: (result.results ?? []).map(mapLink) }, 200, cors);
}

async function addLink(request: Request, env: AdminSafetyEnv, cors: Headers, caseId: string) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const linkType = clean(body.data.linkType, 30);
  const linkId = clean(body.data.linkId, 200);
  if (!LINK_TYPES.has(linkType) || !linkId)
    return validation(cors, "بيانات الرابط المرتبط غير مكتملة.");
  if (!(await caseExists(env, caseId))) return notFound(cors);
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(
    `INSERT INTO safety_case_links (id, case_id, link_type, link_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, caseId, linkType, linkId, auth.userId, now())
    .run();
  if (!result.success) {
    if ((result.error ?? "").includes("UNIQUE"))
      return conflict(cors, "الرابط مضاف إلى القضية مسبقًا.");
    return databaseError(cors);
  }
  await audit(env, auth.userId, "safety_case.link_added", "safety_cases", caseId, {
    linkId: id,
    linkType,
  });
  return json({ data: { id } }, 201, cors);
}

function parseCase(
  body: Row,
  update: boolean,
):
  | {
      ok: true;
      value: {
        sourceType: string;
        sourceId: string | null;
        subjectUserId: string | null;
        title: string;
        summary: string;
        severity: string;
        assignedTo: string | null;
        expectedVersion: number;
      };
    }
  | { ok: false; message: string } {
  const sourceType = clean(body.sourceType, 30) || "manual";
  const sourceId = nullableClean(body.sourceId, 200);
  const subjectUserId = nullableClean(body.subjectUserId, 120);
  const title = clean(body.title, 180);
  const summary = clean(body.summary, 6000);
  const severity = clean(body.severity, 30) || "medium";
  const assignedTo = nullableClean(body.assignedTo, 120);
  const expectedVersion = update ? positiveInteger(body.expectedVersion) : 1;
  if (
    !SOURCES.has(sourceType) ||
    !SEVERITIES.has(severity) ||
    title.length < 3 ||
    expectedVersion === null
  ) {
    return { ok: false, message: "بيانات قضية السلامة غير مكتملة." };
  }
  if (sourceType !== "manual" && !sourceId)
    return { ok: false, message: "القضية المرتبطة تحتاج معرف المصدر." };
  return {
    ok: true,
    value: {
      sourceType,
      sourceId,
      subjectUserId,
      title,
      summary,
      severity,
      assignedTo,
      expectedVersion,
    },
  };
}

function mapCase(row: Row) {
  return {
    id: stringValue(row.id),
    sourceType: stringValue(row.source_type, "manual"),
    sourceId: nullableString(row.source_id),
    subjectUserId: nullableString(row.subject_user_id),
    title: stringValue(row.title),
    summary: stringValue(row.summary),
    severity: stringValue(row.severity, "medium"),
    status: stringValue(row.status, "open"),
    assignedTo: nullableString(row.assigned_to),
    resolutionNote: nullableString(row.resolution_note),
    escalatedToOwner: truthy(row.escalated_to_owner),
    escalatedAt: nullableString(row.escalated_at),
    version: numberValue(row.version),
    createdBy: stringValue(row.created_by),
    updatedBy: stringValue(row.updated_by),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    closedAt: nullableString(row.closed_at),
  };
}
function mapNote(row: Row) {
  return {
    id: stringValue(row.id),
    caseId: stringValue(row.case_id),
    authorId: stringValue(row.author_id),
    note: stringValue(row.note),
    createdAt: stringValue(row.created_at),
  };
}
function mapLink(row: Row) {
  return {
    id: stringValue(row.id),
    caseId: stringValue(row.case_id),
    linkType: stringValue(row.link_type),
    linkId: stringValue(row.link_id),
    createdBy: stringValue(row.created_by),
    createdAt: stringValue(row.created_at),
  };
}

async function caseExists(env: AdminSafetyEnv, caseId: string) {
  return Boolean(
    await env.DB.prepare("SELECT id FROM safety_cases WHERE id = ?").bind(caseId).first(),
  );
}
async function isSafetyStaff(env: AdminSafetyEnv, userId: string) {
  const row = await env.DB.prepare(
    `SELECT 1 AS allowed FROM user_roles r JOIN public_profiles p ON p.id = r.user_id
      WHERE r.user_id = ? AND r.role IN ('owner', 'admin', 'moderator') AND p.account_status = 'active' LIMIT 1`,
  )
    .bind(userId)
    .first<{ allowed: number }>();
  return Boolean(row?.allowed);
}
async function audit(
  env: AdminSafetyEnv,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Row,
) {
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      actorId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      now(),
    )
    .run();
}
function isAdminLike(roles: string[]) {
  return roles.some((role) => role === "owner" || role === "admin" || role === "moderator");
}
function changed(result: Result) {
  return (result.meta?.changes ?? 0) > 0;
}
function positiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function nullableClean(value: unknown, max: number): string | null {
  const result = clean(value, max);
  return result || null;
}
function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}
function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function truthy(value: unknown) {
  return value === true || value === 1 || value === "1";
}
function now() {
  return new Date().toISOString();
}
function unauthorized(cors: Headers) {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers) {
  return json(
    { error: { code: "permission_denied", message: "Safety administration permission required." } },
    403,
    cors,
  );
}
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function conflict(cors: Headers, message: string) {
  return json({ error: { code: "status_mismatch", message } }, 409, cors);
}
function notFound(cors: Headers) {
  return json({ error: { code: "not_found", message: "قضية السلامة غير موجودة." } }, 404, cors);
}
function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
