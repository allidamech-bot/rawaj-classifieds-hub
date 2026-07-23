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
export interface AccountSocialEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

const SAVED_SEARCH_LIMIT = 50;
const MESSAGE_LIMIT = 2000;
const FILTER_KEYS = new Set([
  "taxonomyNodeId",
  "taxonomyNodeIds",
  "taxonomyLegacyScopes",
  "categoryId",
  "subcategoryId",
  "governorateId",
  "districtAr",
  "priceMin",
  "priceMax",
  "carMake",
  "carModel",
  "yearFrom",
  "yearTo",
  "fuelType",
  "transmission",
  "propertyPurpose",
  "propertyType",
  "taxonomyPropertyPurpose",
  "taxonomyPropertyType",
  "taxonomyLegacySubcategoryId",
  "rooms",
  "rentalDuration",
  "electronicsBrand",
  "detailCondition",
  "condition",
  "priceType",
  "employmentType",
  "salaryType",
  "withPhotos",
  "query",
  "sort",
]);

export async function handleAccountSocial(
  request: Request,
  env: AccountSocialEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!relevant(path)) return null;
  const cors = corsHeaders(request, env as unknown as AuthEnv);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/account/favorites" && request.method === "GET")
    return listFavorites(request, env, cors, url);
  const favorite = path.match(/^\/v1\/listings\/([^/]+)\/favorite$/);
  if (favorite) {
    const listingId = decodeURIComponent(favorite[1]);
    if (request.method === "GET") return favoriteState(request, env, cors, listingId);
    if (request.method === "POST") return setFavorite(request, env, cors, listingId, true);
    if (request.method === "DELETE") return setFavorite(request, env, cors, listingId, false);
  }

  if (path === "/v1/account/saved-searches") {
    if (request.method === "GET") return listSavedSearches(request, env, cors);
    if (request.method === "POST") return createSavedSearch(request, env, cors);
  }
  const saved = path.match(/^\/v1\/account\/saved-searches\/([^/]+)$/);
  if (saved) {
    const id = decodeURIComponent(saved[1]);
    if (request.method === "PATCH") return updateSavedSearch(request, env, cors, id);
    if (request.method === "DELETE") return deleteSavedSearch(request, env, cors, id);
  }

  if (path === "/v1/account/conversations" && request.method === "GET")
    return listConversations(request, env, cors, url);
  if (path === "/v1/account/messages/unread-count" && request.method === "GET")
    return unreadCount(request, env, cors);
  if (path === "/v1/conversations" && request.method === "POST")
    return createConversation(request, env, cors);
  const conversation = path.match(/^\/v1\/conversations\/([^/]+)$/);
  if (conversation && request.method === "GET")
    return getConversation(request, env, cors, decodeURIComponent(conversation[1]));
  const messages = path.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
  if (messages) {
    const id = decodeURIComponent(messages[1]);
    if (request.method === "GET") return listMessages(request, env, cors, url, id);
    if (request.method === "POST") return sendMessage(request, env, cors, id);
  }
  const read = path.match(/^\/v1\/conversations\/([^/]+)\/read$/);
  if (read && (request.method === "POST" || request.method === "PATCH"))
    return markRead(request, env, cors, decodeURIComponent(read[1]));

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function relevant(path: string) {
  return /^\/v1\/(?:account\/(?:favorites|saved-searches|conversations|messages)|listings\/[^/]+\/favorite|conversations)\b/.test(
    path,
  );
}

async function favoriteState(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const listing = await visibleListing(env, listingId, auth.userId);
  if (!listing) return notFound(cors);
  const row = await env.DB.prepare(
    "SELECT 1 AS favorited FROM favorites WHERE user_id = ? AND listing_id = ?",
  )
    .bind(auth.userId, listingId)
    .first();
  return json({ data: { favorited: Boolean(row) } }, 200, cors);
}

async function setFavorite(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  listingId: string,
  enabled: boolean,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const listing = await visibleListing(env, listingId, auth.userId);
  if (!listing || listing.status !== "approved") return notFound(cors);
  const result = enabled
    ? await env.DB.prepare(
        "INSERT OR IGNORE INTO favorites (user_id, listing_id, created_at) VALUES (?, ?, ?)",
      )
        .bind(auth.userId, listingId, now())
        .run()
    : await env.DB.prepare("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?")
        .bind(auth.userId, listingId)
        .run();
  return result.success ? json({ data: { favorited: enabled } }, 200, cors) : databaseError(cors);
}

async function listFavorites(request: Request, env: AccountSocialEnv, cors: Headers, url: URL) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const pageSize = integer(url.searchParams.get("pageSize"), 50, 1, 100);
  const result = await env.DB.prepare(
    `SELECT f.user_id, f.listing_id, f.created_at,
      l.owner_id, l.category_id, l.subcategory_id, l.governorate_id, l.title,
      l.description, l.price, l.currency, l.price_type, l.listing_condition,
      l.status, l.district_ar, l.contact_name, l.contact_options, l.details,
      l.is_featured, l.created_at AS listing_created_at, l.updated_at AS listing_updated_at
      FROM favorites f JOIN listings l ON l.id = f.listing_id
      WHERE f.user_id = ? AND l.status = 'approved' AND l.archived_at IS NULL
      ORDER BY f.created_at DESC, f.listing_id DESC LIMIT ?`,
  )
    .bind(auth.userId, pageSize)
    .all();
  return result.success ? json({ data: result.results ?? [] }, 200, cors) : databaseError(cors);
}

async function listSavedSearches(request: Request, env: AccountSocialEnv, cors: Headers) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const result = await env.DB.prepare(
    `SELECT id, user_id, name_ar, filters, alert_frequency, last_alert_checked_at,
      created_at, updated_at FROM saved_searches WHERE user_id = ?
      ORDER BY created_at DESC, id DESC LIMIT 100`,
  )
    .bind(auth.userId)
    .all();
  return result.success
    ? json({ data: (result.results ?? []).map(savedSearchRow) }, 200, cors)
    : databaseError(cors);
}

async function createSavedSearch(request: Request, env: AccountSocialEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const parsed = await savedSearchInput(request, cors);
  if (parsed instanceof Response) return parsed;
  const count = await env.DB.prepare(
    "SELECT count(*) AS count FROM saved_searches WHERE user_id = ?",
  )
    .bind(auth.userId)
    .first<{ count: number }>();
  if ((count?.count ?? 0) >= SAVED_SEARCH_LIMIT)
    return json(
      { error: { code: "limit_exceeded", message: "Saved-search limit reached." } },
      409,
      cors,
    );
  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO saved_searches (id, user_id, name, query, alerts_enabled, name_ar,
      filters, alert_frequency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.userId,
      parsed.name,
      parsed.filters,
      parsed.frequency === "off" ? 0 : 1,
      parsed.name,
      parsed.filters,
      parsed.frequency,
      timestamp,
      timestamp,
    )
    .run();
  return result.success
    ? json(
        {
          data: {
            id,
            userId: auth.userId,
            nameAr: parsed.name,
            filters: JSON.parse(parsed.filters),
            alertFrequency: parsed.frequency,
            lastAlertCheckedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
        201,
        cors,
      )
    : databaseError(cors);
}

async function updateSavedSearch(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  id: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const existing = await env.DB.prepare(
    `SELECT name_ar, filters, alert_frequency, last_alert_checked_at, created_at
      FROM saved_searches WHERE id = ? AND user_id = ?`,
  )
    .bind(id, auth.userId)
    .first<Row>();
  if (!existing) return notFound(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const name =
    body.data.nameAr === undefined ? String(existing.name_ar) : clean(body.data.nameAr, 80);
  const frequency =
    body.data.alertFrequency === undefined
      ? String(existing.alert_frequency)
      : allowedFrequency(body.data.alertFrequency);
  const filters =
    body.data.filters === undefined
      ? String(existing.filters)
      : normalizeFilters(body.data.filters);
  if (!name || !frequency || !filters) return validation(cors, "Invalid saved search.");
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE saved_searches SET name = ?, query = ?, alerts_enabled = ?, name_ar = ?,
      filters = ?, alert_frequency = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
  )
    .bind(
      name,
      filters,
      frequency === "off" ? 0 : 1,
      name,
      filters,
      frequency,
      timestamp,
      id,
      auth.userId,
    )
    .run();
  return result.success
    ? json(
        {
          data: {
            id,
            userId: auth.userId,
            nameAr: name,
            filters: JSON.parse(filters),
            alertFrequency: frequency,
            lastAlertCheckedAt: existing.last_alert_checked_at ?? null,
            createdAt: existing.created_at,
            updatedAt: timestamp,
          },
        },
        200,
        cors,
      )
    : databaseError(cors);
}

async function deleteSavedSearch(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  id: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const existing = await env.DB.prepare(
    "SELECT id FROM saved_searches WHERE id = ? AND user_id = ?",
  )
    .bind(id, auth.userId)
    .first();
  if (!existing) return notFound(cors);
  const result = await env.DB.prepare("DELETE FROM saved_searches WHERE id = ? AND user_id = ?")
    .bind(id, auth.userId)
    .run();
  return result.success ? json({ data: { success: true } }, 200, cors) : databaseError(cors);
}

async function createConversation(request: Request, env: AccountSocialEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const listingId = clean(body.data.listingId, 160);
  if (!listingId) return validation(cors, "Listing required.");
  const listing = await env.DB.prepare(
    "SELECT owner_id, status, archived_at FROM listings WHERE id = ?",
  )
    .bind(listingId)
    .first<{ owner_id: string; status: string; archived_at: string | null }>();
  if (!listing || listing.status !== "approved" || listing.archived_at) return notFound(cors);
  if (listing.owner_id === auth.userId)
    return json(
      { error: { code: "self_conversation", message: "Cannot message yourself." } },
      409,
      cors,
    );
  const existing = await env.DB.prepare(
    "SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?",
  )
    .bind(listingId, auth.userId, listing.owner_id)
    .first<{ id: string }>();
  if (existing) return json({ data: { id: existing.id, created: false } }, 200, cors);
  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO conversations
      (id, listing_id, buyer_id, seller_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)`,
  )
    .bind(id, listingId, auth.userId, listing.owner_id, timestamp, timestamp)
    .run();
  if (!result.success) return databaseError(cors);
  const resolved = await env.DB.prepare(
    "SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?",
  )
    .bind(listingId, auth.userId, listing.owner_id)
    .first<{ id: string }>();
  return json({ data: { id: resolved?.id ?? id, created: resolved?.id === id } }, 201, cors);
}

async function listConversations(request: Request, env: AccountSocialEnv, cors: Headers, url: URL) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const page = integer(url.searchParams.get("page"), 1, 1, 100000);
  const pageSize = integer(url.searchParams.get("pageSize"), 30, 1, 50);
  const result = await env.DB.prepare(
    `${conversationSelect()}
      WHERE (c.buyer_id = ? OR c.seller_id = ?)
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
      LIMIT ? OFFSET ?`,
  )
    .bind(auth.userId, auth.userId, auth.userId, auth.userId, pageSize, (page - 1) * pageSize)
    .all();
  return result.success
    ? json({ data: { items: result.results ?? [], page, pageSize } }, 200, cors)
    : databaseError(cors);
}

async function getConversation(request: Request, env: AccountSocialEnv, cors: Headers, id: string) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    `${conversationSelect()} WHERE c.id = ? AND (c.buyer_id = ? OR c.seller_id = ?)`,
  )
    .bind(auth.userId, auth.userId, id, auth.userId, auth.userId)
    .first();
  return row ? json({ data: row }, 200, cors) : notFound(cors);
}

function conversationSelect() {
  return `SELECT c.id, c.listing_id, l.title AS listing_title, c.status,
    CASE WHEN c.buyer_id = ? THEN seller.display_name ELSE buyer.display_name END AS other_display_name,
    NULL AS other_avatar_url, c.last_message_at,
    (SELECT body FROM conversation_messages lm WHERE lm.conversation_id = c.id
      AND lm.deleted_at IS NULL ORDER BY lm.created_at DESC, lm.id DESC LIMIT 1) AS last_message_preview,
    (SELECT count(*) FROM conversation_messages um WHERE um.conversation_id = c.id
      AND um.sender_id <> ? AND um.read_at IS NULL AND um.deleted_at IS NULL) AS unread_count,
    NULL AS other_last_read_at, c.created_at, c.updated_at
    FROM conversations c
    LEFT JOIN listings l ON l.id = c.listing_id
    JOIN public_profiles buyer ON buyer.id = c.buyer_id
    JOIN public_profiles seller ON seller.id = c.seller_id`;
}

async function listMessages(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  url: URL,
  id: string,
) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  if (!(await participant(env, id, auth.userId))) return notFound(cors);
  const page = integer(url.searchParams.get("page"), 1, 1, 100000);
  const pageSize = integer(url.searchParams.get("pageSize"), 50, 1, 100);
  const result = await env.DB.prepare(
    `SELECT id, conversation_id, sender_id, sender_id = ? AS is_mine,
      body, media_asset_id, created_at,
      read_at, deleted_at FROM conversation_messages WHERE conversation_id = ?
      AND deleted_at IS NULL ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
  )
    .bind(auth.userId, id, pageSize, (page - 1) * pageSize)
    .all();
  return result.success
    ? json({ data: { items: result.results ?? [], page, pageSize } }, 200, cors)
    : databaseError(cors);
}

async function sendMessage(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  conversationId: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  if (!(await participant(env, conversationId, auth.userId))) return notFound(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const message = normalizeMessage(body.data.body);
  const requestId = clean(body.data.requestId, 80);
  if (!message || message.length > MESSAGE_LIMIT) return validation(cors, "Invalid message.");
  if (body.data.attachment) return validation(cors, "Attachments are not migrated.");
  if (requestId) {
    const existing = await env.DB.prepare(
      `SELECT id, conversation_id, sender_id, body, created_at, read_at, deleted_at
       FROM conversation_messages WHERE sender_id = ? AND client_request_id = ?`,
    )
      .bind(auth.userId, requestId)
      .first();
    if (existing) return json({ data: existing }, 200, cors);
  }
  const id = crypto.randomUUID();
  const timestamp = now();
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO conversation_messages
       (id, conversation_id, sender_id, body, message_type, client_request_id, created_at)
       VALUES (?, ?, ?, ?, 'text', ?, ?)`,
    ).bind(id, conversationId, auth.userId, message, requestId, timestamp),
    env.DB.prepare(
      "UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?",
    ).bind(timestamp, timestamp, conversationId),
  ]);
  return results.every((result) => result.success)
    ? json(
        {
          data: {
            id,
            conversation_id: conversationId,
            sender_id: auth.userId,
            body: message,
            created_at: timestamp,
            read_at: null,
            deleted_at: null,
          },
        },
        201,
        cors,
      )
    : databaseError(cors);
}

async function markRead(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  conversationId: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  if (!(await participant(env, conversationId, auth.userId))) return notFound(cors);
  const result = await env.DB.prepare(
    `UPDATE conversation_messages SET read_at = ?
      WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL`,
  )
    .bind(now(), conversationId, auth.userId)
    .run();
  return result.success ? json({ data: { success: true } }, 200, cors) : databaseError(cors);
}

async function unreadCount(request: Request, env: AccountSocialEnv, cors: Headers) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    `SELECT count(*) AS count FROM conversation_messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE (c.buyer_id = ? OR c.seller_id = ?) AND m.sender_id <> ?
      AND m.read_at IS NULL AND m.deleted_at IS NULL`,
  )
    .bind(auth.userId, auth.userId, auth.userId)
    .first<{ count: number }>();
  return json({ data: { count: row?.count ?? 0 } }, 200, cors);
}

async function visibleListing(env: AccountSocialEnv, id: string, userId: string) {
  return env.DB.prepare(
    `SELECT id, owner_id, status FROM listings WHERE id = ? AND archived_at IS NULL
      AND (status = 'approved' OR owner_id = ?)`,
  )
    .bind(id, userId)
    .first<{ id: string; owner_id: string; status: string }>();
}

async function participant(env: AccountSocialEnv, id: string, userId: string) {
  return env.DB.prepare(
    "SELECT id FROM conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)",
  )
    .bind(id, userId, userId)
    .first();
}

async function savedSearchInput(request: Request, cors: Headers) {
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const name = clean(body.data.nameAr, 80);
  const filters = normalizeFilters(body.data.filters);
  const frequency = allowedFrequency(body.data.alertFrequency ?? "weekly");
  return name && filters && frequency
    ? { name, filters, frequency }
    : validation(cors, "Invalid saved search.");
}

function normalizeFilters(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Row);
  if (entries.some(([key]) => !FILTER_KEYS.has(key))) return null;
  const normalized: Row = {};
  for (const [key, item] of entries) {
    if (typeof item === "string") {
      const text = item.trim();
      if (!text || text.length > 160) return null;
      if (key === "sort" && !["latest", "cheapest", "expensive", "featured"].includes(text))
        return null;
      normalized[key] = text;
    } else if (typeof item === "number") {
      if (!Number.isFinite(item) || item < 0 || item > 1e15) return null;
      normalized[key] = item;
    } else if (typeof item === "boolean") {
      normalized[key] = item;
    } else if (Array.isArray(item)) {
      if (item.length > 50) return null;
      if (key === "taxonomyLegacyScopes") {
        const scopes = item.map(normalizeLegacyScope);
        if (scopes.some((scope) => !scope)) return null;
        normalized[key] = scopes;
      } else {
        if (item.some((nested) => typeof nested !== "string")) return null;
        normalized[key] = [...new Set(item.map((nested) => nested.trim()).filter(Boolean))];
      }
    } else {
      return null;
    }
  }
  const result = JSON.stringify(normalized);
  return result.length <= 8000 ? result : null;
}

function normalizeLegacyScope(value: unknown): Row | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Row;
  if (
    Object.keys(source).some(
      (key) => !["categoryId", "subcategoryId", "propertyPurpose", "propertyType"].includes(key),
    )
  )
    return null;
  const categoryId = clean(source.categoryId, 120);
  if (!categoryId) return null;
  return {
    categoryId,
    ...(clean(source.subcategoryId, 120)
      ? { subcategoryId: clean(source.subcategoryId, 120) }
      : {}),
    ...(clean(source.propertyPurpose, 80)
      ? { propertyPurpose: clean(source.propertyPurpose, 80) }
      : {}),
    ...(clean(source.propertyType, 80) ? { propertyType: clean(source.propertyType, 80) } : {}),
  };
}

function savedSearchRow(row: Row) {
  return {
    id: row.id,
    userId: row.user_id,
    nameAr: row.name_ar,
    filters: JSON.parse(String(row.filters ?? "{}")),
    alertFrequency: row.alert_frequency,
    lastAlertCheckedAt: row.last_alert_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function allowedFrequency(value: unknown) {
  return typeof value === "string" && ["daily", "weekly", "off"].includes(value) ? value : null;
}
function normalizeMessage(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}
function clean(value: unknown, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim()
    : null;
}
function integer(value: string | null, fallback: number, min: number, max: number) {
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
function notFound(cors: Headers) {
  return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
}
function databaseError(cors: Headers) {
  return json({ error: { code: "database_unavailable", message: "Data unavailable." } }, 503, cors);
}
