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
export interface AdminDataQualityEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

const STATUSES = new Set(["open", "needs_review", "seller_action", "dismissed", "resolved"]);
const ISSUE_TYPES = new Set([
  "taxonomy",
  "required_field",
  "unexpected_field",
  "invalid_value",
  "legacy_payload",
  "specialized_reference",
]);
const SEVERITIES = new Set(["info", "warning", "error", "blocking"]);
const DECISIONS: Record<string, string> = {
  needs_review: "needs_review",
  seller_action: "seller_action",
  dismiss: "dismissed",
  resolve: "resolved",
  reopen: "open",
};

function asAuthEnv(env: AdminDataQualityEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleAdminDataQuality(
  request: Request,
  env: AdminDataQualityEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!path.startsWith("/v1/admin/data-quality")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/admin/data-quality/context" && request.method === "GET") {
    return context(request, env, cors);
  }
  if (path === "/v1/admin/data-quality/issues" && request.method === "GET") {
    return listIssues(request, env, cors, url);
  }
  if (path === "/v1/admin/data-quality/refresh" && request.method === "POST") {
    return refreshIssues(request, env, cors);
  }
  const reviewMatch = path.match(/^\/v1\/admin\/data-quality\/issues\/([^/]+)\/review$/);
  if (reviewMatch && request.method === "PATCH") {
    return reviewIssue(request, env, cors, decodeURIComponent(reviewMatch[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function context(request: Request, env: AdminDataQualityEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);

  const versions = await env.DB.prepare(
    `SELECT v.id, v.version_number, v.status, v.change_summary, v.published_at, v.created_at, v.updated_at,
            (SELECT count(*) FROM taxonomy_nodes) AS node_count,
            (SELECT count(*) FROM taxonomy_nodes WHERE is_active = 1 AND is_leaf = 1) AS active_leaf_count,
            (SELECT count(*) FROM field_definitions WHERE is_active = 1) AS field_rule_count,
            (SELECT count(*) FROM listing_data_quality_issues i WHERE i.taxonomy_version_id = v.id AND i.status IN ('open','needs_review','seller_action')) AS open_issue_count,
            (SELECT count(*) FROM listing_data_quality_issues i WHERE i.taxonomy_version_id = v.id AND i.status IN ('open','needs_review','seller_action') AND i.severity = 'blocking') AS blocking_issue_count
       FROM taxonomy_versions v ORDER BY v.version_number DESC`,
  ).all<Row>();
  const categories = await env.DB.prepare(
    `SELECT c.id, c.name_ar, c.name_en, c.sort_order,
            (SELECT count(*) FROM listing_data_quality_issues i WHERE i.category_id = c.id AND i.status IN ('open','needs_review','seller_action')) AS open_issue_count,
            (SELECT count(*) FROM listing_data_quality_issues i WHERE i.category_id = c.id AND i.status IN ('open','needs_review','seller_action') AND i.severity = 'blocking') AS blocking_issue_count
       FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.id`,
  ).all<Row>();
  const summary = await env.DB.prepare(
    `SELECT count(*) AS total,
            sum(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
            sum(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review,
            sum(CASE WHEN status = 'seller_action' THEN 1 ELSE 0 END) AS seller_action,
            sum(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) AS dismissed,
            sum(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            sum(CASE WHEN severity = 'blocking' AND status IN ('open','needs_review','seller_action') THEN 1 ELSE 0 END) AS blocking,
            sum(CASE WHEN severity = 'error' AND status IN ('open','needs_review','seller_action') THEN 1 ELSE 0 END) AS errors,
            sum(CASE WHEN severity = 'warning' AND status IN ('open','needs_review','seller_action') THEN 1 ELSE 0 END) AS warnings,
            count(DISTINCT CASE WHEN status IN ('open','needs_review','seller_action') THEN category_id END) AS affected_categories,
            count(DISTINCT CASE WHEN status IN ('open','needs_review','seller_action') THEN listing_id END) AS affected_listings
       FROM listing_data_quality_issues`,
  ).first<Row>();
  if (!versions.success || !categories.success) return databaseError(cors);
  return json(
    {
      data: {
        versions: (versions.results ?? []).map((row) => ({
          id: stringValue(row.id),
          versionNumber: numberValue(row.version_number),
          status: stringValue(row.status),
          changeSummary: nullableString(row.change_summary),
          publishedAt: nullableString(row.published_at),
          createdAt: stringValue(row.created_at),
          updatedAt: stringValue(row.updated_at),
          nodeCount: numberValue(row.node_count),
          activeLeafCount: numberValue(row.active_leaf_count),
          fieldRuleCount: numberValue(row.field_rule_count),
          openIssueCount: numberValue(row.open_issue_count),
          blockingIssueCount: numberValue(row.blocking_issue_count),
        })),
        categories: (categories.results ?? []).map((row) => ({
          id: stringValue(row.id),
          nameAr: stringValue(row.name_ar),
          nameEn: nullableString(row.name_en),
          sortOrder: numberValue(row.sort_order),
          openIssueCount: numberValue(row.open_issue_count),
          blockingIssueCount: numberValue(row.blocking_issue_count),
        })),
        summary: {
          total: numberValue(summary?.total),
          open: numberValue(summary?.open),
          needsReview: numberValue(summary?.needs_review),
          sellerAction: numberValue(summary?.seller_action),
          dismissed: numberValue(summary?.dismissed),
          resolved: numberValue(summary?.resolved),
          blocking: numberValue(summary?.blocking),
          errors: numberValue(summary?.errors),
          warnings: numberValue(summary?.warnings),
          affectedCategories: numberValue(summary?.affected_categories),
          affectedListings: numberValue(summary?.affected_listings),
        },
      },
    },
    200,
    cors,
  );
}

async function listIssues(request: Request, env: AdminDataQualityEnv, cors: Headers, url: URL) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const status = nullableQuery(url, "status", 30);
  const issueType = nullableQuery(url, "issueType", 40);
  const categoryId = nullableQuery(url, "categoryId", 160);
  const severity = nullableQuery(url, "severity", 30);
  if (status && !STATUSES.has(status)) return validation(cors, "حالة المشكلة غير صالحة.");
  if (issueType && !ISSUE_TYPES.has(issueType))
    return validation(cors, "نوع مشكلة الجودة غير صالح.");
  if (severity && !SEVERITIES.has(severity))
    return validation(cors, "درجة مشكلة الجودة غير صالحة.");
  const limit = integerParam(url, "limit", 50, 1, 200);
  const offset = integerParam(url, "offset", 0, 0, 1_000_000);
  const clauses: string[] = [];
  const values: Value[] = [];
  if (status) {
    clauses.push("i.status = ?");
    values.push(status);
  }
  if (issueType) {
    clauses.push("i.issue_type = ?");
    values.push(issueType);
  }
  if (categoryId) {
    clauses.push("i.category_id = ?");
    values.push(categoryId);
  }
  if (severity) {
    clauses.push("i.severity = ?");
    values.push(severity);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const count = await env.DB.prepare(
    `SELECT count(*) AS total FROM listing_data_quality_issues i ${where}`,
  )
    .bind(...values)
    .first<{ total: number }>();
  const result = await env.DB.prepare(
    `SELECT i.*, l.title AS listing_title, l.status AS listing_status, l.owner_id,
            c.name_ar AS category_name_ar, c.name_en AS category_name_en,
            s.name_ar AS subcategory_name_ar, s.name_en AS subcategory_name_en,
            v.version_number AS taxonomy_version_number, v.status AS taxonomy_version_status,
            n.name_ar AS taxonomy_name_ar, n.name_en AS taxonomy_name_en,
            f.label_ar AS field_label_ar, f.label_en AS field_label_en
       FROM listing_data_quality_issues i
       JOIN listings l ON l.id = i.listing_id
       JOIN categories c ON c.id = i.category_id
       LEFT JOIN subcategories s ON s.id = i.subcategory_id
       JOIN taxonomy_versions v ON v.id = i.taxonomy_version_id
       LEFT JOIN taxonomy_nodes n ON n.id = i.taxonomy_node_id
       LEFT JOIN field_definitions f ON f.key = i.field_key
       ${where}
      ORDER BY CASE i.severity WHEN 'blocking' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
               i.updated_at DESC, i.id
      LIMIT ? OFFSET ?`,
  )
    .bind(...values, limit, offset)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  return json(
    {
      data: {
        total: numberValue(count?.total),
        limit,
        offset,
        items: (result.results ?? []).map(mapIssue),
      },
    },
    200,
    cors,
  );
}

async function refreshIssues(request: Request, env: AdminDataQualityEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!auth.roles.includes("owner")) return ownerOnly(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const versionId = clean(body.data.versionId, 160);
  const limit = boundedInteger(body.data.limit, 500, 1, 1000);
  const offset = boundedInteger(body.data.offset, 0, 0, 1_000_000);
  if (!versionId) return validation(cors, "نسخة التصنيف مطلوبة.");
  const version = await env.DB.prepare("SELECT id, status FROM taxonomy_versions WHERE id = ?")
    .bind(versionId)
    .first<Row>();
  if (!version) return notFound(cors, "نسخة التصنيف غير موجودة.");
  const listings = await env.DB.prepare(
    `SELECT id, category_id, subcategory_id, title, status, details, updated_at
       FROM listings ORDER BY updated_at DESC, id LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all<Row>();
  if (!listings.success) return databaseError(cors);

  let scanned = 0;
  for (const listing of listings.results ?? []) {
    scanned += 1;
    await scanListing(env, versionId, listing);
  }
  const counts = await env.DB.prepare(
    `SELECT count(*) AS open_count,
            sum(CASE WHEN severity = 'blocking' THEN 1 ELSE 0 END) AS blocking_count
       FROM listing_data_quality_issues
      WHERE taxonomy_version_id = ? AND status IN ('open','needs_review','seller_action')`,
  )
    .bind(versionId)
    .first<Row>();
  await audit(env, auth.userId, "listing_data_quality.refreshed", "taxonomy_versions", versionId, {
    scanned,
    limit,
    offset,
  });
  return json(
    {
      data: {
        versionId,
        versionStatus: stringValue(version.status),
        scannedCount: scanned,
        limit,
        offset,
        openIssueCount: numberValue(counts?.open_count),
        blockingIssueCount: numberValue(counts?.blocking_count),
      },
    },
    200,
    cors,
  );
}

async function scanListing(env: AdminDataQualityEnv, versionId: string, listing: Row) {
  const listingId = stringValue(listing.id);
  const timestamp = now();
  await env.DB.prepare(
    `UPDATE listing_data_quality_issues SET status = 'resolved', resolved_at = ?, updated_at = ?
     WHERE listing_id = ? AND taxonomy_version_id = ? AND status IN ('open','needs_review')`,
  )
    .bind(timestamp, timestamp, listingId, versionId)
    .run();
  const assignment = await env.DB.prepare(
    `SELECT a.taxonomy_node_id, n.is_active, n.is_leaf, n.legacy_category_id, n.filter_schema_key
       FROM listing_taxonomy_assignments a JOIN taxonomy_nodes n ON n.id = a.taxonomy_node_id
      WHERE a.listing_id = ? LIMIT 1`,
  )
    .bind(listingId)
    .first<Row>();
  if (!assignment) {
    await upsertIssue(env, {
      listingId,
      versionId,
      taxonomyNodeId: null,
      categoryId: stringValue(listing.category_id),
      subcategoryId: nullableString(listing.subcategory_id),
      fieldKey: null,
      issueType: "taxonomy",
      issueCode: "taxonomy_assignment_missing",
      severity: "blocking",
      evidence: { listingStatus: listing.status },
      timestamp,
    });
    return;
  }
  const nodeId = stringValue(assignment.taxonomy_node_id);
  if (!truthy(assignment.is_active) || !truthy(assignment.is_leaf)) {
    await upsertIssue(env, {
      listingId,
      versionId,
      taxonomyNodeId: nodeId,
      categoryId: stringValue(listing.category_id),
      subcategoryId: nullableString(listing.subcategory_id),
      fieldKey: null,
      issueType: "taxonomy",
      issueCode: "taxonomy_node_invalid",
      severity: "blocking",
      evidence: { isActive: truthy(assignment.is_active), isLeaf: truthy(assignment.is_leaf) },
      timestamp,
    });
  }
  if (assignment.legacy_category_id && assignment.legacy_category_id !== listing.category_id) {
    await upsertIssue(env, {
      listingId,
      versionId,
      taxonomyNodeId: nodeId,
      categoryId: stringValue(listing.category_id),
      subcategoryId: nullableString(listing.subcategory_id),
      fieldKey: null,
      issueType: "taxonomy",
      issueCode: "taxonomy_category_mismatch",
      severity: "error",
      evidence: {
        expectedCategoryId: assignment.legacy_category_id,
        listingCategoryId: listing.category_id,
      },
      timestamp,
    });
  }
  const details = objectValue(listing.details);
  const required = await requiredFields(env, nullableString(assignment.filter_schema_key));
  for (const field of required) {
    if (hasValue(details[field.key])) continue;
    await upsertIssue(env, {
      listingId,
      versionId,
      taxonomyNodeId: nodeId,
      categoryId: stringValue(listing.category_id),
      subcategoryId: nullableString(listing.subcategory_id),
      fieldKey: field.key,
      issueType: "required_field",
      issueCode: `required_${safeCode(field.key)}`,
      severity: "blocking",
      evidence: { labelAr: field.labelAr },
      timestamp,
    });
  }
  const unresolvedVehicle = await env.DB.prepare(
    `SELECT count(*) AS count FROM vehicle_reference_review_queue
     WHERE listing_id = ? AND status IN ('pending','matched','created')`,
  )
    .bind(listingId)
    .first<{ count: number }>();
  if (numberValue(unresolvedVehicle?.count) > 0) {
    await upsertIssue(env, {
      listingId,
      versionId,
      taxonomyNodeId: nodeId,
      categoryId: stringValue(listing.category_id),
      subcategoryId: nullableString(listing.subcategory_id),
      fieldKey: null,
      issueType: "specialized_reference",
      issueCode: "vehicle_reference_pending",
      severity: "warning",
      evidence: { pendingCount: numberValue(unresolvedVehicle?.count) },
      timestamp,
    });
  }
}

async function requiredFields(env: AdminDataQualityEnv, schemaKey: string | null) {
  if (!schemaKey) return [];
  const tokens = schemaTokens(schemaKey);
  if (!tokens.length) return [];
  const clauses: string[] = [];
  const values: Value[] = [];
  for (const token of tokens) {
    clauses.push("(key = ? OR key LIKE ? OR key LIKE ?)");
    values.push(token, `${token}.%`, `${token}_%`);
  }
  const result = await env.DB.prepare(
    `SELECT key, label_ar, validation_schema FROM field_definitions
     WHERE is_active = 1 AND (${clauses.join(" OR ")}) ORDER BY sort_order, key`,
  )
    .bind(...values)
    .all<Row>();
  return (result.results ?? [])
    .map((row) => ({
      key: stringValue(row.key),
      labelAr: stringValue(row.label_ar),
      validation: objectValue(row.validation_schema),
    }))
    .filter((field) => field.validation.required === true);
}

async function upsertIssue(
  env: AdminDataQualityEnv,
  input: {
    listingId: string;
    versionId: string;
    taxonomyNodeId: string | null;
    categoryId: string;
    subcategoryId: string | null;
    fieldKey: string | null;
    issueType: string;
    issueCode: string;
    severity: string;
    evidence: Row;
    timestamp: string;
  },
) {
  const issueKey = [input.listingId, input.versionId, input.issueCode, input.fieldKey ?? "-"].join(
    ":",
  );
  await env.DB.prepare(
    `INSERT INTO listing_data_quality_issues (
       id, issue_key, listing_id, taxonomy_version_id, taxonomy_node_id, category_id,
       subcategory_id, field_key, issue_type, issue_code, severity, status, evidence,
       detected_at, last_seen_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
     ON CONFLICT(issue_key) DO UPDATE SET
       taxonomy_node_id = excluded.taxonomy_node_id,
       category_id = excluded.category_id,
       subcategory_id = excluded.subcategory_id,
       field_key = excluded.field_key,
       issue_type = excluded.issue_type,
       severity = excluded.severity,
       evidence = excluded.evidence,
       last_seen_at = excluded.last_seen_at,
       status = CASE
         WHEN listing_data_quality_issues.status IN ('dismissed','seller_action') THEN listing_data_quality_issues.status
         ELSE 'open' END,
       resolved_at = CASE
         WHEN listing_data_quality_issues.status IN ('dismissed','seller_action') THEN listing_data_quality_issues.resolved_at
         ELSE NULL END,
       updated_at = excluded.updated_at`,
  )
    .bind(
      crypto.randomUUID(),
      issueKey,
      input.listingId,
      input.versionId,
      input.taxonomyNodeId,
      input.categoryId,
      input.subcategoryId,
      input.fieldKey,
      input.issueType,
      input.issueCode,
      input.severity,
      JSON.stringify(input.evidence),
      input.timestamp,
      input.timestamp,
      input.timestamp,
      input.timestamp,
    )
    .run();
}

async function reviewIssue(
  request: Request,
  env: AdminDataQualityEnv,
  cors: Headers,
  issueId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const decision = clean(body.data.decision, 30);
  const note = nullableClean(body.data.note, 2000);
  const expectedUpdatedAt = clean(body.data.expectedUpdatedAt, 100);
  const nextStatus = DECISIONS[decision];
  if (!nextStatus || !expectedUpdatedAt)
    return validation(cors, "بيانات مراجعة مشكلة الجودة غير مكتملة.");
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE listing_data_quality_issues
        SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ?,
            resolved_at = CASE WHEN ? IN ('dismissed','resolved') THEN ? ELSE NULL END,
            updated_at = ?
      WHERE id = ? AND updated_at = ?`,
  )
    .bind(
      nextStatus,
      auth.userId,
      timestamp,
      note,
      nextStatus,
      timestamp,
      timestamp,
      issueId,
      expectedUpdatedAt,
    )
    .run();
  if (!result.success) return databaseError(cors);
  if (!changed(result)) return stale(cors);
  await audit(
    env,
    auth.userId,
    "listing_data_quality.reviewed",
    "listing_data_quality_issues",
    issueId,
    {
      decision,
      status: nextStatus,
    },
  );
  return json(
    { data: { id: issueId, status: nextStatus, reviewedAt: timestamp, updatedAt: timestamp } },
    200,
    cors,
  );
}

function mapIssue(row: Row) {
  return {
    id: stringValue(row.id),
    listingId: stringValue(row.listing_id),
    listingTitle: stringValue(row.listing_title),
    listingStatus: stringValue(row.listing_status),
    ownerId: stringValue(row.owner_id),
    categoryId: stringValue(row.category_id),
    categoryNameAr: stringValue(row.category_name_ar),
    categoryNameEn: nullableString(row.category_name_en),
    subcategoryId: nullableString(row.subcategory_id),
    subcategoryNameAr: nullableString(row.subcategory_name_ar),
    subcategoryNameEn: nullableString(row.subcategory_name_en),
    taxonomyVersionId: stringValue(row.taxonomy_version_id),
    taxonomyVersionNumber: numberValue(row.taxonomy_version_number),
    taxonomyVersionStatus: stringValue(row.taxonomy_version_status),
    taxonomyNodeId: nullableString(row.taxonomy_node_id),
    taxonomyNameAr: nullableString(row.taxonomy_name_ar),
    taxonomyNameEn: nullableString(row.taxonomy_name_en),
    fieldKey: nullableString(row.field_key),
    fieldLabelAr: nullableString(row.field_label_ar),
    fieldLabelEn: nullableString(row.field_label_en),
    issueType: stringValue(row.issue_type),
    issueCode: stringValue(row.issue_code),
    severity: stringValue(row.severity),
    status: stringValue(row.status),
    evidence: objectValue(row.evidence),
    detectedAt: stringValue(row.detected_at),
    lastSeenAt: stringValue(row.last_seen_at),
    reviewedBy: nullableString(row.reviewed_by),
    reviewedAt: nullableString(row.reviewed_at),
    reviewNote: nullableString(row.review_note),
    resolvedAt: nullableString(row.resolved_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

async function audit(
  env: AdminDataQualityEnv,
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
function schemaTokens(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((item): item is string => typeof item === "string");
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Row).fields))
      return ((parsed as Row).fields as unknown[]).filter(
        (item): item is string => typeof item === "string",
      );
  } catch {
    /* plain key */
  }
  return value
    .split(/[\s,|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function objectValue(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Row) : {};
    } catch {
      return {};
    }
  }
  return {};
}
function hasValue(value: unknown) {
  if (value === null || value === undefined || value === "") return false;
  return !Array.isArray(value) || value.length > 0;
}
function safeCode(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "field"
  );
}
function isAdminLike(roles: string[]) {
  return roles.some((role) => role === "owner" || role === "admin" || role === "moderator");
}
function changed(result: Result) {
  return (result.meta?.changes ?? 0) > 0;
}
function integerParam(url: URL, key: string, fallback: number, min: number, max: number) {
  const number = Number(url.searchParams.get(key));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback;
}
function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback;
}
function nullableQuery(url: URL, key: string, max: number) {
  return nullableClean(url.searchParams.get(key), max);
}
function clean(value: unknown, max: number) {
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
  return typeof value === "string" && value ? value : null;
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
    {
      error: {
        code: "permission_denied",
        message: "Data quality administration permission required.",
      },
    },
    403,
    cors,
  );
}
function ownerOnly(cors: Headers) {
  return json(
    { error: { code: "permission_denied", message: "Owner permission required." } },
    403,
    cors,
  );
}
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function stale(cors: Headers) {
  return json(
    {
      error: {
        code: "status_mismatch",
        message: "تغيّرت نتيجة الفحص. حدّث مركز الجودة قبل إعادة المحاولة.",
      },
    },
    409,
    cors,
  );
}
function notFound(cors: Headers, message: string) {
  return json({ error: { code: "not_found", message } }, 404, cors);
}
function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
