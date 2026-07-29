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
export interface AdminCampaignsEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

const CAMPAIGN_STATUSES = new Set(["draft", "active", "paused", "ended"]);
const TARGET_PAGES = new Set(["home", "search_results", "listing_detail", "categories", "offers"]);

function asAuthEnv(env: AdminCampaignsEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleAdminCampaigns(
  request: Request,
  env: AdminCampaignsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!path.startsWith("/v1/admin/campaigns")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/admin/campaigns") {
    if (request.method === "GET") return listCampaigns(request, env, cors);
    if (request.method === "POST") return saveCampaign(request, env, cors, null);
  }

  const creativesMatch = path.match(/^\/v1\/admin\/campaigns\/([^/]+)\/creatives$/);
  if (creativesMatch) {
    const campaignId = decodeURIComponent(creativesMatch[1]);
    if (request.method === "GET") return listCreatives(request, env, cors, campaignId);
    if (request.method === "POST") return saveCreative(request, env, cors, campaignId, null);
  }

  const creativeMatch = path.match(/^\/v1\/admin\/campaigns\/([^/]+)\/creatives\/([^/]+)$/);
  if (creativeMatch && request.method === "PATCH") {
    return saveCreative(
      request,
      env,
      cors,
      decodeURIComponent(creativeMatch[1]),
      decodeURIComponent(creativeMatch[2]),
    );
  }

  const statusMatch = path.match(/^\/v1\/admin\/campaigns\/([^/]+)\/status$/);
  if (statusMatch && request.method === "PATCH") {
    return setCampaignStatus(request, env, cors, decodeURIComponent(statusMatch[1]));
  }

  const campaignMatch = path.match(/^\/v1\/admin\/campaigns\/([^/]+)$/);
  if (campaignMatch && request.method === "PATCH") {
    return saveCampaign(request, env, cors, decodeURIComponent(campaignMatch[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function listCampaigns(request: Request, env: AdminCampaignsEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!hasOwnerRole(auth.roles)) return forbidden(cors);

  const result = await env.DB.prepare(
    `SELECT c.id, c.name, c.status, c.starts_at, c.ends_at, c.target_pages,
            c.target_category_ids, c.version, c.created_at, c.updated_at,
            (SELECT count(*) FROM ad_campaign_creatives cr WHERE cr.campaign_id = c.id) AS creative_count,
            (SELECT count(*) FROM ad_campaign_events e WHERE e.campaign_id = c.id AND e.event_type = 'impression') AS impressions,
            (SELECT count(*) FROM ad_campaign_events e WHERE e.campaign_id = c.id AND e.event_type = 'click') AS clicks
       FROM ad_campaigns c
      ORDER BY c.updated_at DESC, c.id DESC`,
  ).all<Row>();
  if (!result.success) return databaseError(cors);
  return json({ data: (result.results ?? []).map(mapCampaign) }, 200, cors);
}

async function listCreatives(
  request: Request,
  env: AdminCampaignsEnv,
  cors: Headers,
  campaignId: string,
) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!hasOwnerRole(auth.roles)) return forbidden(cors);

  const result = await env.DB.prepare(
    `SELECT cr.id, cr.campaign_id, cr.name, cr.image_url, cr.destination_url,
            cr.weight, cr.is_active, cr.version, cr.created_at, cr.updated_at,
            (SELECT count(*) FROM ad_campaign_events e WHERE e.creative_id = cr.id AND e.event_type = 'impression') AS impressions,
            (SELECT count(*) FROM ad_campaign_events e WHERE e.creative_id = cr.id AND e.event_type = 'click') AS clicks
       FROM ad_campaign_creatives cr
      WHERE cr.campaign_id = ?
      ORDER BY cr.updated_at DESC, cr.id DESC`,
  )
    .bind(campaignId)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  return json({ data: (result.results ?? []).map(mapCreative) }, 200, cors);
}

async function saveCampaign(
  request: Request,
  env: AdminCampaignsEnv,
  cors: Headers,
  campaignId: string | null,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!hasOwnerRole(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const parsed = parseCampaign(body.data, campaignId !== null);
  if (!parsed.ok) return validation(cors, parsed.message);
  const timestamp = now();
  const id = campaignId ?? crypto.randomUUID();

  if (!campaignId) {
    const created = await env.DB.prepare(
      `INSERT INTO ad_campaigns (
         id, name, status, starts_at, ends_at, target_pages, target_category_ids,
         version, created_by, updated_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        parsed.value.name,
        parsed.value.status,
        parsed.value.startsAt,
        parsed.value.endsAt,
        JSON.stringify(parsed.value.targetPages),
        JSON.stringify(parsed.value.targetCategoryIds),
        auth.userId,
        auth.userId,
        timestamp,
        timestamp,
      )
      .run();
    if (!created.success) return databaseError(cors);
    await audit(env, auth.userId, "campaign.created", "ad_campaigns", id, {
      status: parsed.value.status,
    });
    return json({ data: { id, version: 1, updatedAt: timestamp } }, 201, cors);
  }

  const updated = await env.DB.prepare(
    `UPDATE ad_campaigns
        SET name = ?, status = ?, starts_at = ?, ends_at = ?, target_pages = ?,
            target_category_ids = ?, version = version + 1, updated_by = ?, updated_at = ?
      WHERE id = ? AND version = ?`,
  )
    .bind(
      parsed.value.name,
      parsed.value.status,
      parsed.value.startsAt,
      parsed.value.endsAt,
      JSON.stringify(parsed.value.targetPages),
      JSON.stringify(parsed.value.targetCategoryIds),
      auth.userId,
      timestamp,
      id,
      parsed.value.expectedVersion,
    )
    .run();
  if (!updated.success) return databaseError(cors);
  if (!changed(updated)) return conflict(cors, "تغيّرت الحملة منذ تحميلها. أعد التحميل قبل الحفظ.");
  const version = parsed.value.expectedVersion + 1;
  await audit(env, auth.userId, "campaign.updated", "ad_campaigns", id, {
    status: parsed.value.status,
    version,
  });
  return json({ data: { id, version, updatedAt: timestamp } }, 200, cors);
}

async function setCampaignStatus(
  request: Request,
  env: AdminCampaignsEnv,
  cors: Headers,
  campaignId: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!hasOwnerRole(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const status = clean(body.data.status, 20);
  const reason = clean(body.data.reason, 1000);
  const expectedVersion = positiveInteger(body.data.expectedVersion);
  if (!CAMPAIGN_STATUSES.has(status) || reason.length < 3 || expectedVersion === null) {
    return validation(cors, "بيانات تغيير حالة الحملة غير مكتملة.");
  }
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE ad_campaigns
        SET status = ?, version = version + 1, updated_by = ?, updated_at = ?
      WHERE id = ? AND version = ?`,
  )
    .bind(status, auth.userId, timestamp, campaignId, expectedVersion)
    .run();
  if (!result.success) return databaseError(cors);
  if (!changed(result))
    return conflict(cors, "تغيّرت الحملة منذ تحميلها. أعد التحميل قبل تغيير الحالة.");
  const version = expectedVersion + 1;
  await audit(env, auth.userId, "campaign.status_changed", "ad_campaigns", campaignId, {
    status,
    reason,
    version,
  });
  return json({ data: { id: campaignId, version, updatedAt: timestamp } }, 200, cors);
}

async function saveCreative(
  request: Request,
  env: AdminCampaignsEnv,
  cors: Headers,
  campaignId: string,
  creativeId: string | null,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!hasOwnerRole(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const parsed = parseCreative(body.data, creativeId !== null);
  if (!parsed.ok) return validation(cors, parsed.message);
  const campaign = await env.DB.prepare("SELECT id FROM ad_campaigns WHERE id = ?")
    .bind(campaignId)
    .first<{ id: string }>();
  if (!campaign) return notFound(cors, "الحملة غير موجودة.");

  const timestamp = now();
  const id = creativeId ?? crypto.randomUUID();
  if (!creativeId) {
    const created = await env.DB.prepare(
      `INSERT INTO ad_campaign_creatives (
         id, campaign_id, name, image_url, destination_url, weight, is_active,
         version, created_by, updated_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        campaignId,
        parsed.value.name,
        parsed.value.imageUrl,
        parsed.value.destinationUrl,
        parsed.value.weight,
        parsed.value.isActive ? 1 : 0,
        auth.userId,
        auth.userId,
        timestamp,
        timestamp,
      )
      .run();
    if (!created.success) return databaseError(cors);
    await audit(env, auth.userId, "campaign.creative_created", "ad_campaign_creatives", id, {
      campaignId,
    });
    return json({ data: { id, version: 1, updatedAt: timestamp } }, 201, cors);
  }

  const updated = await env.DB.prepare(
    `UPDATE ad_campaign_creatives
        SET name = ?, image_url = ?, destination_url = ?, weight = ?, is_active = ?,
            version = version + 1, updated_by = ?, updated_at = ?
      WHERE id = ? AND campaign_id = ? AND version = ?`,
  )
    .bind(
      parsed.value.name,
      parsed.value.imageUrl,
      parsed.value.destinationUrl,
      parsed.value.weight,
      parsed.value.isActive ? 1 : 0,
      auth.userId,
      timestamp,
      id,
      campaignId,
      parsed.value.expectedVersion,
    )
    .run();
  if (!updated.success) return databaseError(cors);
  if (!changed(updated)) return conflict(cors, "تغيّر التصميم منذ تحميله. أعد التحميل قبل الحفظ.");
  const version = parsed.value.expectedVersion + 1;
  await audit(env, auth.userId, "campaign.creative_updated", "ad_campaign_creatives", id, {
    campaignId,
    version,
  });
  return json({ data: { id, version, updatedAt: timestamp } }, 200, cors);
}

function parseCampaign(
  body: Row,
  update: boolean,
):
  | {
      ok: true;
      value: {
        name: string;
        status: string;
        startsAt: string | null;
        endsAt: string | null;
        targetPages: string[];
        targetCategoryIds: string[];
        expectedVersion: number;
      };
    }
  | { ok: false; message: string } {
  const name = clean(body.name, 160);
  const status = clean(body.status, 20) || "draft";
  const startsAt = nullableDate(body.startsAt);
  const endsAt = nullableDate(body.endsAt);
  const targetPages = stringArray(body.targetPages, 5).filter((value) => TARGET_PAGES.has(value));
  const targetCategoryIds = stringArray(body.targetCategoryIds, 100);
  const expectedVersion = update ? positiveInteger(body.expectedVersion) : 1;
  if (name.length < 2 || !CAMPAIGN_STATUSES.has(status) || expectedVersion === null) {
    return { ok: false, message: "بيانات الحملة غير مكتملة." };
  }
  if (startsAt && endsAt && endsAt <= startsAt) {
    return { ok: false, message: "وقت نهاية الحملة يجب أن يكون بعد وقت بدايتها." };
  }
  return {
    ok: true,
    value: { name, status, startsAt, endsAt, targetPages, targetCategoryIds, expectedVersion },
  };
}

function parseCreative(
  body: Row,
  update: boolean,
):
  | {
      ok: true;
      value: {
        name: string;
        imageUrl: string;
        destinationUrl: string;
        weight: number;
        isActive: boolean;
        expectedVersion: number;
      };
    }
  | { ok: false; message: string } {
  const name = clean(body.name, 160);
  const imageUrl = safeHttpsUrl(body.imageUrl);
  const destinationUrl = safeHttpsUrl(body.destinationUrl);
  const weight = integer(body.weight, 1, 1000, 100);
  const isActive = body.isActive !== false;
  const expectedVersion = update ? positiveInteger(body.expectedVersion) : 1;
  if (name.length < 2 || !imageUrl || !destinationUrl || expectedVersion === null) {
    return { ok: false, message: "بيانات التصميم الإعلاني غير مكتملة." };
  }
  return { ok: true, value: { name, imageUrl, destinationUrl, weight, isActive, expectedVersion } };
}

function mapCampaign(row: Row) {
  const impressions = numberValue(row.impressions);
  const clicks = numberValue(row.clicks);
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    status: stringValue(row.status, "draft"),
    startsAt: nullableString(row.starts_at),
    endsAt: nullableString(row.ends_at),
    targetPages: parseStringArray(row.target_pages),
    targetCategoryIds: parseStringArray(row.target_category_ids),
    version: numberValue(row.version),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    creativeCount: numberValue(row.creative_count),
    impressions,
    clicks,
    ctr: impressions > 0 ? Math.round((clicks * 10_000) / impressions) / 100 : 0,
  };
}

function mapCreative(row: Row) {
  const impressions = numberValue(row.impressions);
  const clicks = numberValue(row.clicks);
  return {
    id: stringValue(row.id),
    campaignId: stringValue(row.campaign_id),
    name: stringValue(row.name),
    imageUrl: stringValue(row.image_url),
    destinationUrl: stringValue(row.destination_url),
    weight: numberValue(row.weight),
    isActive: truthy(row.is_active),
    version: numberValue(row.version),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    impressions,
    clicks,
    ctr: impressions > 0 ? Math.round((clicks * 10_000) / impressions) / 100 : 0,
  };
}

async function audit(
  env: AdminCampaignsEnv,
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

function hasOwnerRole(roles: string[]) {
  return roles.includes("owner");
}
function changed(result: Result) {
  return (result.meta?.changes ?? 0) > 0;
}
function safeHttpsUrl(value: unknown): string | null {
  const cleanValue = clean(value, 2048);
  try {
    const url = new URL(cleanValue);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
function stringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, 160)).filter(Boolean))].slice(0, max);
}
function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
function nullableDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = clean(value, 80);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function positiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function integer(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback;
}
function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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
    { error: { code: "permission_denied", message: "Owner permission required." } },
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
