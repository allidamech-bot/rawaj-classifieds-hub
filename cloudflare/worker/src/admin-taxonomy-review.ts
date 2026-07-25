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
export interface AdminTaxonomyReviewEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

const TAXONOMY_STATUSES = new Set([
  "pending",
  "auto_mapped",
  "needs_review",
  "confirmed",
  "unresolved",
  "rejected",
  "applied",
]);
const VEHICLE_STATUSES = new Set(["pending", "matched", "created", "rejected", "applied"]);
const VEHICLE_TYPES = new Set(["make", "model", "generation", "trim"]);

interface VehicleInsertValue {
  entityType: string;
  table: string;
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  aliases: string[];
  countryCode: string | null;
  vehicleType: string | null;
  generationId: string | null;
  startYear: number | null;
  endYear: number | null;
  parentMakeId: string | null;
  parentModelId: string | null;
}

function asAuthEnv(env: AdminTaxonomyReviewEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleAdminTaxonomyReview(
  request: Request,
  env: AdminTaxonomyReviewEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!/^\/v1\/admin\/(?:taxonomy-mappings|vehicle-references)(?:\/|$)/.test(path)) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/admin/taxonomy-mappings" && request.method === "GET") {
    return listTaxonomyMappings(request, env, cors, url);
  }
  const taxonomyReview = path.match(/^\/v1\/admin\/taxonomy-mappings\/([^/]+)\/review$/);
  if (taxonomyReview && request.method === "PATCH") {
    return reviewTaxonomyMapping(request, env, cors, decodeURIComponent(taxonomyReview[1]));
  }
  const taxonomyApply = path.match(/^\/v1\/admin\/taxonomy-mappings\/([^/]+)\/apply$/);
  if (taxonomyApply && request.method === "POST") {
    return applyTaxonomyMapping(request, env, cors, decodeURIComponent(taxonomyApply[1]));
  }

  if (path === "/v1/admin/vehicle-references" && request.method === "GET") {
    return listVehicleReferences(request, env, cors, url);
  }
  const vehicleReview = path.match(/^\/v1\/admin\/vehicle-references\/([^/]+)\/review$/);
  if (vehicleReview && request.method === "PATCH") {
    return reviewVehicleReference(request, env, cors, decodeURIComponent(vehicleReview[1]));
  }
  const vehicleCreate = path.match(/^\/v1\/admin\/vehicle-references\/([^/]+)\/create$/);
  if (vehicleCreate && request.method === "POST") {
    return createVehicleReference(request, env, cors, decodeURIComponent(vehicleCreate[1]));
  }
  const vehicleApply = path.match(/^\/v1\/admin\/vehicle-references\/([^/]+)\/apply$/);
  if (vehicleApply && request.method === "POST") {
    return applyVehicleReference(request, env, cors, decodeURIComponent(vehicleApply[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function listTaxonomyMappings(
  request: Request,
  env: AdminTaxonomyReviewEnv,
  cors: Headers,
  url: URL,
) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const status = nullableQuery(url, "status", 30);
  if (status && !TAXONOMY_STATUSES.has(status)) return validation(cors, "حالة قائمة المراجعة غير صالحة.");
  const limit = integerParam(url, "limit", 50, 1, 200);
  const offset = integerParam(url, "offset", 0, 0, 1_000_000);
  const where = status ? "WHERE q.status = ?" : "";
  const count = status
    ? await env.DB.prepare("SELECT count(*) AS total FROM taxonomy_mapping_queue WHERE status = ?")
        .bind(status)
        .first<{ total: number }>()
    : await env.DB.prepare("SELECT count(*) AS total FROM taxonomy_mapping_queue").first<{ total: number }>();
  const statement = env.DB.prepare(
    `SELECT q.*, l.title AS listing_title, l.status AS listing_status,
            l.category_id AS listing_category_id, l.subcategory_id AS listing_subcategory_id,
            l.updated_at AS listing_updated_at, v.version_number AS suggested_version_number,
            v.status AS suggested_version_status, n.name_ar AS suggested_name_ar,
            n.name_en AS suggested_name_en
       FROM taxonomy_mapping_queue q
       JOIN listings l ON l.id = q.listing_id
       LEFT JOIN taxonomy_versions v ON v.id = q.suggested_version_id
       LEFT JOIN taxonomy_nodes n ON n.id = q.suggested_taxonomy_node_id
       ${where}
      ORDER BY CASE q.status
        WHEN 'needs_review' THEN 1 WHEN 'unresolved' THEN 2 WHEN 'auto_mapped' THEN 3
        WHEN 'pending' THEN 4 WHEN 'confirmed' THEN 5 WHEN 'rejected' THEN 6 ELSE 7 END,
        q.confidence DESC, q.updated_at DESC, q.listing_id
      LIMIT ? OFFSET ?`,
  );
  const result = status
    ? await statement.bind(status, limit, offset).all<Row>()
    : await statement.bind(limit, offset).all<Row>();
  if (!result.success) return databaseError(cors);
  return json(
    { data: { total: numberValue(count?.total), limit, offset, items: (result.results ?? []).map(mapTaxonomyQueue) } },
    200,
    cors,
  );
}

async function reviewTaxonomyMapping(
  request: Request,
  env: AdminTaxonomyReviewEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const decision = clean(body.data.decision, 20);
  const expectedUpdatedAt = clean(body.data.expectedQueueUpdatedAt, 100);
  const note = nullableClean(body.data.note, 2000);
  if (!expectedUpdatedAt || !["confirm", "reject"].includes(decision)) {
    return validation(cors, "بيانات مراجعة التصنيف غير مكتملة.");
  }
  const current = await env.DB.prepare(
    `SELECT q.*, l.updated_at AS listing_updated_at FROM taxonomy_mapping_queue q
     JOIN listings l ON l.id = q.listing_id WHERE q.listing_id = ?`,
  )
    .bind(listingId)
    .first<Row>();
  if (!current) return notFound(cors, "عنصر مراجعة التصنيف غير موجود.");
  if (stringValue(current.updated_at) !== expectedUpdatedAt) return stale(cors);

  let versionId = nullableClean(body.data.versionId, 120) ?? nullableString(current.suggested_version_id);
  let nodeId = nullableClean(body.data.taxonomyNodeId, 160) ?? nullableString(current.suggested_taxonomy_node_id);
  if (decision === "confirm") {
    if (!versionId || !nodeId) return validation(cors, "اختر نسخة التصنيف والعقدة قبل التأكيد.");
    const target = await env.DB.prepare(
      `SELECT n.id, n.is_active, n.is_leaf, v.status AS version_status
       FROM taxonomy_nodes n CROSS JOIN taxonomy_versions v WHERE n.id = ? AND v.id = ?`,
    )
      .bind(nodeId, versionId)
      .first<Row>();
    if (!target || !truthy(target.is_active) || !truthy(target.is_leaf)) {
      return validation(cors, "عقدة التصنيف المختارة غير صالحة أو غير نهائية.");
    }
  } else {
    versionId = null;
    nodeId = null;
  }
  const timestamp = now();
  const status = decision === "confirm" ? "confirmed" : "rejected";
  const result = await env.DB.prepare(
    `UPDATE taxonomy_mapping_queue
        SET status = ?, suggested_version_id = ?, suggested_taxonomy_node_id = ?,
            reviewed_by = ?, reviewed_at = ?, review_note = ?, reviewed_listing_updated_at = ?, updated_at = ?
      WHERE listing_id = ? AND updated_at = ?`,
  )
    .bind(
      status,
      versionId,
      nodeId,
      auth.userId,
      timestamp,
      note,
      stringValue(current.listing_updated_at),
      timestamp,
      listingId,
      expectedUpdatedAt,
    )
    .run();
  if (!result.success) return databaseError(cors);
  if (!changed(result)) return stale(cors);
  await audit(env, auth.userId, "taxonomy_mapping.reviewed", "taxonomy_mapping_queue", listingId, {
    decision,
    versionId,
    nodeId,
  });
  return json({ data: { listingId, status, reviewedAt: timestamp, updatedAt: timestamp } }, 200, cors);
}

async function applyTaxonomyMapping(
  request: Request,
  env: AdminTaxonomyReviewEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!auth.roles.includes("owner")) return ownerOnly(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const expectedReviewedAt = clean(body.data.expectedReviewedAt, 100);
  if (!expectedReviewedAt) return validation(cors, "نسخة المراجعة مطلوبة.");
  const queue = await env.DB.prepare(
    `SELECT q.*, l.updated_at AS listing_updated_at, v.status AS version_status,
            n.is_active AS node_active, n.is_leaf AS node_leaf
       FROM taxonomy_mapping_queue q
       JOIN listings l ON l.id = q.listing_id
       LEFT JOIN taxonomy_versions v ON v.id = q.suggested_version_id
       LEFT JOIN taxonomy_nodes n ON n.id = q.suggested_taxonomy_node_id
      WHERE q.listing_id = ?`,
  )
    .bind(listingId)
    .first<Row>();
  if (!queue) return notFound(cors, "عنصر مراجعة التصنيف غير موجود.");
  if (
    queue.status !== "confirmed" ||
    queue.reviewed_at !== expectedReviewedAt ||
    queue.version_status !== "published" ||
    !truthy(queue.node_active) ||
    !truthy(queue.node_leaf) ||
    queue.listing_updated_at !== queue.reviewed_listing_updated_at
  ) {
    return stale(cors);
  }
  const nodeId = stringValue(queue.suggested_taxonomy_node_id);
  const timestamp = now();
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM listing_taxonomy_assignments WHERE listing_id = ?").bind(listingId),
    env.DB.prepare(
      "INSERT INTO listing_taxonomy_assignments (listing_id, taxonomy_node_id, created_at) VALUES (?, ?, ?)",
    ).bind(listingId, nodeId, timestamp),
    env.DB.prepare(
      `UPDATE taxonomy_mapping_queue SET status = 'applied', applied_by = ?, applied_at = ?, updated_at = ?
       WHERE listing_id = ? AND status = 'confirmed' AND reviewed_at = ?`,
    ).bind(auth.userId, timestamp, timestamp, listingId, expectedReviewedAt),
  ]);
  if (results.some((result) => !result.success)) return databaseError(cors);
  await audit(env, auth.userId, "taxonomy_mapping.applied", "taxonomy_mapping_queue", listingId, {
    nodeId,
  });
  return json({ data: { listingId, taxonomyNodeId: nodeId, status: "applied", appliedAt: timestamp } }, 200, cors);
}

async function listVehicleReferences(
  request: Request,
  env: AdminTaxonomyReviewEnv,
  cors: Headers,
  url: URL,
) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const status = nullableQuery(url, "status", 30);
  const entityType = nullableQuery(url, "entityType", 30);
  if (status && !VEHICLE_STATUSES.has(status)) return validation(cors, "حالة مرجع المركبة غير صالحة.");
  if (entityType && !VEHICLE_TYPES.has(entityType)) return validation(cors, "نوع مرجع المركبة غير صالح.");
  const limit = integerParam(url, "limit", 50, 1, 200);
  const offset = integerParam(url, "offset", 0, 0, 1_000_000);
  const where: string[] = [];
  const values: Value[] = [];
  if (status) { where.push("q.status = ?"); values.push(status); }
  if (entityType) { where.push("q.entity_type = ?"); values.push(entityType); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await env.DB.prepare(`SELECT count(*) AS total FROM vehicle_reference_review_queue q ${whereSql}`)
    .bind(...values)
    .first<{ total: number }>();
  const result = await env.DB.prepare(
    `SELECT q.*, mk.name_ar AS parent_make_name_ar, mk.name_en AS parent_make_name_en,
            md.name_ar AS parent_model_name_ar, md.name_en AS parent_model_name_en,
            l.title AS listing_title, l.status AS listing_status, l.updated_at AS listing_updated_at
       FROM vehicle_reference_review_queue q
       LEFT JOIN vehicle_makes mk ON mk.id = q.parent_make_id
       LEFT JOIN vehicle_models md ON md.id = q.parent_model_id
       LEFT JOIN listings l ON l.id = q.listing_id
       ${whereSql}
      ORDER BY CASE q.status WHEN 'pending' THEN 1 WHEN 'matched' THEN 2 WHEN 'created' THEN 3 WHEN 'rejected' THEN 4 ELSE 5 END,
               q.occurrence_count DESC, q.updated_at DESC, q.id
      LIMIT ? OFFSET ?`,
  )
    .bind(...values, limit, offset)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  const items = [];
  for (const row of result.results ?? []) items.push(await mapVehicleQueue(env, row));
  return json({ data: { total: numberValue(count?.total), limit, offset, items } }, 200, cors);
}

async function reviewVehicleReference(
  request: Request,
  env: AdminTaxonomyReviewEnv,
  cors: Headers,
  queueId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!isAdminLike(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const decision = clean(body.data.decision, 20);
  const expectedUpdatedAt = clean(body.data.expectedQueueUpdatedAt, 100);
  const matchId = nullableClean(body.data.matchId, 160);
  const note = nullableClean(body.data.note, 2000);
  if (!expectedUpdatedAt || !["match", "reject"].includes(decision)) return validation(cors, "بيانات المراجعة غير مكتملة.");
  const queue = await env.DB.prepare(
    `SELECT q.*, l.updated_at AS listing_updated_at FROM vehicle_reference_review_queue q
     LEFT JOIN listings l ON l.id = q.listing_id WHERE q.id = ?`,
  )
    .bind(queueId)
    .first<Row>();
  if (!queue) return notFound(cors, "عنصر مراجعة المرجع غير موجود.");
  if (queue.updated_at !== expectedUpdatedAt) return stale(cors);
  if (decision === "match") {
    if (!matchId || !(await vehicleReferenceExists(env, stringValue(queue.entity_type), matchId))) {
      return validation(cors, "اختر مرجع مركبة صالحًا قبل المطابقة.");
    }
  }
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE vehicle_reference_review_queue
        SET status = ?, suggested_match_id = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?,
            reviewed_listing_updated_at = ?, updated_at = ?
      WHERE id = ? AND updated_at = ?`,
  )
    .bind(
      decision === "match" ? "matched" : "rejected",
      decision === "match" ? matchId : null,
      note,
      auth.userId,
      timestamp,
      nullableString(queue.listing_updated_at),
      timestamp,
      queueId,
      expectedUpdatedAt,
    )
    .run();
  if (!result.success) return databaseError(cors);
  if (!changed(result)) return stale(cors);
  await audit(env, auth.userId, "vehicle_reference.reviewed", "vehicle_reference_review_queue", queueId, {
    decision,
    matchId,
  });
  return json({ data: { id: queueId, status: decision === "match" ? "matched" : "rejected", reviewedAt: timestamp, updatedAt: timestamp } }, 200, cors);
}

async function createVehicleReference(
  request: Request,
  env: AdminTaxonomyReviewEnv,
  cors: Headers,
  queueId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!auth.roles.includes("owner")) return ownerOnly(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const expectedUpdatedAt = clean(body.data.expectedQueueUpdatedAt, 100);
  const reference = objectValue(body.data.reference);
  const queue = await env.DB.prepare("SELECT * FROM vehicle_reference_review_queue WHERE id = ?")
    .bind(queueId)
    .first<Row>();
  if (!queue) return notFound(cors, "عنصر مراجعة المرجع غير موجود.");
  if (!expectedUpdatedAt || queue.updated_at !== expectedUpdatedAt) return stale(cors);
  const parsed = parseVehicleDraft(stringValue(queue.entity_type), reference, queue);
  if (!parsed.ok) return validation(cors, parsed.message);
  const timestamp = now();
  const insert = vehicleInsert(env, parsed.value, timestamp);
  const created = await insert.run();
  if (!created.success) return conflict(cors, "تعذر إنشاء المرجع؛ تحقق من المعرف والاسم والعلاقات الأبويّة.");
  const updated = await env.DB.prepare(
    `UPDATE vehicle_reference_review_queue
        SET status = 'created', created_reference_id = ?, suggested_match_id = ?, review_note = ?,
            reviewed_by = ?, reviewed_at = ?, reviewed_listing_updated_at =
              (SELECT updated_at FROM listings WHERE id = vehicle_reference_review_queue.listing_id),
            updated_at = ?
      WHERE id = ? AND updated_at = ?`,
  )
    .bind(parsed.value.id, parsed.value.id, nullableClean(body.data.note, 2000), auth.userId, timestamp, timestamp, queueId, expectedUpdatedAt)
    .run();
  if (!updated.success || !changed(updated)) return stale(cors);
  await audit(env, auth.userId, "vehicle_reference.created", parsed.value.table, parsed.value.id, {
    queueId,
    entityType: parsed.value.entityType,
  });
  return json({ data: { id: queueId, referenceId: parsed.value.id, status: "created", reviewedAt: timestamp, updatedAt: timestamp } }, 201, cors);
}

async function applyVehicleReference(
  request: Request,
  env: AdminTaxonomyReviewEnv,
  cors: Headers,
  queueId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!auth.roles.includes("owner")) return ownerOnly(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const expectedReviewedAt = clean(body.data.expectedReviewedAt, 100);
  const queue = await env.DB.prepare(
    `SELECT q.*, l.details AS listing_details, l.updated_at AS listing_updated_at
       FROM vehicle_reference_review_queue q LEFT JOIN listings l ON l.id = q.listing_id WHERE q.id = ?`,
  )
    .bind(queueId)
    .first<Row>();
  if (!queue) return notFound(cors, "عنصر مراجعة المرجع غير موجود.");
  if (
    !["matched", "created"].includes(stringValue(queue.status)) ||
    queue.reviewed_at !== expectedReviewedAt ||
    !queue.suggested_match_id ||
    (queue.listing_id && queue.listing_updated_at !== queue.reviewed_listing_updated_at)
  ) return stale(cors);

  const timestamp = now();
  if (queue.listing_id) {
    const details = objectValue(queue.listing_details);
    details[`vehicle_${stringValue(queue.entity_type)}_id`] = stringValue(queue.suggested_match_id);
    const listingUpdate = await env.DB.prepare(
      "UPDATE listings SET details = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
    )
      .bind(JSON.stringify(details), timestamp, stringValue(queue.listing_id), stringValue(queue.listing_updated_at))
      .run();
    if (!listingUpdate.success || !changed(listingUpdate)) return stale(cors);
  }
  const result = await env.DB.prepare(
    `UPDATE vehicle_reference_review_queue SET status = 'applied', applied_by = ?, applied_at = ?, updated_at = ?
     WHERE id = ? AND reviewed_at = ? AND status IN ('matched', 'created')`,
  )
    .bind(auth.userId, timestamp, timestamp, queueId, expectedReviewedAt)
    .run();
  if (!result.success || !changed(result)) return stale(cors);
  await audit(env, auth.userId, "vehicle_reference.applied", "vehicle_reference_review_queue", queueId, {
    referenceId: queue.suggested_match_id,
    listingId: queue.listing_id,
  });
  return json({ data: { id: queueId, status: "applied", appliedAt: timestamp } }, 200, cors);
}

function parseVehicleDraft(
  entityType: string,
  reference: Row,
  queue: Row,
):
  | { ok: true; value: { entityType: string; table: string; id: string; slug: string; nameAr: string; nameEn: string; aliases: string[]; countryCode: string | null; vehicleType: string | null; generationId: string | null; startYear: number | null; endYear: number | null; parentMakeId: string | null; parentModelId: string | null } }
  | { ok: false; message: string } {
  const id = clean(reference.id, 160);
  const nameAr = clean(reference.nameAr, 160);
  const nameEn = clean(reference.nameEn, 160) || nameAr;
  const slug = clean(reference.slug, 160) || slugify(nameEn || nameAr || id);
  const aliases = stringArray(reference.aliases, 50);
  const parentMakeId = nullableClean(reference.parentMakeId, 160) ?? nullableString(queue.parent_make_id);
  const parentModelId = nullableClean(reference.parentModelId, 160) ?? nullableString(queue.parent_model_id);
  if (!VEHICLE_TYPES.has(entityType) || !id || !nameAr || !slug) return { ok: false, message: "بيانات مرجع المركبة غير مكتملة." };
  if (entityType === "model" && !parentMakeId) return { ok: false, message: "موديل المركبة يحتاج شركة مصنّعة." };
  if ((entityType === "generation" || entityType === "trim") && !parentModelId) return { ok: false, message: "هذا المرجع يحتاج موديل مركبة أبًا." };
  return {
    ok: true,
    value: {
      entityType,
      table: entityType === "make" ? "vehicle_makes" : entityType === "model" ? "vehicle_models" : entityType === "generation" ? "vehicle_generations" : "vehicle_trims",
      id,
      slug,
      nameAr,
      nameEn,
      aliases,
      countryCode: nullableClean(reference.countryCode, 10),
      vehicleType: nullableClean(reference.vehicleType, 80),
      generationId: nullableClean(reference.generationId, 160),
      startYear: nullableYear(reference.startYear),
      endYear: nullableYear(reference.endYear),
      parentMakeId,
      parentModelId,
    },
  };
}

function vehicleInsert(env: AdminTaxonomyReviewEnv, value: VehicleInsertValue, timestamp: string): Statement {
  if (value.entityType === "make") {
    return env.DB.prepare(
      `INSERT INTO vehicle_makes (id, slug, name_ar, name_en, aliases, country_code, sort_order, is_active, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1, '{}', ?, ?)`,
    ).bind(value.id, value.slug, value.nameAr, value.nameEn, JSON.stringify(value.aliases), value.countryCode, timestamp, timestamp);
  }
  if (value.entityType === "model") {
    return env.DB.prepare(
      `INSERT INTO vehicle_models (id, make_id, slug, name_ar, name_en, aliases, vehicle_type, start_year, end_year, sort_order, is_active, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, '{}', ?, ?)`,
    ).bind(value.id, value.parentMakeId, value.slug, value.nameAr, value.nameEn, JSON.stringify(value.aliases), value.vehicleType, value.startYear, value.endYear, timestamp, timestamp);
  }
  if (value.entityType === "generation") {
    return env.DB.prepare(
      `INSERT INTO vehicle_generations (id, model_id, slug, name_ar, name_en, aliases, start_year, end_year, sort_order, is_active, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, '{}', ?, ?)`,
    ).bind(value.id, value.parentModelId, value.slug, value.nameAr, value.nameEn, JSON.stringify(value.aliases), value.startYear, value.endYear, timestamp, timestamp);
  }
  return env.DB.prepare(
    `INSERT INTO vehicle_trims (id, model_id, generation_id, slug, name_ar, name_en, aliases, start_year, end_year, sort_order, is_active, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, '{}', ?, ?)`,
  ).bind(value.id, value.parentModelId, value.generationId, value.slug, value.nameAr, value.nameEn, JSON.stringify(value.aliases), value.startYear, value.endYear, timestamp, timestamp);
}


async function vehicleReferenceExists(env: AdminTaxonomyReviewEnv, entityType: string, id: string) {
  const table = entityType === "make" ? "vehicle_makes" : entityType === "model" ? "vehicle_models" : entityType === "generation" ? "vehicle_generations" : entityType === "trim" ? "vehicle_trims" : null;
  if (!table) return false;
  const row = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND is_active = 1`).bind(id).first<{ id: string }>();
  return Boolean(row);
}

async function mapVehicleQueue(env: AdminTaxonomyReviewEnv, row: Row) {
  const match = row.suggested_match_id
    ? await vehicleReferenceName(env, stringValue(row.entity_type), stringValue(row.suggested_match_id))
    : null;
  return {
    id: stringValue(row.id),
    entityType: stringValue(row.entity_type),
    parentMakeId: nullableString(row.parent_make_id),
    parentMakeNameAr: nullableString(row.parent_make_name_ar),
    parentMakeNameEn: nullableString(row.parent_make_name_en),
    parentModelId: nullableString(row.parent_model_id),
    parentModelNameAr: nullableString(row.parent_model_name_ar),
    parentModelNameEn: nullableString(row.parent_model_name_en),
    rawValue: stringValue(row.raw_value),
    normalizedValue: stringValue(row.normalized_value),
    suggestedMatchId: nullableString(row.suggested_match_id),
    suggestedMatchNameAr: match?.nameAr ?? null,
    suggestedMatchNameEn: match?.nameEn ?? null,
    listingId: nullableString(row.listing_id),
    listingTitle: nullableString(row.listing_title),
    listingStatus: nullableString(row.listing_status),
    listingUpdatedAt: nullableString(row.listing_updated_at),
    requestedBy: nullableString(row.requested_by),
    status: stringValue(row.status),
    occurrenceCount: numberValue(row.occurrence_count),
    reviewNote: nullableString(row.review_note),
    reviewedBy: nullableString(row.reviewed_by),
    reviewedAt: nullableString(row.reviewed_at),
    reviewedListingUpdatedAt: nullableString(row.reviewed_listing_updated_at),
    appliedBy: nullableString(row.applied_by),
    appliedAt: nullableString(row.applied_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

async function vehicleReferenceName(env: AdminTaxonomyReviewEnv, entityType: string, id: string) {
  const table = entityType === "make" ? "vehicle_makes" : entityType === "model" ? "vehicle_models" : entityType === "generation" ? "vehicle_generations" : entityType === "trim" ? "vehicle_trims" : null;
  if (!table) return null;
  const row = await env.DB.prepare(`SELECT name_ar, name_en FROM ${table} WHERE id = ?`).bind(id).first<Row>();
  return row ? { nameAr: nullableString(row.name_ar), nameEn: nullableString(row.name_en) } : null;
}

function mapTaxonomyQueue(row: Row) {
  return {
    listingId: stringValue(row.listing_id),
    listingTitle: stringValue(row.listing_title),
    listingStatus: stringValue(row.listing_status),
    listingCategoryId: stringValue(row.listing_category_id),
    listingSubcategoryId: nullableString(row.listing_subcategory_id),
    listingUpdatedAt: stringValue(row.listing_updated_at),
    currentTaxonomyNodeId: nullableString(row.current_taxonomy_node_id),
    suggestedVersionId: nullableString(row.suggested_version_id),
    suggestedVersionNumber: nullableNumber(row.suggested_version_number),
    suggestedVersionStatus: nullableString(row.suggested_version_status),
    suggestedTaxonomyNodeId: nullableString(row.suggested_taxonomy_node_id),
    suggestedNameAr: nullableString(row.suggested_name_ar),
    suggestedNameEn: nullableString(row.suggested_name_en),
    confidence: nullableNumber(row.confidence),
    status: stringValue(row.status),
    mappingSource: stringValue(row.mapping_source),
    evidence: objectValue(row.evidence),
    attemptCount: numberValue(row.attempt_count),
    reviewedBy: nullableString(row.reviewed_by),
    reviewedAt: nullableString(row.reviewed_at),
    reviewNote: nullableString(row.review_note),
    reviewedListingUpdatedAt: nullableString(row.reviewed_listing_updated_at),
    appliedBy: nullableString(row.applied_by),
    appliedAt: nullableString(row.applied_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

async function audit(env: AdminTaxonomyReviewEnv, actorId: string, action: string, entityType: string, entityId: string, metadata: Row) {
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), actorId, action, entityType, entityId, JSON.stringify(metadata), now()).run();
}
function isAdminLike(roles: string[]) { return roles.some((role) => role === "owner" || role === "admin" || role === "moderator"); }
function changed(result: Result) { return (result.meta?.changes ?? 0) > 0; }
function integerParam(url: URL, key: string, fallback: number, min: number, max: number) { const number = Number(url.searchParams.get(key)); return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback; }
function nullableQuery(url: URL, key: string, max: number) { return nullableClean(url.searchParams.get(key), max); }
function clean(value: unknown, max: number): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function nullableClean(value: unknown, max: number): string | null { const result = clean(value, max); return result || null; }
function stringArray(value: unknown, max: number) { return Array.isArray(value) ? [...new Set(value.map((item) => clean(item, 120)).filter(Boolean))].slice(0, max) : []; }
function nullableYear(value: unknown): number | null { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isInteger(number) && number >= 1886 && number <= 2200 ? number : null; }
function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140) || crypto.randomUUID(); }
function objectValue(value: unknown): Row { if (value && typeof value === "object" && !Array.isArray(value)) return value as Row; if (typeof value === "string") { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Row : {}; } catch { return {}; } } return {}; }
function stringValue(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function nullableString(value: unknown) { return typeof value === "string" && value ? value : null; }
function nullableNumber(value: unknown) { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function numberValue(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function truthy(value: unknown) { return value === true || value === 1 || value === "1"; }
function now() { return new Date().toISOString(); }
function unauthorized(cors: Headers) { return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors); }
function forbidden(cors: Headers) { return json({ error: { code: "permission_denied", message: "Administrative review permission required." } }, 403, cors); }
function ownerOnly(cors: Headers) { return json({ error: { code: "permission_denied", message: "Owner permission required." } }, 403, cors); }
function validation(cors: Headers, message: string) { return json({ error: { code: "validation_error", message } }, 400, cors); }
function stale(cors: Headers) { return json({ error: { code: "status_mismatch", message: "تغيّرت بيانات المراجعة. حدّث القائمة قبل إعادة المحاولة." } }, 409, cors); }
function conflict(cors: Headers, message: string) { return json({ error: { code: "status_mismatch", message } }, 409, cors); }
function notFound(cors: Headers, message: string) { return json({ error: { code: "not_found", message } }, 404, cors); }
function databaseError(cors: Headers) { return json({ error: { code: "database_error", message: "Database operation failed." } }, 500, cors); }
