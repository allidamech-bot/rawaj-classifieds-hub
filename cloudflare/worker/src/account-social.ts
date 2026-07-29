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
interface R2Object {
  body: ReadableStream;
  size?: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}
interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<{ httpEtag: string }>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}
export interface AccountSocialEnv {
  DB: Database;
  MEDIA: R2Bucket;
  API_ALLOWED_ORIGINS?: string;
}

const SAVED_SEARCH_LIMIT = 50;
const MESSAGE_LIMIT = 2000;
const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const CHAT_AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const CHAT_AUDIO_MAX_DURATION_MS = 120_000;
const CHAT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CHAT_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]);
const MESSAGE_REPORT_REASONS = new Set([
  "abusive_or_suspicious",
  "harassment",
  "spam",
  "fraud",
  "privacy_violation",
  "other",
]);
const MESSAGE_REPORT_STATUSES = new Set(["new", "under_review", "resolved", "rejected"]);

interface ChatAttachmentRow {
  asset_id: string;
  kind: "image" | "audio";
  duration_ms: number | null;
  content_type: string;
  byte_size: number;
}

interface ConversationParticipantRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
}
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

  const recentView = path.match(/^\/v1\/listings\/([^/]+)\/recent-view$/);
  if (recentView && request.method === "POST") {
    return recordRecentView(request, env, cors, decodeURIComponent(recentView[1]));
  }
  if (path === "/v1/account/recent-views") {
    if (request.method === "GET") return listRecentViews(request, env, cors, url);
    if (request.method === "DELETE") return clearRecentViews(request, env, cors);
  }
  const recentViewItem = path.match(/^\/v1\/account\/recent-views\/([^/]+)$/);
  if (recentViewItem && request.method === "DELETE") {
    return removeRecentView(request, env, cors, decodeURIComponent(recentViewItem[1]));
  }

  const sellerFollow = path.match(/^\/v1\/sellers\/([^/]+)\/follow$/);
  if (sellerFollow) {
    const sellerId = decodeURIComponent(sellerFollow[1]);
    if (request.method === "GET") return sellerFollowSummary(request, env, cors, sellerId);
    if (request.method === "POST" || request.method === "PUT") {
      return setSellerFollow(request, env, cors, sellerId, true);
    }
    if (request.method === "DELETE") return setSellerFollow(request, env, cors, sellerId, false);
  }
  if (path === "/v1/account/followed-sellers" && request.method === "GET") {
    return listFollowedSellers(request, env, cors, url);
  }
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
  const attachments = path.match(/^\/v1\/conversations\/([^/]+)\/attachments$/);
  if (attachments && request.method === "POST") {
    return uploadChatAttachment(request, env, cors, decodeURIComponent(attachments[1]));
  }
  const read = path.match(/^\/v1\/conversations\/([^/]+)\/read$/);
  if (read && (request.method === "POST" || request.method === "PATCH"))
    return markRead(request, env, cors, decodeURIComponent(read[1]));
  const block = path.match(/^\/v1\/conversations\/([^/]+)\/block$/);
  if (block && request.method === "POST")
    return blockParticipant(request, env, cors, decodeURIComponent(block[1]));

  const chatMedia = path.match(/^\/v1\/account\/chat-media\/([^/]+)$/);
  if (chatMedia && request.method === "GET")
    return readChatMedia(request, env, cors, decodeURIComponent(chatMedia[1]));
  if (chatMedia && request.method === "DELETE")
    return removeChatMedia(request, env, cors, decodeURIComponent(chatMedia[1]));

  const report = path.match(/^\/v1\/messages\/([^/]+)\/report$/);
  if (report && request.method === "POST")
    return createMessageReport(request, env, cors, decodeURIComponent(report[1]));

  if (path === "/v1/admin/message-reports" && request.method === "GET") {
    return listMessageReports(request, env, cors);
  }
  const adminReport = path.match(/^\/v1\/admin\/message-reports\/([^/]+)$/);
  if (adminReport && request.method === "PATCH") {
    return moderateMessageReport(request, env, cors, decodeURIComponent(adminReport[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function relevant(path: string) {
  return /^\/v1\/(?:account\/(?:favorites|saved-searches|conversations|messages|chat-media|recent-views|followed-sellers)|listings\/[^/]+\/(?:favorite|recent-view)|sellers\/[^/]+\/follow|conversations|messages\/[^/]+\/report|admin\/message-reports)\b/.test(
    path,
  );
}

async function recordRecentView(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const listing = await visibleListing(env, listingId, auth.userId);
  if (!listing || listing.status !== "approved") return notFound(cors);
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO recent_listing_views (user_id, listing_id, viewed_at, view_count)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(user_id, listing_id) DO UPDATE SET
       viewed_at = excluded.viewed_at,
       view_count = MIN(recent_listing_views.view_count + 1, 2147483647)`,
  )
    .bind(auth.userId, listingId, timestamp)
    .run();
  return result.success
    ? json({ data: { success: true, viewedAt: timestamp } }, 200, cors)
    : databaseError(cors);
}

async function listRecentViews(request: Request, env: AccountSocialEnv, cors: Headers, url: URL) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const limit = integer(url.searchParams.get("limit"), 12, 1, 30);
  const result = await env.DB.prepare(
    `SELECT rv.listing_id, rv.viewed_at, rv.view_count,
      l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,
      l.title, l.description, l.price, l.currency, l.price_type, l.listing_condition,
      l.status, l.district_ar, l.contact_name, l.contact_options, l.details,
      l.is_featured, l.featured_until, l.published_at, l.archived_at,
      l.reserved_at, l.expires_at, l.renewed_at, l.expiry_days,
      l.created_at AS listing_created_at, l.updated_at AS listing_updated_at,
      (SELECT li.media_asset_id FROM listing_images li
        JOIN media_assets ma ON ma.id = li.media_asset_id AND ma.status = 'ready'
        WHERE li.listing_id = l.id ORDER BY li.sort_order, li.id LIMIT 1) AS primary_media_asset_id
      FROM recent_listing_views rv
      JOIN listings l ON l.id = rv.listing_id
      WHERE rv.user_id = ? AND l.status = 'approved' AND l.archived_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > ?)
      ORDER BY rv.viewed_at DESC, rv.listing_id DESC LIMIT ?`,
  )
    .bind(auth.userId, now(), limit)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  return json(
    {
      data: (result.results ?? []).map((row) => ({
        listingId: stringValue(row.listing_id),
        viewedAt: stringValue(row.viewed_at),
        viewCount: Math.max(1, numberValue(row.view_count)),
        listing: socialListing(row, url.origin),
      })),
    },
    200,
    cors,
  );
}

async function removeRecentView(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  listingId: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const result = await env.DB.prepare(
    "DELETE FROM recent_listing_views WHERE user_id = ? AND listing_id = ?",
  )
    .bind(auth.userId, listingId)
    .run();
  return result.success ? json({ data: { success: true } }, 200, cors) : databaseError(cors);
}

async function clearRecentViews(request: Request, env: AccountSocialEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const result = await env.DB.prepare("DELETE FROM recent_listing_views WHERE user_id = ?")
    .bind(auth.userId)
    .run();
  return result.success ? json({ data: { success: true } }, 200, cors) : databaseError(cors);
}

async function sellerFollowSummary(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  sellerId: string,
) {
  const seller = await activeSeller(env, sellerId);
  if (!seller) return notFound(cors);
  const auth = await authenticate(request, env as unknown as AuthEnv);
  const [countRow, followRow] = await Promise.all([
    env.DB.prepare("SELECT count(*) AS count FROM seller_follows WHERE seller_id = ?")
      .bind(sellerId)
      .first<{ count: number }>(),
    auth
      ? env.DB.prepare(
          "SELECT 1 AS following FROM seller_follows WHERE follower_id = ? AND seller_id = ?",
        )
          .bind(auth.userId, sellerId)
          .first()
      : Promise.resolve(null),
  ]);
  return json(
    {
      data: {
        followerCount: Math.max(0, Number(countRow?.count ?? 0)),
        isFollowing: Boolean(followRow),
      },
    },
    200,
    cors,
  );
}

async function setSellerFollow(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  sellerId: string,
  following: boolean,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  if (!sellerId || sellerId === auth.userId) return validation(cors, "Invalid seller.");
  if (!(await activeSeller(env, sellerId))) return notFound(cors);
  const result = following
    ? await env.DB.prepare(
        "INSERT OR IGNORE INTO seller_follows (follower_id, seller_id, created_at) VALUES (?, ?, ?)",
      )
        .bind(auth.userId, sellerId, now())
        .run()
    : await env.DB.prepare("DELETE FROM seller_follows WHERE follower_id = ? AND seller_id = ?")
        .bind(auth.userId, sellerId)
        .run();
  if (!result.success) return databaseError(cors);
  return sellerFollowSummary(request, env, cors, sellerId);
}

async function listFollowedSellers(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  url: URL,
) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const limit = integer(url.searchParams.get("limit"), 12, 1, 30);
  const result = await env.DB.prepare(
    `SELECT p.id, p.display_name, p.first_name, p.last_name, p.business_name,
      p.governorate, p.bio, p.avatar_asset_id, sf.created_at AS followed_at,
      (SELECT count(*) FROM listings l WHERE l.owner_id = p.id
        AND l.status = 'approved' AND l.archived_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > ?)) AS approved_listing_count
      FROM seller_follows sf
      JOIN public_profiles p ON p.id = sf.seller_id
      WHERE sf.follower_id = ? AND p.account_status = 'active'
      ORDER BY sf.created_at DESC, p.id DESC LIMIT ?`,
  )
    .bind(now(), auth.userId, limit)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  return json(
    {
      data: (result.results ?? []).map((row) => ({
        id: stringValue(row.id),
        displayName:
          nullableString(row.display_name) ?? nullableString(row.business_name) ?? "بائع على رواج",
        firstName: nullableString(row.first_name),
        lastName: nullableString(row.last_name),
        businessName: nullableString(row.business_name),
        governorate: nullableString(row.governorate),
        bio: nullableString(row.bio),
        avatarUrl: mediaUrl(url.origin, row.avatar_asset_id),
        approvedListingCount: Math.max(0, numberValue(row.approved_listing_count)),
        followedAt: stringValue(row.followed_at),
      })),
    },
    200,
    cors,
  );
}

async function activeSeller(env: AccountSocialEnv, sellerId: string) {
  if (!isUuid(sellerId)) return null;
  return env.DB.prepare(
    `SELECT p.id FROM public_profiles p
      WHERE p.id = ? AND p.account_status = 'active'
        AND EXISTS (
          SELECT 1 FROM listings l WHERE l.owner_id = p.id
            AND l.status = 'approved' AND l.archived_at IS NULL
            AND (l.expires_at IS NULL OR l.expires_at > ?)
        )`,
  )
    .bind(sellerId, now())
    .first<{ id: string }>();
}

function socialListing(row: Row, origin: string) {
  return {
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    categoryId: stringValue(row.category_id),
    subcategoryId: nullableString(row.subcategory_id),
    governorateId: stringValue(row.governorate_id),
    title: stringValue(row.title),
    description: stringValue(row.description),
    price: nullableNumber(row.price),
    currency: "SYP",
    priceType: stringValue(row.price_type, "fixed"),
    condition: stringValue(row.listing_condition, "not_applicable"),
    status: "approved",
    districtAr: nullableString(row.district_ar),
    contactName: nullableString(row.contact_name),
    contactOptions: jsonObject(row.contact_options),
    details: jsonObject(row.details),
    isFeatured: row.is_featured === true || row.is_featured === 1,
    featuredUntil: nullableString(row.featured_until),
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    publishedAt: nullableString(row.published_at),
    archivedAt: null,
    reservedAt: nullableString(row.reserved_at),
    expiresAt: nullableString(row.expires_at),
    renewedAt: nullableString(row.renewed_at),
    expiryDays: nullableNumber(row.expiry_days),
    createdAt: stringValue(row.listing_created_at),
    updatedAt: stringValue(row.listing_updated_at),
    primaryImageUrl: mediaUrl(origin, row.primary_media_asset_id),
  };
}

function mediaUrl(origin: string, assetId: unknown): string | null {
  const id = nullableString(assetId);
  return id ? `${origin}/v1/media/assets/${encodeURIComponent(id)}` : null;
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
  const timestamp = now();
  const results = enabled
    ? await env.DB.batch([
        env.DB.prepare(
          "INSERT OR IGNORE INTO favorites (user_id, listing_id, created_at) VALUES (?, ?, ?)",
        ).bind(auth.userId, listingId, timestamp),
        env.DB.prepare(
          `INSERT INTO favorite_listing_snapshots
            (user_id, listing_id, title_snapshot, price_snapshot, currency_snapshot,
             status_snapshot, created_at, updated_at)
           SELECT ?, id, title, price, currency, status, ?, ? FROM listings WHERE id = ?
           ON CONFLICT(user_id, listing_id) DO NOTHING`,
        ).bind(auth.userId, timestamp, timestamp, listingId),
      ])
    : await env.DB.batch([
        env.DB.prepare("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?").bind(
          auth.userId,
          listingId,
        ),
        env.DB.prepare(
          "DELETE FROM favorite_listing_snapshots WHERE user_id = ? AND listing_id = ?",
        ).bind(auth.userId, listingId),
      ]);
  return results.every((result) => result.success)
    ? json({ data: { favorited: enabled } }, 200, cors)
    : databaseError(cors);
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
    `${messageSelect()} WHERE m.conversation_id = ? AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC, m.id ASC LIMIT ? OFFSET ?`,
  )
    .bind(auth.userId, id, pageSize, (page - 1) * pageSize)
    .all();
  return result.success
    ? json({ data: { items: result.results ?? [], page, pageSize } }, 200, cors)
    : databaseError(cors);
}

function messageSelect() {
  return `SELECT m.id, m.conversation_id, m.sender_id, m.sender_id = ? AS is_mine,
    m.body, m.media_asset_id AS attachment_path,
    a.content_type AS attachment_mime_type, a.byte_size AS attachment_size_bytes,
    cm.kind AS attachment_kind, cm.duration_ms AS attachment_duration_ms,
    m.created_at, m.edited_at, m.read_at, m.deleted_at
    FROM conversation_messages m
    LEFT JOIN media_assets a ON a.id = m.media_asset_id AND a.status = 'ready'
    LEFT JOIN chat_media_assets cm ON cm.asset_id = m.media_asset_id`;
}

async function sendMessage(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  conversationId: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const conversation = await participantRecord(env, conversationId, auth.userId);
  if (!conversation) return notFound(cors);
  if (conversation.status !== "active") {
    return json(
      { error: { code: "invalid_transition", message: "Conversation is not active." } },
      409,
      cors,
    );
  }
  const otherUserId =
    conversation.buyer_id === auth.userId ? conversation.seller_id : conversation.buyer_id;
  if (await usersBlocked(env, auth.userId, otherUserId)) {
    return json(
      { error: { code: "permission_denied", message: "Messaging is blocked." } },
      403,
      cors,
    );
  }

  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const message = normalizeMessage(body.data.body);
  const requestId = clean(body.data.requestId, 80);
  const attachmentInput = objectValue(body.data.attachment);
  const attachmentAssetId = clean(attachmentInput.path, 120);
  if ((!message && !attachmentAssetId) || message.length > MESSAGE_LIMIT) {
    return validation(cors, "Invalid message.");
  }
  if (!requestId || !isUuid(requestId)) return validation(cors, "Invalid message request id.");

  const existing = await env.DB.prepare(
    `${messageSelect()} WHERE m.sender_id = ? AND m.client_request_id = ?`,
  )
    .bind(auth.userId, auth.userId, requestId)
    .first();
  if (existing) return json({ data: existing }, 200, cors);

  let attachment: ChatAttachmentRow | null = null;
  if (attachmentAssetId) {
    attachment = await env.DB.prepare(
      `SELECT cm.asset_id, cm.kind, cm.duration_ms, a.content_type, a.byte_size
         FROM chat_media_assets cm JOIN media_assets a ON a.id = cm.asset_id
        WHERE cm.asset_id = ? AND cm.conversation_id = ? AND cm.uploader_id = ?
          AND cm.linked_message_id IS NULL AND a.status = 'ready'`,
    )
      .bind(attachmentAssetId, conversationId, auth.userId)
      .first<ChatAttachmentRow>();
    if (!attachment) return validation(cors, "Chat attachment is invalid or already used.");
  }

  const id = crypto.randomUUID();
  const timestamp = now();
  const messageType = attachment?.kind === "audio" ? "audio" : attachment ? "image" : "text";
  const statements = [
    env.DB.prepare(
      `INSERT INTO conversation_messages
       (id, conversation_id, sender_id, body, message_type, media_asset_id,
        media_duration_ms, client_request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      conversationId,
      auth.userId,
      message,
      messageType,
      attachment?.asset_id ?? null,
      attachment?.duration_ms ?? null,
      requestId,
      timestamp,
    ),
    env.DB.prepare(
      "UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?",
    ).bind(timestamp, timestamp, conversationId),
  ];
  if (attachment) {
    statements.push(
      env.DB.prepare(
        `UPDATE chat_media_assets SET linked_message_id = ?
          WHERE asset_id = ? AND uploader_id = ? AND linked_message_id IS NULL`,
      ).bind(id, attachment.asset_id, auth.userId),
    );
  }
  const results = await env.DB.batch(statements);
  if (results.some((result) => !result.success)) return databaseError(cors);

  return json(
    {
      data: {
        id,
        conversation_id: conversationId,
        sender_id: auth.userId,
        is_mine: 1,
        body: message,
        attachment_path: attachment?.asset_id ?? null,
        attachment_mime_type: attachment?.content_type ?? null,
        attachment_size_bytes: attachment?.byte_size ?? null,
        attachment_kind: attachment?.kind ?? null,
        attachment_duration_ms: attachment?.duration_ms ?? null,
        created_at: timestamp,
        edited_at: null,
        read_at: null,
        deleted_at: null,
      },
    },
    201,
    cors,
  );
}

async function uploadChatAttachment(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  conversationId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const conversation = await participantRecord(env, conversationId, auth.userId);
  if (!conversation) return notFound(cors);
  if (conversation.status !== "active") {
    return json(
      { error: { code: "invalid_transition", message: "Conversation is not active." } },
      409,
      cors,
    );
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/form-data")) {
    return json(
      { error: { code: "unsupported_media_type", message: "Multipart form required." } },
      415,
      cors,
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const requestId = clean(form.get("requestId"), 80);
  const requestedKind = clean(form.get("kind"), 20);
  if (!(file instanceof File) || !requestId || !isUuid(requestId)) {
    return validation(cors, "Invalid chat attachment request.");
  }

  const existing = await env.DB.prepare(
    `SELECT cm.asset_id, cm.kind, cm.duration_ms, a.content_type, a.byte_size
       FROM chat_media_assets cm JOIN media_assets a ON a.id = cm.asset_id
      WHERE cm.uploader_id = ? AND cm.client_request_id = ? AND a.status = 'ready'`,
  )
    .bind(auth.userId, requestId)
    .first<ChatAttachmentRow>();
  if (existing) return json({ data: chatAttachmentPayload(existing) }, 200, cors);

  const normalizedType = normalizeChatContentType(file.type);
  const kind = CHAT_IMAGE_TYPES.has(normalizedType)
    ? "image"
    : CHAT_AUDIO_TYPES.has(normalizedType)
      ? "audio"
      : null;
  if (!kind || (requestedKind && requestedKind !== kind)) {
    return validation(cors, "Unsupported chat attachment type.");
  }
  const maximumBytes = kind === "image" ? CHAT_IMAGE_MAX_BYTES : CHAT_AUDIO_MAX_BYTES;
  if (file.size <= 0 || file.size > maximumBytes) {
    return validation(cors, "Chat attachment size is invalid.");
  }
  const durationMs =
    kind === "audio"
      ? boundedInteger(form.get("durationMs"), 1000, CHAT_AUDIO_MAX_DURATION_MS)
      : null;
  if (kind === "audio" && durationMs === null) {
    return validation(cors, "Audio duration is invalid.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "image" && !matchesImageSignature(bytes, normalizedType)) {
    return validation(cors, "Image content is invalid.");
  }
  if (kind === "audio" && !matchesAudioSignature(bytes, normalizedType)) {
    return validation(cors, "Audio content is invalid.");
  }

  const assetId = crypto.randomUUID();
  const extension = chatExtension(normalizedType);
  const objectKey = `chats/${conversationId}/${auth.userId}/${assetId}.${extension}`;
  const checksum = await sha256Hex(bytes);
  const timestamp = now();
  let object: { httpEtag: string };
  try {
    object = await env.MEDIA.put(objectKey, bytes.buffer, {
      httpMetadata: { contentType: normalizedType, cacheControl: "private, no-store" },
    });
  } catch {
    return databaseError(cors);
  }

  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO media_assets (id, owner_id, object_key, content_type, byte_size,
        checksum_sha256, etag, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`,
    ).bind(
      assetId,
      auth.userId,
      objectKey,
      normalizedType,
      file.size,
      checksum,
      object.httpEtag,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      `INSERT INTO chat_media_assets
       (asset_id, conversation_id, uploader_id, kind, duration_ms, client_request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(assetId, conversationId, auth.userId, kind, durationMs, requestId, timestamp),
  ]);
  if (results.some((result) => !result.success)) {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    return databaseError(cors);
  }

  return json(
    {
      data: chatAttachmentPayload({
        asset_id: assetId,
        kind,
        duration_ms: durationMs,
        content_type: normalizedType,
        byte_size: file.size,
      }),
    },
    201,
    cors,
  );
}

async function readChatMedia(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  assetId: string,
): Promise<Response> {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    `SELECT a.object_key, a.content_type, a.byte_size, cm.conversation_id
       FROM chat_media_assets cm JOIN media_assets a ON a.id = cm.asset_id
      JOIN conversations c ON c.id = cm.conversation_id
      WHERE cm.asset_id = ? AND a.status = 'ready'
        AND (c.buyer_id = ? OR c.seller_id = ?)`,
  )
    .bind(assetId, auth.userId, auth.userId)
    .first<{
      object_key: string;
      content_type: string;
      byte_size: number;
      conversation_id: string;
    }>();
  if (!row) return notFound(cors);
  const object = await env.MEDIA.get(row.object_key);
  if (!object) return notFound(cors);
  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", row.content_type);
  headers.set("Content-Length", String(row.byte_size));
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { status: 200, headers });
}

async function removeChatMedia(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  assetId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const row = await env.DB.prepare(
    `SELECT a.object_key FROM chat_media_assets cm JOIN media_assets a ON a.id = cm.asset_id
      WHERE cm.asset_id = ? AND cm.uploader_id = ? AND cm.linked_message_id IS NULL`,
  )
    .bind(assetId, auth.userId)
    .first<{ object_key: string }>();
  if (!row) return notFound(cors);
  try {
    await env.MEDIA.delete(row.object_key);
  } catch {
    return databaseError(cors);
  }
  const result = await env.DB.prepare("DELETE FROM media_assets WHERE id = ? AND owner_id = ?")
    .bind(assetId, auth.userId)
    .run();
  return result.success ? json({ data: { success: true } }, 200, cors) : databaseError(cors);
}

async function createMessageReport(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  messageId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reason = clean(body.data.reason, 80);
  const details = cleanOptional(body.data.details, 1000);
  if (!reason || !MESSAGE_REPORT_REASONS.has(reason) || (reason === "other" && !details)) {
    return validation(cors, "Invalid report reason.");
  }
  const message = await env.DB.prepare(
    `SELECT m.id, m.conversation_id, m.sender_id, c.buyer_id, c.seller_id
       FROM conversation_messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ? AND m.deleted_at IS NULL AND (c.buyer_id = ? OR c.seller_id = ?)`,
  )
    .bind(messageId, auth.userId, auth.userId)
    .first<{
      id: string;
      conversation_id: string;
      sender_id: string;
      buyer_id: string;
      seller_id: string;
    }>();
  if (!message) return notFound(cors);
  if (message.sender_id === auth.userId)
    return validation(cors, "You cannot report your own message.");
  const existing = await env.DB.prepare(
    "SELECT id FROM message_reports WHERE message_id = ? AND reporter_user_id = ?",
  )
    .bind(messageId, auth.userId)
    .first<{ id: string }>();
  if (existing) return json({ data: { id: existing.id, created: false } }, 200, cors);

  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO message_reports
     (id, message_id, conversation_id, reporter_user_id, reported_user_id,
      reason, details, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
  )
    .bind(
      id,
      messageId,
      message.conversation_id,
      auth.userId,
      message.sender_id,
      reason,
      details,
      timestamp,
      timestamp,
    )
    .run();
  return result.success ? json({ data: { id, created: true } }, 201, cors) : databaseError(cors);
}

async function blockParticipant(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  conversationId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const conversation = await participantRecord(env, conversationId, auth.userId);
  if (!conversation) return notFound(cors);
  const otherUserId =
    conversation.buyer_id === auth.userId ? conversation.seller_id : conversation.buyer_id;
  const timestamp = now();
  const results = await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)",
    ).bind(auth.userId, otherUserId, timestamp),
    env.DB.prepare("UPDATE conversations SET status = 'blocked', updated_at = ? WHERE id = ?").bind(
      timestamp,
      conversationId,
    ),
  ]);
  return results.every((result) => result.success)
    ? json({ data: { success: true } }, 200, cors)
    : databaseError(cors);
}

async function listMessageReports(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  if (!hasAdminRole(auth.roles)) return forbidden(cors);
  const result = await env.DB.prepare(
    `SELECT r.id, r.message_id, r.conversation_id, r.reporter_user_id, r.reported_user_id,
      r.reason, r.details, r.status, r.admin_note, r.reviewed_by, r.reviewed_at,
      r.created_at, r.updated_at, m.body AS message_body, c.listing_id,
      l.title AS listing_title, reporter.display_name AS reporter_display_name,
      reported.display_name AS reported_display_name
      FROM message_reports r
      LEFT JOIN conversation_messages m ON m.id = r.message_id
      LEFT JOIN conversations c ON c.id = r.conversation_id
      LEFT JOIN listings l ON l.id = c.listing_id
      LEFT JOIN public_profiles reporter ON reporter.id = r.reporter_user_id
      LEFT JOIN public_profiles reported ON reported.id = r.reported_user_id
      ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'under_review' THEN 1 ELSE 2 END,
        r.created_at DESC LIMIT 200`,
  ).all();
  return result.success ? json({ data: result.results ?? [] }, 200, cors) : databaseError(cors);
}

async function moderateMessageReport(
  request: Request,
  env: AccountSocialEnv,
  cors: Headers,
  reportId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  if (!hasAdminRole(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const status = clean(body.data.status, 40);
  const expectedUpdatedAt = clean(body.data.expectedUpdatedAt, 120);
  const adminNote = cleanOptional(body.data.adminNote, 1000);
  if (!status || !MESSAGE_REPORT_STATUSES.has(status) || !expectedUpdatedAt) {
    return validation(cors, "Invalid message-report decision.");
  }
  const existing = await env.DB.prepare("SELECT updated_at FROM message_reports WHERE id = ?")
    .bind(reportId)
    .first<{ updated_at: string }>();
  if (!existing) return notFound(cors);
  if (existing.updated_at !== expectedUpdatedAt) {
    return json(
      { error: { code: "status_mismatch", message: "Report changed. Reload and retry." } },
      409,
      cors,
    );
  }
  const timestamp = now();
  const reviewedAt = status === "new" ? null : timestamp;
  const reviewedBy = status === "new" ? null : auth.userId;
  const result = await env.DB.prepare(
    `UPDATE message_reports SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ? AND updated_at = ?`,
  )
    .bind(status, adminNote, reviewedBy, reviewedAt, timestamp, reportId, expectedUpdatedAt)
    .run();
  return result.success
    ? json({ data: { success: true, updatedAt: timestamp } }, 200, cors)
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
  return participantRecord(env, id, userId);
}

async function participantRecord(
  env: AccountSocialEnv,
  id: string,
  userId: string,
): Promise<ConversationParticipantRow | null> {
  return env.DB.prepare(
    `SELECT id, buyer_id, seller_id, status FROM conversations
      WHERE id = ? AND (buyer_id = ? OR seller_id = ?)`,
  )
    .bind(id, userId, userId)
    .first<ConversationParticipantRow>();
}

async function usersBlocked(
  env: AccountSocialEnv,
  first: string,
  second: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS blocked FROM user_blocks
      WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
      LIMIT 1`,
  )
    .bind(first, second, second, first)
    .first();
  return Boolean(row);
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

function chatAttachmentPayload(row: ChatAttachmentRow) {
  return {
    path: row.asset_id,
    mimeType: row.content_type,
    sizeBytes: Number(row.byte_size),
    kind: row.kind,
    durationMs: row.kind === "audio" ? Number(row.duration_ms) : null,
  };
}

function normalizeChatContentType(value: string): string {
  const type = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const aliases: Record<string, string> = {
    "video/webm": "audio/webm",
    "video/mp4": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "audio/x-m4a": "audio/mp4",
    "audio/mp3": "audio/mpeg",
  };
  return aliases[type] ?? type;
}

function chatExtension(contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "audio/mp4") return "m4a";
  if (contentType === "audio/mpeg") return "mp3";
  if (contentType === "audio/ogg") return "ogg";
  return "webm";
}

function matchesImageSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (value, index) => bytes[index] === value,
      )
    );
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  }
  return false;
}

function matchesAudioSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "audio/webm") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }
  if (contentType === "audio/mp4") {
    return bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp";
  }
  if (contentType === "audio/ogg") {
    return bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS";
  }
  if (contentType === "audio/mpeg") {
    return (
      (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") ||
      (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function boundedInteger(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const integerValue = Math.trunc(parsed);
  return integerValue >= min && integerValue <= max ? integerValue : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonObject(value: unknown): Row {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Row) : {};
  } catch {
    return {};
  }
}

function objectValue(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function cleanOptional(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex -- Intentional ASCII control-character sanitization.
  const normalized = value
    // eslint-disable-next-line no-control-regex -- Intentional ASCII control-character sanitization.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
  return normalized || null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hasAdminRole(roles: string[]): boolean {
  return roles.includes("owner") || roles.includes("admin") || roles.includes("moderator");
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
function forbidden(cors: Headers) {
  return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors);
}
function notFound(cors: Headers) {
  return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
}
function databaseError(cors: Headers) {
  return json({ error: { code: "database_unavailable", message: "Data unavailable." } }, 503, cors);
}
