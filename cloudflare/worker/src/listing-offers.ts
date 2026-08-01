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

export interface ListingOffersEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

interface ConversationContext {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  listing_status: string;
  archived_at: string | null;
  currency: string;
  listing_title: string;
}

interface OfferRow {
  id: string;
  listing_id: string;
  conversation_id: string;
  buyer_id: string;
  seller_id: string;
  created_by: string;
  parent_offer_id: string | null;
  amount: number;
  currency: string;
  status: string;
  expires_at: string;
  responded_at: string | null;
  client_request_id: string;
  last_action_request_id: string | null;
  created_at: string;
  updated_at: string;
}

const OFFER_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_AMOUNT = 9_007_199_254_740_991;
const ACTIONS = new Set(["accept", "reject", "counter", "withdraw"]);

export async function handleListingOffers(
  request: Request,
  env: ListingOffersEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!isListingOfferPath(path)) return null;
  const cors = corsHeaders(request, env as unknown as AuthEnv);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const conversationOffers = path.match(/^\/v1\/conversations\/([^/]+)\/offers$/);
  if (conversationOffers) {
    const conversationId = decodeURIComponent(conversationOffers[1]);
    if (request.method === "GET") return listOffers(request, env, cors, conversationId);
    if (request.method === "POST") return createOffer(request, env, cors, conversationId);
  }

  const offer = path.match(/^\/v1\/offers\/(?!price-drops$)([^/]+)$/);
  if (offer && request.method === "PATCH") {
    return transitionOffer(request, env, cors, decodeURIComponent(offer[1]));
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function isListingOfferPath(path: string): boolean {
  return (
    /^\/v1\/conversations\/[^/]+\/offers$/.test(path) ||
    /^\/v1\/offers\/(?!price-drops$)[^/]+$/.test(path)
  );
}

async function listOffers(
  request: Request,
  env: ListingOffersEnv,
  cors: Headers,
  conversationId: string,
) {
  const auth = await authenticate(request, env as unknown as AuthEnv);
  if (!auth) return unauthorized(cors);
  const conversation = await conversationContext(env, conversationId, auth.userId);
  if (!conversation) return notFound(cors);
  await expirePendingOffers(env, conversationId);
  const result = await env.DB.prepare(
    `SELECT id, listing_id, conversation_id, buyer_id, seller_id, created_by,
      parent_offer_id, amount, currency, status, expires_at, responded_at,
      client_request_id, last_action_request_id, created_at, updated_at
     FROM listing_price_offers
     WHERE conversation_id = ?
     ORDER BY created_at ASC, id ASC`,
  )
    .bind(conversationId)
    .all<OfferRow>();
  return result.success
    ? json(
        { data: { items: (result.results ?? []).map((row) => mapOffer(row, auth.userId)) } },
        200,
        cors,
      )
    : databaseError(cors);
}

async function createOffer(
  request: Request,
  env: ListingOffersEnv,
  cors: Headers,
  conversationId: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const amount = offerAmount(body.data.amount);
  const requestId = clean(body.data.requestId, 80);
  if (amount === null || !requestId || !isUuid(requestId)) {
    return validation(cors, "Invalid price offer.");
  }

  const existing = await offerByRequest(env, auth.userId, requestId);
  if (existing) return json({ data: mapOffer(existing, auth.userId) }, 200, cors);

  const conversation = await conversationContext(env, conversationId, auth.userId);
  if (!conversation) return notFound(cors);
  if (conversation.buyer_id !== auth.userId) {
    return forbidden(cors, "Only the buyer can create the first offer.");
  }
  const readiness = await mutationReadiness(env, conversation, auth.userId, true);
  if (readiness) return json({ error: readiness.error }, readiness.status, cors);
  await expirePendingOffers(env, conversationId);
  if (await pendingOffer(env, conversationId)) {
    return conflict(cors, "A price offer is already awaiting a response.");
  }

  const timestamp = now();
  const offer: OfferRow = {
    id: crypto.randomUUID(),
    listing_id: conversation.listing_id,
    conversation_id: conversation.id,
    buyer_id: conversation.buyer_id,
    seller_id: conversation.seller_id,
    created_by: auth.userId,
    parent_offer_id: null,
    amount,
    currency: normalizeCurrency(conversation.currency),
    status: "pending",
    expires_at: new Date(Date.now() + OFFER_TTL_MS).toISOString(),
    responded_at: null,
    client_request_id: requestId,
    last_action_request_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const results = await env.DB.batch([
    insertOfferStatement(env, offer),
    touchConversationStatement(env, conversation.id, timestamp),
    notificationStatement(env, {
      userId: conversation.seller_id,
      type: "offer.received",
      title: "وصل عرض سعر جديد",
      body: `لديك عرض جديد على ${conversation.listing_title}.`,
      offer,
      timestamp,
    }),
  ]);
  return results.every((result) => result.success)
    ? json({ data: mapOffer(offer, auth.userId) }, 201, cors)
    : databaseError(cors);
}

async function transitionOffer(
  request: Request,
  env: ListingOffersEnv,
  cors: Headers,
  offerId: string,
) {
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const action = clean(body.data.action, 20);
  const requestId = clean(body.data.requestId, 80);
  const expectedUpdatedAt = clean(body.data.expectedUpdatedAt, 80);
  if (!ACTIONS.has(action) || !requestId || !isUuid(requestId) || !expectedUpdatedAt) {
    return validation(cors, "Invalid price-offer transition.");
  }

  if (action === "counter") {
    const replay = await offerByRequest(env, auth.userId, requestId);
    if (replay) return json({ data: mapOffer(replay, auth.userId) }, 200, cors);
  }

  await expireOffer(env, offerId);
  const current = await offerById(env, offerId);
  if (!current) return notFound(cors);
  if (current.buyer_id !== auth.userId && current.seller_id !== auth.userId) return notFound(cors);
  if (current.last_action_request_id === requestId) {
    return json({ data: mapOffer(current, auth.userId) }, 200, cors);
  }
  if (current.status !== "pending") return conflict(cors, "This offer is no longer pending.");
  if (current.updated_at !== expectedUpdatedAt) {
    return json(
      { error: { code: "stale_write", message: "The offer changed. Refresh and try again." } },
      409,
      cors,
    );
  }

  const conversation = await conversationContext(env, current.conversation_id, auth.userId);
  if (!conversation) return notFound(cors);
  const readiness = await mutationReadiness(
    env,
    conversation,
    auth.userId,
    action === "accept" || action === "counter",
  );
  if (readiness) return json({ error: readiness.error }, readiness.status, cors);

  const isCreator = current.created_by === auth.userId;
  if (action === "withdraw" && !isCreator) {
    return forbidden(cors, "Only the sender can withdraw this offer.");
  }
  if (action !== "withdraw" && isCreator) {
    return forbidden(cors, "Only the recipient can respond to this offer.");
  }

  if (action === "counter") {
    const amount = offerAmount(body.data.amount);
    if (amount === null) return validation(cors, "Invalid counter offer amount.");
    return createCounterOffer(env, cors, current, conversation, auth.userId, amount, requestId);
  }

  const nextStatus =
    action === "accept" ? "accepted" : action === "reject" ? "rejected" : "withdrawn";
  const timestamp = now();
  const recipient = auth.userId === current.buyer_id ? current.seller_id : current.buyer_id;
  const nextOffer = {
    ...current,
    status: nextStatus,
    responded_at: timestamp,
    last_action_request_id: requestId,
    updated_at: timestamp,
  };
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE listing_price_offers
       SET status = ?, responded_at = ?, last_action_request_id = ?, updated_at = ?
       WHERE id = ? AND status = 'pending' AND updated_at = ?`,
    ).bind(nextStatus, timestamp, requestId, timestamp, current.id, expectedUpdatedAt),
    touchConversationStatement(env, conversation.id, timestamp),
    notificationStatement(env, {
      userId: recipient,
      type: `offer.${nextStatus}`,
      title: transitionTitle(nextStatus),
      body: transitionBody(nextStatus, conversation.listing_title),
      offer: nextOffer,
      timestamp,
    }),
  ]);
  if (results.some((result) => !result.success)) return databaseError(cors);
  const updated = await offerById(env, current.id);
  return updated ? json({ data: mapOffer(updated, auth.userId) }, 200, cors) : databaseError(cors);
}

async function createCounterOffer(
  env: ListingOffersEnv,
  cors: Headers,
  current: OfferRow,
  conversation: ConversationContext,
  actorId: string,
  amount: number,
  requestId: string,
) {
  const timestamp = now();
  const counter: OfferRow = {
    id: crypto.randomUUID(),
    listing_id: current.listing_id,
    conversation_id: current.conversation_id,
    buyer_id: current.buyer_id,
    seller_id: current.seller_id,
    created_by: actorId,
    parent_offer_id: current.id,
    amount,
    currency: current.currency,
    status: "pending",
    expires_at: new Date(Date.now() + OFFER_TTL_MS).toISOString(),
    responded_at: null,
    client_request_id: requestId,
    last_action_request_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const recipient = actorId === current.buyer_id ? current.seller_id : current.buyer_id;
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE listing_price_offers
       SET status = 'countered', responded_at = ?, last_action_request_id = ?, updated_at = ?
       WHERE id = ? AND status = 'pending' AND updated_at = ?`,
    ).bind(timestamp, requestId, timestamp, current.id, current.updated_at),
    insertOfferStatement(env, counter),
    touchConversationStatement(env, conversation.id, timestamp),
    notificationStatement(env, {
      userId: recipient,
      type: "offer.countered",
      title: "وصل عرض مضاد",
      body: `لديك عرض مضاد على ${conversation.listing_title}.`,
      offer: counter,
      timestamp,
    }),
  ]);
  if (results.some((result) => !result.success)) return databaseError(cors);
  return json({ data: mapOffer(counter, actorId) }, 201, cors);
}

async function mutationReadiness(
  env: ListingOffersEnv,
  conversation: ConversationContext,
  actorId: string,
  requireAvailableListing: boolean,
): Promise<{ status: number; error: { code: string; message: string } } | null> {
  if (conversation.status !== "active") {
    return {
      status: 409,
      error: { code: "invalid_transition", message: "Conversation is not active." },
    };
  }
  const other = actorId === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id;
  if (await usersBlocked(env, actorId, other)) {
    return {
      status: 403,
      error: { code: "permission_denied", message: "Offers are blocked for this conversation." },
    };
  }
  if (
    requireAvailableListing &&
    (conversation.listing_status !== "approved" || conversation.archived_at)
  ) {
    return {
      status: 409,
      error: { code: "status_mismatch", message: "Listing is not available for offers." },
    };
  }
  return null;
}

async function conversationContext(
  env: ListingOffersEnv,
  conversationId: string,
  userId: string,
) {
  return env.DB.prepare(
    `SELECT c.id, c.listing_id, c.buyer_id, c.seller_id, c.status,
      l.status AS listing_status, l.archived_at, l.currency, l.title AS listing_title
     FROM conversations c
     JOIN listings l ON l.id = c.listing_id
     WHERE c.id = ? AND (c.buyer_id = ? OR c.seller_id = ?)`,
  )
    .bind(conversationId, userId, userId)
    .first<ConversationContext>();
}

async function usersBlocked(env: ListingOffersEnv, first: string, second: string) {
  const row = await env.DB.prepare(
    `SELECT 1 AS blocked FROM user_blocks
     WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
  )
    .bind(first, second, second, first)
    .first();
  return Boolean(row);
}

async function pendingOffer(env: ListingOffersEnv, conversationId: string) {
  return env.DB.prepare(
    "SELECT id FROM listing_price_offers WHERE conversation_id = ? AND status = 'pending' LIMIT 1",
  )
    .bind(conversationId)
    .first();
}

async function expirePendingOffers(env: ListingOffersEnv, conversationId: string) {
  const timestamp = now();
  return env.DB.prepare(
    `UPDATE listing_price_offers
     SET status = 'expired', responded_at = COALESCE(responded_at, ?), updated_at = ?
     WHERE conversation_id = ? AND status = 'pending' AND expires_at <= ?`,
  )
    .bind(timestamp, timestamp, conversationId, timestamp)
    .run();
}

async function expireOffer(env: ListingOffersEnv, offerId: string) {
  const timestamp = now();
  return env.DB.prepare(
    `UPDATE listing_price_offers
     SET status = 'expired', responded_at = COALESCE(responded_at, ?), updated_at = ?
     WHERE id = ? AND status = 'pending' AND expires_at <= ?`,
  )
    .bind(timestamp, timestamp, offerId, timestamp)
    .run();
}

async function offerById(env: ListingOffersEnv, id: string) {
  return env.DB.prepare(
    `SELECT id, listing_id, conversation_id, buyer_id, seller_id, created_by,
      parent_offer_id, amount, currency, status, expires_at, responded_at,
      client_request_id, last_action_request_id, created_at, updated_at
     FROM listing_price_offers WHERE id = ?`,
  )
    .bind(id)
    .first<OfferRow>();
}

async function offerByRequest(env: ListingOffersEnv, userId: string, requestId: string) {
  return env.DB.prepare(
    `SELECT id, listing_id, conversation_id, buyer_id, seller_id, created_by,
      parent_offer_id, amount, currency, status, expires_at, responded_at,
      client_request_id, last_action_request_id, created_at, updated_at
     FROM listing_price_offers WHERE created_by = ? AND client_request_id = ?`,
  )
    .bind(userId, requestId)
    .first<OfferRow>();
}

function insertOfferStatement(env: ListingOffersEnv, offer: OfferRow) {
  return env.DB.prepare(
    `INSERT INTO listing_price_offers
     (id, listing_id, conversation_id, buyer_id, seller_id, created_by,
      parent_offer_id, amount, currency, status, expires_at, responded_at,
      client_request_id, last_action_request_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    offer.id,
    offer.listing_id,
    offer.conversation_id,
    offer.buyer_id,
    offer.seller_id,
    offer.created_by,
    offer.parent_offer_id,
    offer.amount,
    offer.currency,
    offer.status,
    offer.expires_at,
    offer.responded_at,
    offer.client_request_id,
    offer.last_action_request_id,
    offer.created_at,
    offer.updated_at,
  );
}

function touchConversationStatement(
  env: ListingOffersEnv,
  conversationId: string,
  timestamp: string,
) {
  return env.DB.prepare(
    "UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?",
  ).bind(timestamp, timestamp, conversationId);
}

function notificationStatement(
  env: ListingOffersEnv,
  input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    offer: OfferRow;
    timestamp: string;
  },
) {
  return env.DB.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    input.userId,
    input.type,
    input.title,
    input.body,
    JSON.stringify({
      targetType: "conversation",
      targetId: input.offer.conversation_id,
      conversationId: input.offer.conversation_id,
      listingId: input.offer.listing_id,
      offerId: input.offer.id,
      amount: input.offer.amount,
      currency: input.offer.currency,
      status: input.offer.status,
    }),
    input.timestamp,
  );
}

function mapOffer(row: OfferRow, userId: string) {
  return {
    id: row.id,
    listingId: row.listing_id,
    conversationId: row.conversation_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    createdBy: row.created_by,
    createdByMe: row.created_by === userId,
    parentOfferId: row.parent_offer_id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function offerAmount(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= MAX_AMOUNT ? number : null;
}

function normalizeCurrency(value: unknown): string {
  const currency = clean(value, 8).toUpperCase();
  return /^[A-Z]{3,8}$/.test(currency) ? currency : "SYP";
}

function clean(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function now(): string {
  return new Date().toISOString();
}

function transitionTitle(status: string): string {
  if (status === "accepted") return "تم قبول عرض السعر";
  if (status === "rejected") return "تم رفض عرض السعر";
  return "تم سحب عرض السعر";
}

function transitionBody(status: string, listingTitle: string): string {
  if (status === "accepted") return `تم قبول العرض على ${listingTitle}.`;
  if (status === "rejected") return `تم رفض العرض على ${listingTitle}.`;
  return `تم سحب العرض على ${listingTitle}.`;
}

function unauthorized(cors: Headers) {
  return json(
    { error: { code: "auth_required", message: "Authentication required." } },
    401,
    cors,
  );
}

function forbidden(cors: Headers, message: string) {
  return json({ error: { code: "permission_denied", message } }, 403, cors);
}

function notFound(cors: Headers) {
  return json({ error: { code: "not_found", message: "Resource not found." } }, 404, cors);
}

function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}

function conflict(cors: Headers, message: string) {
  return json({ error: { code: "status_mismatch", message } }, 409, cors);
}

function databaseError(cors: Headers) {
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
