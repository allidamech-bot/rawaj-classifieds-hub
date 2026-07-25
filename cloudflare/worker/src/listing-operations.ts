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
interface R2Object {
  body: ReadableStream;
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

export interface ListingOperationsEnv {
  DB: Database;
  MEDIA: R2Bucket;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

const CLOSE_ACTIONS = new Set(["sold", "rented", "unavailable"]);
const PROMOTION_TYPES = new Set(["featured_home", "highlighted", "urgent", "top_category"]);
const PROMOTION_STATUSES = new Set(["approved", "rejected"]);
const RECEIPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;
const MAX_REMINDER_CANDIDATES = 20;
const DAY_MS = 86_400_000;

function asAuthEnv(env: ListingOperationsEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleListingOperations(
  request: Request,
  env: ListingOperationsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  if (!relevant(path)) return null;
  const cors = corsHeaders(request, asAuthEnv(env));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const lifecycle = path.match(/^\/v1\/listings\/([^/]+)\/lifecycle$/);
  if (lifecycle && request.method === "PATCH") {
    return lifecycleAction(request, env, cors, decodeURIComponent(lifecycle[1]));
  }
  if (path === "/v1/account/listings/expiry-reminders/scan" && request.method === "POST") {
    return scanExpiryReminders(request, env, cors);
  }
  const context = path.match(/^\/v1\/listings\/([^/]+)\/price-context$/);
  if (context && request.method === "GET") {
    return priceContext(request, env, cors, decodeURIComponent(context[1]));
  }
  if (path === "/v1/offers/price-drops" && request.method === "GET") {
    return activePriceDrops(url, env, cors);
  }
  if (path === "/v1/account/promotions") {
    if (request.method === "GET") return listOwnPromotions(request, env, cors);
    if (request.method === "POST") return createPromotion(request, env, cors);
  }
  const receipt = path.match(/^\/v1\/account\/promotions\/([^/]+)\/receipt$/);
  if (receipt && request.method === "POST") {
    return uploadPromotionReceipt(request, env, cors, decodeURIComponent(receipt[1]));
  }
  if (path === "/v1/admin/promotions" && request.method === "GET") {
    return listAdminPromotions(request, env, cors);
  }
  const adminReceipt = path.match(/^\/v1\/admin\/promotions\/([^/]+)\/receipt$/);
  if (adminReceipt && request.method === "GET") {
    return readPromotionReceipt(request, env, cors, decodeURIComponent(adminReceipt[1]));
  }
  const receiptAsset = path.match(/^\/v1\/admin\/promotion-receipts\/([^/]+)$/);
  if (receiptAsset && request.method === "GET") {
    return readPromotionReceiptByAsset(request, env, cors, decodeURIComponent(receiptAsset[1]));
  }
  const moderate = path.match(/^\/v1\/admin\/promotions\/([^/]+)$/);
  if (moderate && request.method === "PATCH") {
    return moderatePromotion(request, env, cors, decodeURIComponent(moderate[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function relevant(path: string): boolean {
  return (
    /^\/v1\/listings\/[^/]+\/(?:lifecycle|price-context)$/.test(path) ||
    path === "/v1/account/listings/expiry-reminders/scan" ||
    path === "/v1/offers/price-drops" ||
    /^\/v1\/(?:account|admin)\/promotions(?:\/|$)/.test(path) ||
    /^\/v1\/admin\/promotion-receipts\//.test(path)
  );
}

async function lifecycleAction(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
  listingId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!listingId.trim()) return validation(cors, "Listing is required.");
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const action = clean(body.data.action, 40);
  if (!action) return validation(cors, "Lifecycle action is required.");

  const listing = await env.DB.prepare(
    `SELECT id, owner_id, status, price, price_type, archived_at, reserved_at,
            expires_at, expiry_days, renewed_at
       FROM listings WHERE id = ? AND owner_id = ?`,
  )
    .bind(listingId, auth.userId)
    .first<Row>();
  if (!listing) return notFound(cors);
  if (!(await accountCanManageListings(env, auth.userId))) return forbidden(cors);

  const timestamp = now();
  let statement: Statement;
  let auditAction: string;
  let metadata: Row = { action };

  if (CLOSE_ACTIONS.has(action)) {
    if (stringValue(listing.status) !== "approved") {
      return conflict(cors, "Only approved listings may be closed.");
    }
    statement = env.DB.prepare(
      `UPDATE listings SET status = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND status = 'approved'`,
    ).bind(action, timestamp, listingId, auth.userId);
    auditAction = `listing.${action}`;
  } else if (action === "reactivate") {
    const status = stringValue(listing.status);
    const expiredApproved =
      status === "approved" &&
      Boolean(listing.expires_at) &&
      String(listing.expires_at) <= timestamp;
    if (!["sold", "rented", "unavailable", "expired"].includes(status) && !expiredApproved) {
      return conflict(cors, "Listing cannot be reactivated from its current state.");
    }
    statement = env.DB.prepare(
      `UPDATE listings
          SET status = 'pending_review', published_at = NULL, archived_at = NULL,
              expires_at = NULL, reserved_at = NULL, updated_at = ?
        WHERE id = ? AND owner_id = ?`,
    ).bind(timestamp, listingId, auth.userId);
    auditAction = "listing.reactivated";
  } else if (action === "set_expiry") {
    const daysValue = body.data.expiryDays;
    const days = daysValue === null ? null : integer(daysValue, -1);
    if (days !== null && ![30, 60, 90].includes(days)) {
      return validation(cors, "Unsupported expiry duration.");
    }
    if (stringValue(listing.status) !== "approved") {
      return conflict(cors, "Only approved listings may change expiry.");
    }
    const expiresAt = days === null ? null : new Date(Date.now() + days * DAY_MS).toISOString();
    statement = env.DB.prepare(
      `UPDATE listings SET expiry_days = ?, expires_at = ?, renewed_at = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND status = 'approved'`,
    ).bind(days, expiresAt, timestamp, timestamp, listingId, auth.userId);
    auditAction = "listing.expiry_updated";
    metadata = { action, expiryDays: days, expiresAt };
  } else if (action === "confirm_availability") {
    if (
      stringValue(listing.status) !== "approved" ||
      Boolean(listing.archived_at) ||
      (listing.expires_at && String(listing.expires_at) <= timestamp)
    ) {
      return conflict(cors, "Available approved listing required.");
    }
    statement = env.DB.prepare(
      `UPDATE listings SET renewed_at = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND status = 'approved' AND archived_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)`,
    ).bind(timestamp, timestamp, listingId, auth.userId, timestamp);
    auditAction = "listing.availability_confirmed";
  } else if (action === "reserve" || action === "unreserve") {
    if (
      stringValue(listing.status) !== "approved" ||
      Boolean(listing.archived_at) ||
      (listing.expires_at && String(listing.expires_at) <= timestamp)
    ) {
      return conflict(cors, "Only a public available listing may be reserved.");
    }
    const reservedAt =
      action === "reserve" ? (nullableString(listing.reserved_at) ?? timestamp) : null;
    statement = env.DB.prepare(
      `UPDATE listings SET reserved_at = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND status = 'approved' AND archived_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)`,
    ).bind(reservedAt, timestamp, listingId, auth.userId, timestamp);
    auditAction = action === "reserve" ? "listing.reserved" : "listing.reservation_cleared";
    metadata = { action, reserved: action === "reserve" };
  } else if (action === "reduce_price") {
    const newPrice = numberValue(body.data.newPrice);
    const oldPrice = numberValue(listing.price);
    if (
      stringValue(listing.status) !== "approved" ||
      Boolean(listing.archived_at) ||
      (listing.expires_at && String(listing.expires_at) <= timestamp)
    ) {
      return conflict(cors, "Only a public available listing may change price.");
    }
    if (!["fixed", "negotiable"].includes(stringValue(listing.price_type)) || oldPrice <= 0) {
      return conflict(cors, "A numeric fixed or negotiable price is required.");
    }
    if (!Number.isFinite(newPrice) || newPrice <= 0 || newPrice >= oldPrice) {
      return validation(cors, "New price must be lower than the current price.");
    }
    const discount = ((oldPrice - newPrice) / oldPrice) * 100;
    if (discount < 1) return validation(cors, "Price reduction must be at least 1 percent.");
    const priceChangeId = crypto.randomUUID();
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE listings SET price = ?, updated_at = ?
          WHERE id = ? AND owner_id = ? AND status = 'approved' AND price = ?
            AND archived_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
      ).bind(newPrice, timestamp, listingId, auth.userId, oldPrice, timestamp),
      env.DB.prepare(
        `INSERT OR IGNORE INTO listing_price_changes
          (id, listing_id, owner_id, old_price, new_price, currency, created_at)
         SELECT ?, ?, ?, ?, ?, 'SYP', ?
          WHERE EXISTS (SELECT 1 FROM listings WHERE id = ? AND owner_id = ? AND price = ?)`,
      ).bind(
        priceChangeId,
        listingId,
        auth.userId,
        oldPrice,
        newPrice,
        timestamp,
        listingId,
        auth.userId,
        newPrice,
      ),
      auditStatement(env, auth.userId, "listing.price_reduced", listingId, {
        oldPrice,
        newPrice,
        discountPercent: Math.round(discount * 10) / 10,
      }),
    ]);
    if (results.some((result) => !result.success)) return databaseError(cors);
    const changed = await env.DB.prepare("SELECT id FROM listing_price_changes WHERE id = ?")
      .bind(priceChangeId)
      .first();
    if (!changed) return conflict(cors, "Listing changed. Reload and retry.");
    return json({ data: { success: true, updatedAt: timestamp } }, 200, cors);
  } else {
    return validation(cors, "Unsupported lifecycle action.");
  }

  const result = await statement.run();
  if (!result.success) return databaseError(cors);
  const current = await env.DB.prepare(
    "SELECT updated_at FROM listings WHERE id = ? AND owner_id = ?",
  )
    .bind(listingId, auth.userId)
    .first<{ updated_at: string }>();
  if (!current || current.updated_at !== timestamp)
    return conflict(cors, "Listing changed. Reload and retry.");
  await auditStatement(env, auth.userId, auditAction, listingId, metadata).run();
  return json({ data: { success: true, updatedAt: timestamp } }, 200, cors);
}

async function scanExpiryReminders(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const timestamp = now();
  const windowEnd = new Date(Date.now() + 7 * DAY_MS).toISOString();
  const preference = await env.DB.prepare(
    "SELECT listing_status_enabled FROM notification_preferences WHERE user_id = ?",
  )
    .bind(auth.userId)
    .first<{ listing_status_enabled: number }>();
  if (preference && !booleanValue(preference.listing_status_enabled)) {
    return json({ data: { deliveredCount: 0 } }, 200, cors);
  }
  const candidates = await env.DB.prepare(
    `SELECT id, title, expires_at FROM listings
      WHERE owner_id = ? AND status = 'approved' AND archived_at IS NULL
        AND expires_at IS NOT NULL AND expires_at > ? AND expires_at <= ?
      ORDER BY expires_at LIMIT ?`,
  )
    .bind(auth.userId, timestamp, windowEnd, MAX_REMINDER_CANDIDATES)
    .all<Row>();
  if (!candidates.success) return databaseError(cors);

  let deliveredCount = 0;
  for (const row of candidates.results ?? []) {
    const expiresAt = nullableString(row.expires_at);
    if (!expiresAt) continue;
    const remaining = Date.parse(expiresAt) - Date.now();
    const kind = remaining <= DAY_MS ? "expiring_1d" : "expiring_7d";
    if (kind === "expiring_7d" && remaining <= DAY_MS) continue;
    const deliveryId = crypto.randomUUID();
    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO listing_expiry_reminder_deliveries
        (listing_id, user_id, reminder_kind, created_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(stringValue(row.id), auth.userId, kind, timestamp)
      .run();
    if (!inserted.success) return databaseError(cors);
    const recorded = await env.DB.prepare(
      `SELECT 1 AS found FROM listing_expiry_reminder_deliveries
        WHERE listing_id = ? AND user_id = ? AND reminder_kind = ? AND created_at = ?`,
    )
      .bind(stringValue(row.id), auth.userId, kind, timestamp)
      .first();
    if (!recorded) continue;
    const body =
      kind === "expiring_1d"
        ? `إعلان "${stringValue(row.title)}" سينتهي خلال أقل من يوم.`
        : `إعلان "${stringValue(row.title)}" سينتهي خلال 7 أيام.`;
    const notification = await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
       VALUES (?, ?, 'listing.expiring_soon', ?, ?, ?, ?)`,
    )
      .bind(
        deliveryId,
        auth.userId,
        "إعلانك يقترب من الانتهاء",
        body,
        JSON.stringify({ listingId: row.id, reminderKind: kind, expiresAt }),
        timestamp,
      )
      .run();
    if (!notification.success) return databaseError(cors);
    deliveredCount += 1;
  }
  return json({ data: { deliveredCount } }, 200, cors);
}

async function priceContext(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
  listingId: string,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const row = await env.DB.prepare(
    `SELECT s.price_snapshot, l.price AS current_price, l.status, l.archived_at, l.expires_at
       FROM favorite_listing_snapshots s JOIN listings l ON l.id = s.listing_id
      WHERE s.user_id = ? AND s.listing_id = ?`,
  )
    .bind(auth.userId, listingId)
    .first<Row>();
  const timestamp = now();
  if (
    !row ||
    stringValue(row.status) !== "approved" ||
    row.archived_at ||
    (row.expires_at && String(row.expires_at) <= timestamp)
  )
    return json({ data: null }, 200, cors);
  const previousPrice = nullableNumber(row.price_snapshot);
  const currentPrice = nullableNumber(row.current_price);
  if (previousPrice === null || currentPrice === null || previousPrice === currentPrice) {
    return json({ data: null }, 200, cors);
  }
  return json(
    {
      data: {
        previousPrice,
        currentPrice,
        currency: "SYP",
        direction: currentPrice > previousPrice ? "increased" : "decreased",
      },
    },
    200,
    cors,
  );
}

async function activePriceDrops(
  url: URL,
  env: ListingOperationsEnv,
  cors: Headers,
): Promise<Response> {
  const limit = clampInteger(url.searchParams.get("limit"), 30, 1, 50);
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const timestamp = now();
  const result = await env.DB.prepare(
    `WITH ranked AS (
       SELECT c.*, ROW_NUMBER() OVER (
         PARTITION BY c.listing_id ORDER BY c.created_at DESC, c.id DESC
       ) AS row_number
       FROM listing_price_changes c
     )
     SELECT d.listing_id, d.old_price, d.new_price, d.created_at AS dropped_at,
       l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,
       l.location_node_id, l.title, l.description, l.price, l.currency, l.price_type,
       l.listing_condition, l.status, l.district_ar, l.contact_name, l.contact_options,
       l.details, l.is_featured, l.featured_until, l.published_at, l.reserved_at,
       l.expires_at, l.renewed_at, l.expiry_days, l.created_at, l.updated_at,
       cat.name_ar AS category_name_ar, cat.placeholder AS category_placeholder,
       g.name_ar AS governorate_name_ar,
       (SELECT li.media_asset_id FROM listing_images li
         JOIN media_assets ma ON ma.id = li.media_asset_id AND ma.status = 'ready'
        WHERE li.listing_id = l.id ORDER BY li.sort_order, li.id LIMIT 1) AS primary_media_asset_id
     FROM ranked d
     JOIN listings l ON l.id = d.listing_id
     JOIN categories cat ON cat.id = l.category_id
     JOIN governorates g ON g.id = l.governorate_id
     WHERE d.row_number = 1 AND l.status = 'approved' AND l.archived_at IS NULL
       AND l.reserved_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > ?)
       AND l.price_type IN ('fixed', 'negotiable') AND l.price = d.new_price
       AND d.old_price > d.new_price AND d.new_price > 0 AND d.created_at >= ?
       AND ((d.old_price - d.new_price) / d.old_price) * 100 >= 1
     ORDER BY d.created_at DESC, l.id DESC LIMIT ?`,
  )
    .bind(timestamp, since, limit)
    .all<Row>();
  if (!result.success) return databaseError(cors);
  return json(
    {
      data: (result.results ?? []).map((row) => ({
        listing: mapPublicListing(row, url.origin),
        oldPrice: numberValue(row.old_price),
        newPrice: numberValue(row.new_price),
        discountPercent:
          Math.round(
            ((numberValue(row.old_price) - numberValue(row.new_price)) /
              numberValue(row.old_price)) *
              1000,
          ) / 10,
        droppedAt: stringValue(row.dropped_at),
      })),
    },
    200,
    cors,
  );
}

async function createPromotion(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!(await accountCanManageListings(env, auth.userId))) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const listingId = clean(body.data.listingId, 100);
  const promotionType = clean(body.data.promotionType, 40);
  const requestedDays = integer(body.data.requestedDays, 0);
  const clientRequestId = clean(body.data.clientRequestId, 100);
  const paymentMethod = cleanOptional(body.data.paymentMethod, 80);
  const paymentReference = cleanOptional(body.data.paymentReference, 160);
  if (
    !listingId ||
    !promotionType ||
    !PROMOTION_TYPES.has(promotionType) ||
    requestedDays < 1 ||
    requestedDays > 90 ||
    !clientRequestId
  ) {
    return validation(cors, "Invalid promotion request.");
  }
  const existingByRequest = await env.DB.prepare(
    "SELECT * FROM listing_promotion_requests WHERE requester_user_id = ? AND client_request_id = ?",
  )
    .bind(auth.userId, clientRequestId)
    .first<Row>();
  if (existingByRequest) return json({ data: mapPromotion(existingByRequest) }, 200, cors);
  const listing = await env.DB.prepare(
    `SELECT id, title FROM listings WHERE id = ? AND owner_id = ? AND status = 'approved'
      AND archived_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
  )
    .bind(listingId, auth.userId, now())
    .first<Row>();
  if (!listing) return conflict(cors, "An approved owned listing is required.");
  const pending = await env.DB.prepare(
    `SELECT * FROM listing_promotion_requests
      WHERE listing_id = ? AND requester_user_id = ? AND status = 'pending_review'`,
  )
    .bind(listingId, auth.userId)
    .first<Row>();
  if (pending)
    return json({ data: mapPromotion({ ...pending, listing_title: listing.title }) }, 200, cors);
  const id = crypto.randomUUID();
  const timestamp = now();
  const inserted = await env.DB.prepare(
    `INSERT INTO listing_promotion_requests
      (id, listing_id, requester_user_id, client_request_id, promotion_type, status,
       requested_days, payment_method, payment_reference, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      listingId,
      auth.userId,
      clientRequestId,
      promotionType,
      requestedDays,
      paymentMethod,
      paymentReference,
      timestamp,
      timestamp,
    )
    .run();
  if (!inserted.success) return databaseError(cors);
  return json(
    {
      data: mapPromotion({
        id,
        listing_id: listingId,
        requester_user_id: auth.userId,
        promotion_type: promotionType,
        status: "pending_review",
        requested_days: requestedDays,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        listing_title: listing.title,
        created_at: timestamp,
        updated_at: timestamp,
      }),
    },
    201,
    cors,
  );
}

async function listOwnPromotions(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const result = await env.DB.prepare(
    `SELECT p.*, l.title AS listing_title FROM listing_promotion_requests p
      JOIN listings l ON l.id = p.listing_id
      WHERE p.requester_user_id = ? ORDER BY p.created_at DESC LIMIT 100`,
  )
    .bind(auth.userId)
    .all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapPromotion) }, 200, cors)
    : databaseError(cors);
}

async function listAdminPromotions(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canModerate(auth.roles)) return forbidden(cors);
  const result = await env.DB.prepare(
    `SELECT p.*, l.title AS listing_title FROM listing_promotion_requests p
      JOIN listings l ON l.id = p.listing_id
      ORDER BY CASE p.status WHEN 'pending_review' THEN 0 ELSE 1 END, p.created_at DESC LIMIT 200`,
  ).all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapPromotion) }, 200, cors)
    : databaseError(cors);
}

async function uploadPromotionReceipt(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
  promotionId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/form-data")) {
    return json(
      { error: { code: "unsupported_media_type", message: "Multipart form required." } },
      415,
      cors,
    );
  }
  const promotion = await env.DB.prepare(
    `SELECT p.id, p.status, p.proof_asset_id, a.object_key AS old_object_key
       FROM listing_promotion_requests p LEFT JOIN media_assets a ON a.id = p.proof_asset_id
      WHERE p.id = ? AND p.requester_user_id = ?`,
  )
    .bind(promotionId, auth.userId)
    .first<Row>();
  if (!promotion || stringValue(promotion.status) !== "pending_review") return forbidden(cors);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return validation(cors, "Receipt file is required.");
  const contentType = normalizeContentType(file.type);
  if (!RECEIPT_TYPES.has(contentType) || file.size <= 0 || file.size > MAX_RECEIPT_BYTES) {
    return validation(cors, "Unsupported receipt type or size.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesReceiptSignature(bytes, contentType))
    return validation(cors, "Receipt content is invalid.");
  const assetId = crypto.randomUUID();
  const objectKey = `promotion-receipts/${auth.userId}/${promotionId}/${assetId}.${extensionFor(contentType)}`;
  const timestamp = now();
  const checksum = await sha256Hex(bytes);
  let object: { httpEtag: string };
  try {
    object = await env.MEDIA.put(objectKey, bytes.buffer, {
      httpMetadata: { contentType, cacheControl: "private, no-store" },
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
      contentType,
      file.size,
      checksum,
      object.httpEtag,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      `UPDATE listing_promotion_requests SET proof_asset_id = ?, updated_at = ?
        WHERE id = ? AND requester_user_id = ? AND status = 'pending_review'`,
    ).bind(assetId, timestamp, promotionId, auth.userId),
  ]);
  if (results.some((result) => !result.success)) {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    return databaseError(cors);
  }
  const attached = await env.DB.prepare(
    "SELECT proof_asset_id FROM listing_promotion_requests WHERE id = ? AND requester_user_id = ?",
  )
    .bind(promotionId, auth.userId)
    .first<{ proof_asset_id: string }>();
  if (!attached || attached.proof_asset_id !== assetId) {
    await env.MEDIA.delete(objectKey).catch(() => undefined);
    await env.DB.prepare("DELETE FROM media_assets WHERE id = ?").bind(assetId).run();
    return conflict(cors, "Promotion request changed. Reload and retry.");
  }
  const oldAssetId = nullableString(promotion.proof_asset_id);
  const oldObjectKey = nullableString(promotion.old_object_key);
  if (oldAssetId && oldObjectKey && oldAssetId !== assetId) {
    await env.MEDIA.delete(oldObjectKey).catch(() => undefined);
    await env.DB.prepare("UPDATE media_assets SET status = 'deleted', updated_at = ? WHERE id = ?")
      .bind(timestamp, oldAssetId)
      .run();
  }
  return json({ data: { proofPath: assetId } }, 200, cors);
}

async function readPromotionReceipt(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
  promotionId: string,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canModerate(auth.roles)) return forbidden(cors);
  const row = await env.DB.prepare(
    `SELECT a.object_key, a.content_type FROM listing_promotion_requests p
      JOIN media_assets a ON a.id = p.proof_asset_id AND a.status = 'ready'
      WHERE p.id = ?`,
  )
    .bind(promotionId)
    .first<Row>();
  if (!row) return notFound(cors);
  const object = await env.MEDIA.get(stringValue(row.object_key));
  if (!object) return notFound(cors);
  const headers = new Headers(cors);
  headers.set("Content-Type", stringValue(row.content_type, "application/octet-stream"));
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
}

async function readPromotionReceiptByAsset(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
  assetId: string,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canModerate(auth.roles)) return forbidden(cors);
  const row = await env.DB.prepare(
    `SELECT a.object_key, a.content_type FROM listing_promotion_requests p
      JOIN media_assets a ON a.id = p.proof_asset_id AND a.status = 'ready'
      WHERE a.id = ?`,
  )
    .bind(assetId)
    .first<Row>();
  if (!row) return notFound(cors);
  const object = await env.MEDIA.get(stringValue(row.object_key));
  if (!object) return notFound(cors);
  const headers = new Headers(cors);
  headers.set("Content-Type", stringValue(row.content_type, "application/octet-stream"));
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { status: 200, headers });
}

async function moderatePromotion(
  request: Request,
  env: ListingOperationsEnv,
  cors: Headers,
  promotionId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!canModerate(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const status = clean(body.data.status, 30);
  const expectedUpdatedAt = clean(body.data.expectedUpdatedAt, 80);
  const adminNote = cleanOptional(body.data.adminNote, 1000);
  if (!status || !PROMOTION_STATUSES.has(status) || !expectedUpdatedAt)
    return validation(cors, "Invalid moderation request.");
  const current = await env.DB.prepare(
    "SELECT requested_days, status, updated_at FROM listing_promotion_requests WHERE id = ?",
  )
    .bind(promotionId)
    .first<Row>();
  if (!current) return notFound(cors);
  if (
    stringValue(current.status) !== "pending_review" ||
    stringValue(current.updated_at) !== expectedUpdatedAt
  ) {
    return json(
      { error: { code: "stale_review", message: "Promotion request changed. Reload and retry." } },
      409,
      cors,
    );
  }
  const timestamp = now();
  const startsAt = status === "approved" ? timestamp : null;
  const endsAt =
    status === "approved"
      ? new Date(Date.now() + integer(current.requested_days, 1) * DAY_MS).toISOString()
      : null;
  const updated = await env.DB.prepare(
    `UPDATE listing_promotion_requests
        SET status = ?, starts_at = ?, ends_at = ?, admin_note = ?, reviewed_by = ?,
            reviewed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending_review' AND updated_at = ?`,
  )
    .bind(
      status,
      startsAt,
      endsAt,
      adminNote,
      auth.userId,
      timestamp,
      timestamp,
      promotionId,
      expectedUpdatedAt,
    )
    .run();
  if (!updated.success) return databaseError(cors);
  const verified = await env.DB.prepare(
    "SELECT status, updated_at FROM listing_promotion_requests WHERE id = ?",
  )
    .bind(promotionId)
    .first<Row>();
  if (
    !verified ||
    stringValue(verified.updated_at) !== timestamp ||
    stringValue(verified.status) !== status
  ) {
    return json(
      { error: { code: "stale_review", message: "Promotion request changed. Reload and retry." } },
      409,
      cors,
    );
  }
  await auditStatement(env, auth.userId, `promotion.${status}`, promotionId, {
    adminNote,
    startsAt,
    endsAt,
  }).run();
  return json({ data: { success: true } }, 200, cors);
}

async function accountCanManageListings(
  env: ListingOperationsEnv,
  userId: string,
): Promise<boolean> {
  const timestamp = now();
  const profile = await env.DB.prepare("SELECT account_status FROM public_profiles WHERE id = ?")
    .bind(userId)
    .first<{ account_status: string }>();
  if (!profile || profile.account_status !== "active") return false;
  const restriction = await env.DB.prepare(
    `SELECT id FROM user_restrictions
      WHERE user_id = ? AND restriction_type = 'posting' AND starts_at <= ?
        AND (ends_at IS NULL OR ends_at > ?) LIMIT 1`,
  )
    .bind(userId, timestamp, timestamp)
    .first();
  return !restriction;
}

function auditStatement(
  env: ListingOperationsEnv,
  actorId: string,
  action: string,
  entityId: string,
  metadata: Row,
): Statement {
  return env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
     VALUES (?, ?, ?, 'listing', ?, ?, ?)`,
  ).bind(crypto.randomUUID(), actorId, action, entityId, JSON.stringify(metadata), now());
}

function mapPromotion(row: Row): Row {
  return {
    id: stringValue(row.id),
    listingId: stringValue(row.listing_id),
    requesterUserId: stringValue(row.requester_user_id),
    promotionType: stringValue(row.promotion_type, "featured_home"),
    status: stringValue(row.status, "pending_review"),
    requestedDays: integer(row.requested_days, 7),
    startsAt: nullableString(row.starts_at),
    endsAt: nullableString(row.ends_at),
    paymentMethod: nullableString(row.payment_method),
    paymentReference: nullableString(row.payment_reference),
    proofPath: nullableString(row.proof_asset_id),
    adminNote: nullableString(row.admin_note),
    reviewedBy: nullableString(row.reviewed_by),
    reviewedAt: nullableString(row.reviewed_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    listingTitle: nullableString(row.listing_title),
  };
}

function mapPublicListing(row: Row, origin: string): Row {
  const assetId = nullableString(row.primary_media_asset_id);
  return {
    id: stringValue(row.id),
    ownerId: stringValue(row.owner_id),
    categoryId: stringValue(row.category_id),
    subcategoryId: nullableString(row.subcategory_id),
    categoryNameAr: nullableString(row.category_name_ar),
    categoryPlaceholder: nullableString(row.category_placeholder),
    governorateId: stringValue(row.governorate_id),
    governorateNameAr: nullableString(row.governorate_name_ar),
    locationNodeId: nullableString(row.location_node_id),
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
    isFeatured: booleanValue(row.is_featured),
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
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    primaryImageUrl: assetId ? `${origin}/v1/media/assets/${encodeURIComponent(assetId)}` : null,
  };
}

function canModerate(roles: string[]): boolean {
  return roles.some((role) => ["owner", "admin", "moderator"].includes(role));
}
function now(): string {
  return new Date().toISOString();
}
function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
function cleanOptional(value: unknown, max: number): string | null {
  return clean(value, max);
}
function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}
function nullableNumber(value: unknown): number | null {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? null : n;
}
function integer(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}
function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, integer(value, fallback)));
}
function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
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
function normalizeContentType(value: string): string {
  return value.split(";", 1)[0].trim().toLowerCase();
}
function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "application/pdf") return "pdf";
  return "jpg";
}
function matchesReceiptSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg")
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return (
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)
    );
  if (type === "image/webp")
    return (
      bytes.length >= 12 && textBytes(bytes, 0, 4) === "RIFF" && textBytes(bytes, 8, 12) === "WEBP"
    );
  if (type === "application/pdf") return bytes.length >= 5 && textBytes(bytes, 0, 5) === "%PDF-";
  return false;
}
function textBytes(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}
function unauthorized(cors: Headers): Response {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers): Response {
  return json({ error: { code: "permission_denied", message: "Permission denied." } }, 403, cors);
}
function notFound(cors: Headers): Response {
  return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
}
function validation(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function conflict(cors: Headers, message: string): Response {
  return json({ error: { code: "status_mismatch", message } }, 409, cors);
}
function databaseError(cors: Headers): Response {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
