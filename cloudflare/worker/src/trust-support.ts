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

export interface TrustSupportEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_AUTH_TEST_JWKS?: string;
  SUPABASE_JWKS_URL?: string;
}

const SUPPORT_TYPES = new Set([
  "complaint",
  "suggestion",
  "technical_issue",
  "abuse_report",
  "other",
]);
const LISTING_REPORT_TYPES = new Set([
  "suspicious_listing",
  "fraud",
  "prohibited_content",
  "abusive_user",
  "misleading_price",
  "wrong_info",
  "other",
]);
const REVIEW_TRAITS = new Set([
  "accurate_description",
  "good_communication",
  "fast_response",
  "fair_deal",
  "punctual",
  "trustworthy",
]);
const REVIEW_REPORT_REASONS = new Set([
  "abuse",
  "spam",
  "misleading",
  "personal_data",
  "prohibited_content",
  "other",
]);
const REVIEW_REPORT_STATUSES = new Set(["new", "under_review", "resolved", "rejected"]);

function asAuthEnv(env: TrustSupportEnv): AuthEnv {
  return env as unknown as AuthEnv;
}

export async function handleTrustSupport(
  request: Request,
  env: TrustSupportEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  const cors = corsHeaders(request, asAuthEnv(env));
  if (!relevant(path)) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/account/support-requests") {
    if (request.method === "GET") return listOwnSupportRequests(request, env, cors, url);
    if (request.method === "POST") return createSupportRequest(request, env, cors);
  }
  const ownSupport = path.match(/^\/v1\/account\/support-requests\/([^/]+)$/);
  if (ownSupport && request.method === "GET") {
    return getOwnSupportRequest(request, env, cors, decodeURIComponent(ownSupport[1]));
  }

  const listingReport = path.match(/^\/v1\/listings\/([^/]+)\/reports$/);
  if (listingReport && request.method === "POST") {
    return createListingReport(request, env, cors, decodeURIComponent(listingReport[1]));
  }
  if (path === "/v1/admin/listing-reports" && request.method === "GET") {
    return listListingReports(request, env, cors, url);
  }
  const moderateListingReport = path.match(/^\/v1\/admin\/listing-reports\/([^/]+)$/);
  if (moderateListingReport && request.method === "PATCH") {
    return moderateListingReportRequest(
      request,
      env,
      cors,
      decodeURIComponent(moderateListingReport[1]),
    );
  }

  const eligibility = path.match(/^\/v1\/sellers\/([^/]+)\/review-eligibility$/);
  if (eligibility && request.method === "GET") {
    return reviewEligibility(request, env, cors, decodeURIComponent(eligibility[1]), url);
  }
  const sellerReviews = path.match(/^\/v1\/sellers\/([^/]+)\/reviews$/);
  if (sellerReviews && request.method === "POST") {
    return createSellerReview(request, env, cors, decodeURIComponent(sellerReviews[1]));
  }
  const reviewResponse = path.match(/^\/v1\/reviews\/([^/]+)\/response$/);
  if (reviewResponse && request.method === "PATCH") {
    return setReviewResponse(request, env, cors, decodeURIComponent(reviewResponse[1]));
  }
  const reviewReport = path.match(/^\/v1\/reviews\/([^/]+)\/reports$/);
  if (reviewReport && request.method === "POST") {
    return createReviewReport(request, env, cors, decodeURIComponent(reviewReport[1]));
  }
  if (path === "/v1/admin/seller-reviews" && request.method === "GET") {
    return listSellerReviews(request, env, cors, url);
  }
  const moderateReview = path.match(/^\/v1\/admin\/seller-reviews\/([^/]+)$/);
  if (moderateReview && request.method === "PATCH") {
    return moderateSellerReview(request, env, cors, decodeURIComponent(moderateReview[1]));
  }
  if (path === "/v1/admin/seller-review-reports" && request.method === "GET") {
    return listReviewReports(request, env, cors, url);
  }
  const moderateReviewReport = path.match(/^\/v1\/admin\/seller-review-reports\/([^/]+)$/);
  if (moderateReviewReport && request.method === "PATCH") {
    return moderateSellerReviewReport(
      request,
      env,
      cors,
      decodeURIComponent(moderateReviewReport[1]),
    );
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function relevant(path: string): boolean {
  return (
    /^\/v1\/account\/support-requests(?:\/|$)/.test(path) ||
    /^\/v1\/listings\/[^/]+\/reports$/.test(path) ||
    /^\/v1\/sellers\/[^/]+\/(?:review-eligibility|reviews)$/.test(path) ||
    /^\/v1\/reviews\/[^/]+\/(?:response|reports)$/.test(path) ||
    /^\/v1\/admin\/(?:listing-reports|seller-reviews|seller-review-reports)(?:\/|$)/.test(path)
  );
}

async function createSupportRequest(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const type = text(body.data.type, 40);
  const subject = text(body.data.subject, 160);
  const message = text(body.data.message, 3000);
  const relatedListingId = optionalText(body.data.relatedListingId, 120);
  const relatedReportId = optionalText(body.data.relatedReportId, 120);
  if (!SUPPORT_TYPES.has(type) || subject.length < 4 || message.length < 10) {
    return validation(cors, "Invalid support request.");
  }
  if (relatedListingId) {
    const listing = await env.DB.prepare(
      `SELECT id FROM listings
        WHERE id = ? AND (owner_id = ? OR status = 'approved') AND archived_at IS NULL`,
    )
      .bind(relatedListingId, auth.userId)
      .first();
    if (!listing) return validation(cors, "Related listing is unavailable.");
  }
  if (relatedReportId) {
    const report = await env.DB.prepare(
      "SELECT id FROM listing_reports WHERE id = ? AND reporter_id = ?",
    )
      .bind(relatedReportId, auth.userId)
      .first();
    if (!report) return validation(cors, "Related report is unavailable.");
  }

  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO support_requests
      (id, user_id, email, type, subject, message, status, priority,
       related_listing_id, related_report_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', 'normal', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      auth.userId,
      auth.email,
      type,
      subject,
      message,
      relatedListingId,
      relatedReportId,
      timestamp,
      timestamp,
    )
    .run();
  if (!result.success) return databaseError(cors);
  const row = await readSupportRow(env, id, auth.userId);
  return row ? json({ data: mapSupport(row) }, 201, cors) : databaseError(cors);
}

async function listOwnSupportRequests(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  url: URL,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const limit = integer(url.searchParams.get("limit"), 50, 1, 100);
  const result = await env.DB.prepare(
    `${supportSelect()} WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
  )
    .bind(auth.userId, limit)
    .all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapSupport) }, 200, cors)
    : databaseError(cors);
}

async function getOwnSupportRequest(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  requestId: string,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  const id = text(requestId, 120);
  if (!id) return validation(cors, "Invalid support request id.");
  const row = await readSupportRow(env, id, auth.userId);
  return row ? json({ data: mapSupport(row) }, 200, cors) : notFound(cors);
}

function supportSelect(): string {
  return `SELECT id, user_id, type, status, subject, message, related_listing_id,
    related_report_id, public_response, created_at, updated_at FROM support_requests`;
}

async function readSupportRow(
  env: TrustSupportEnv,
  id: string,
  userId: string,
): Promise<Row | null> {
  return env.DB.prepare(`${supportSelect()} WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<Row>();
}

async function createListingReport(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  rawListingId: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const listingId = text(rawListingId, 120);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reportType = text(body.data.reportType, 50);
  const reason = text(body.data.reason, 500);
  if (!listingId || !LISTING_REPORT_TYPES.has(reportType) || reason.length < 4) {
    return validation(cors, "Invalid listing report.");
  }
  const listing = await env.DB.prepare(
    `SELECT id, owner_id, title FROM listings
      WHERE id = ? AND status = 'approved' AND archived_at IS NULL`,
  )
    .bind(listingId)
    .first<{ id: string; owner_id: string; title: string }>();
  if (!listing) return notFound(cors);
  if (listing.owner_id === auth.userId) return forbidden(cors);

  const existing = await env.DB.prepare(
    `SELECT id FROM listing_reports
      WHERE listing_id = ? AND reporter_id = ? AND report_type = ?
        AND status IN ('open', 'reviewing')
      ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(listingId, auth.userId, reportType)
    .first<{ id: string }>();
  if (existing) return json({ data: { id: existing.id, duplicate: true } }, 200, cors);

  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO listing_reports
      (id, listing_id, reporter_id, report_type, reason, details, status,
       listing_title_snapshot, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
  )
    .bind(
      id,
      listingId,
      auth.userId,
      reportType,
      reason,
      reason,
      listing.title,
      timestamp,
      timestamp,
    )
    .run();
  return result.success ? json({ data: { id, duplicate: false } }, 201, cors) : databaseError(cors);
}

async function listListingReports(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  url: URL,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canModerate(auth.roles)) return forbidden(cors);
  const limit = integer(url.searchParams.get("limit"), 200, 1, 200);
  const result = await env.DB.prepare(
    `SELECT id, listing_id, listing_title_snapshot, reporter_id, report_type, reason,
      status, assigned_to, admin_note, resolved_at, created_at, updated_at
     FROM listing_reports ORDER BY created_at DESC, id DESC LIMIT ?`,
  )
    .bind(limit)
    .all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapListingReport) }, 200, cors)
    : databaseError(cors);
}

async function moderateListingReportRequest(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  reportIdRaw: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!canModerate(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reportId = text(reportIdRaw, 120);
  const status = text(body.data.status, 30);
  const expectedUpdatedAt = text(body.data.expectedUpdatedAt, 80);
  const adminNote = optionalText(body.data.adminNote, 1000);
  const dbStatus = listingReportStatusToDb(status);
  if (!reportId || !dbStatus || !expectedUpdatedAt)
    return validation(cors, "Invalid report update.");
  const timestamp = now();
  const resolvedAt = dbStatus === "resolved" || dbStatus === "dismissed" ? timestamp : null;
  const result = await env.DB.prepare(
    `UPDATE listing_reports SET status = ?, assigned_to = ?, admin_note = ?, resolved_by = ?,
      resolved_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
  )
    .bind(
      dbStatus,
      auth.userId,
      adminNote,
      resolvedAt ? auth.userId : null,
      resolvedAt,
      timestamp,
      reportId,
      expectedUpdatedAt,
    )
    .run();
  if (!result.success) return databaseError(cors);
  if (changedRows(result) !== 1) {
    const exists = await env.DB.prepare("SELECT id FROM listing_reports WHERE id = ?")
      .bind(reportId)
      .first();
    return exists ? stale(cors) : notFound(cors);
  }
  await insertAudit(env, auth.userId, "listing_report.moderated", "listing_report", reportId, {
    status,
  });
  return json({ data: { success: true, updatedAt: timestamp } }, 200, cors);
}

async function reviewEligibility(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  sellerIdRaw: string,
  url: URL,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) {
    return json(
      {
        data: {
          eligible: false,
          relatedListingId: null,
          conversationId: null,
          reason: "auth_required",
        },
      },
      200,
      cors,
    );
  }
  const sellerId = text(sellerIdRaw, 120);
  const listingId = optionalText(url.searchParams.get("listingId"), 120);
  const eligibility = await resolveReviewEligibility(env, auth.userId, sellerId, listingId);
  return json({ data: eligibility }, 200, cors);
}

async function resolveReviewEligibility(
  env: TrustSupportEnv,
  reviewerId: string,
  sellerId: string,
  listingId: string | null,
): Promise<{
  eligible: boolean;
  relatedListingId: string | null;
  conversationId: string | null;
  reason: string;
}> {
  if (!sellerId || sellerId === reviewerId) {
    return {
      eligible: false,
      relatedListingId: null,
      conversationId: null,
      reason: "invalid_seller",
    };
  }
  const seller = await env.DB.prepare(
    "SELECT id FROM public_profiles WHERE id = ? AND account_status = 'active'",
  )
    .bind(sellerId)
    .first();
  if (!seller) {
    return {
      eligible: false,
      relatedListingId: null,
      conversationId: null,
      reason: "invalid_seller",
    };
  }
  if (listingId) {
    const ownedListing = await env.DB.prepare(
      "SELECT id FROM listings WHERE id = ? AND owner_id = ?",
    )
      .bind(listingId, sellerId)
      .first();
    if (!ownedListing) {
      return {
        eligible: false,
        relatedListingId: null,
        conversationId: null,
        reason: "invalid_seller",
      };
    }
  }
  const existing = await env.DB.prepare(
    `SELECT id FROM seller_reviews
      WHERE seller_id = ? AND reviewer_id = ? AND status IN ('pending', 'approved')
      ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(sellerId, reviewerId)
    .first();
  if (existing) {
    return {
      eligible: false,
      relatedListingId: null,
      conversationId: null,
      reason: "existing_review",
    };
  }
  const conversation = await env.DB.prepare(
    `SELECT c.id, c.listing_id FROM conversations c
      WHERE c.buyer_id = ? AND c.seller_id = ?
        AND (? IS NULL OR c.listing_id = ?)
        AND EXISTS (
          SELECT 1 FROM conversation_messages buyer_message
           WHERE buyer_message.conversation_id = c.id
             AND buyer_message.sender_id = ? AND buyer_message.deleted_at IS NULL
        )
        AND EXISTS (
          SELECT 1 FROM conversation_messages seller_message
           WHERE seller_message.conversation_id = c.id
             AND seller_message.sender_id = ? AND seller_message.deleted_at IS NULL
        )
      ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC LIMIT 1`,
  )
    .bind(reviewerId, sellerId, listingId, listingId, reviewerId, sellerId)
    .first<{ id: string; listing_id: string | null }>();
  if (!conversation) {
    return {
      eligible: false,
      relatedListingId: null,
      conversationId: null,
      reason: "no_qualifying_interaction",
    };
  }
  return {
    eligible: true,
    relatedListingId: conversation.listing_id,
    conversationId: conversation.id,
    reason: "eligible",
  };
}

async function createSellerReview(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  sellerIdRaw: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const sellerId = text(sellerIdRaw, 120);
  const relatedListingId = optionalText(body.data.relatedListingId, 120);
  const rating = integerValue(body.data.rating);
  const comment = optionalText(body.data.comment, 1200);
  const traits = stringArray(body.data.traits, 3, 60);
  if (
    !sellerId ||
    rating === null ||
    rating < 1 ||
    rating > 5 ||
    (comment !== null && comment.length < 10) ||
    traits === null ||
    !traits.every((trait) => REVIEW_TRAITS.has(trait))
  ) {
    return validation(cors, "Invalid seller review.");
  }
  const eligibility = await resolveReviewEligibility(env, auth.userId, sellerId, relatedListingId);
  if (!eligibility.eligible) {
    const code = eligibility.reason === "existing_review" ? "status_mismatch" : "permission_denied";
    return json({ error: { code, message: "Seller review is not permitted." } }, 409, cors);
  }
  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO seller_reviews
      (id, seller_id, reviewer_id, listing_id, rating, comment, traits, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      id,
      sellerId,
      auth.userId,
      eligibility.relatedListingId,
      rating,
      comment,
      JSON.stringify(traits),
      timestamp,
      timestamp,
    )
    .run();
  if (!result.success) return databaseError(cors);
  const row = await readReview(env, id);
  return row ? json({ data: mapReview(row) }, 201, cors) : databaseError(cors);
}

async function setReviewResponse(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  reviewIdRaw: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reviewId = text(reviewIdRaw, 120);
  const response = optionalText(body.data.response, 800);
  if (!reviewId || (response !== null && response.length < 3)) {
    return validation(cors, "Invalid seller response.");
  }
  const review = await env.DB.prepare(
    "SELECT id, seller_id, status FROM seller_reviews WHERE id = ?",
  )
    .bind(reviewId)
    .first<{ id: string; seller_id: string; status: string }>();
  if (!review) return notFound(cors);
  if (review.seller_id !== auth.userId) return forbidden(cors);
  if (review.status !== "approved") {
    return json(
      { error: { code: "status_mismatch", message: "Only approved reviews can be answered." } },
      409,
      cors,
    );
  }
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE seller_reviews SET seller_response = ?, seller_response_updated_at = ?, updated_at = ?
      WHERE id = ? AND seller_id = ? AND status = 'approved'`,
  )
    .bind(response, timestamp, timestamp, reviewId, auth.userId)
    .run();
  if (!result.success) return databaseError(cors);
  const row = await readReview(env, reviewId);
  return row ? json({ data: mapReview(row) }, 200, cors) : databaseError(cors);
}

async function listSellerReviews(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  url: URL,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canModerate(auth.roles)) return forbidden(cors);
  const limit = integer(url.searchParams.get("limit"), 100, 1, 200);
  const result = await env.DB.prepare(
    `${reviewSelect()} WHERE status = 'pending' ORDER BY created_at ASC, id ASC LIMIT ?`,
  )
    .bind(limit)
    .all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapReview) }, 200, cors)
    : databaseError(cors);
}

async function moderateSellerReview(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  reviewIdRaw: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!canModerate(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reviewId = text(reviewIdRaw, 120);
  const status = text(body.data.status, 30);
  const expectedUpdatedAt = text(body.data.expectedUpdatedAt, 80);
  const adminNote = optionalText(body.data.adminNote, 1000);
  const dbStatus = status === "approved" ? "approved" : status === "rejected" ? "rejected" : null;
  if (!reviewId || !dbStatus || !expectedUpdatedAt)
    return validation(cors, "Invalid review update.");
  const timestamp = now();
  const result = await env.DB.prepare(
    `UPDATE seller_reviews SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending' AND updated_at = ?`,
  )
    .bind(dbStatus, adminNote, auth.userId, timestamp, timestamp, reviewId, expectedUpdatedAt)
    .run();
  if (!result.success) return databaseError(cors);
  if (changedRows(result) !== 1) {
    const exists = await env.DB.prepare("SELECT id FROM seller_reviews WHERE id = ?")
      .bind(reviewId)
      .first();
    return exists ? stale(cors) : notFound(cors);
  }
  await insertAudit(env, auth.userId, "seller_review.moderated", "seller_review", reviewId, {
    status,
  });
  return json({ data: { success: true, updatedAt: timestamp } }, 200, cors);
}

async function createReviewReport(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  reviewIdRaw: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reviewId = text(reviewIdRaw, 120);
  const reason = text(body.data.reason, 40);
  const details = optionalText(body.data.details, 1000);
  if (!reviewId || !REVIEW_REPORT_REASONS.has(reason)) {
    return validation(cors, "Invalid review report.");
  }
  const review = await env.DB.prepare(
    "SELECT id, reviewer_id, status FROM seller_reviews WHERE id = ?",
  )
    .bind(reviewId)
    .first<{ id: string; reviewer_id: string; status: string }>();
  if (!review || review.status !== "approved") return notFound(cors);
  if (review.reviewer_id === auth.userId) return forbidden(cors);
  const existing = await env.DB.prepare(
    `SELECT id, review_id, reporter_user_id, reported_reviewer_user_id, reason, details,
      status, admin_note, created_at, updated_at FROM seller_review_reports
     WHERE review_id = ? AND reporter_user_id = ? AND status IN ('new', 'under_review')
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(reviewId, auth.userId)
    .first<Row>();
  if (existing) return json({ data: mapReviewReport(existing) }, 200, cors);
  const id = crypto.randomUUID();
  const timestamp = now();
  const result = await env.DB.prepare(
    `INSERT INTO seller_review_reports
      (id, review_id, reporter_user_id, reported_reviewer_user_id, reason, details,
       status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
  )
    .bind(id, reviewId, auth.userId, review.reviewer_id, reason, details, timestamp, timestamp)
    .run();
  if (!result.success) return databaseError(cors);
  const row = await readReviewReport(env, id);
  return row ? json({ data: mapReviewReport(row) }, 201, cors) : databaseError(cors);
}

async function listReviewReports(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  url: URL,
): Promise<Response> {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);
  if (!canModerate(auth.roles)) return forbidden(cors);
  const limit = integer(url.searchParams.get("limit"), 200, 1, 200);
  const result = await env.DB.prepare(
    `${reviewReportSelect()} ORDER BY created_at DESC, id DESC LIMIT ?`,
  )
    .bind(limit)
    .all<Row>();
  return result.success
    ? json({ data: (result.results ?? []).map(mapReviewReport) }, 200, cors)
    : databaseError(cors);
}

async function moderateSellerReviewReport(
  request: Request,
  env: TrustSupportEnv,
  cors: Headers,
  reportIdRaw: string,
): Promise<Response> {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  if (!canModerate(auth.roles)) return forbidden(cors);
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const reportId = text(reportIdRaw, 120);
  const status = text(body.data.status, 30);
  const expectedUpdatedAt = text(body.data.expectedUpdatedAt, 80);
  const adminNote = optionalText(body.data.adminNote, 1000);
  if (!reportId || !REVIEW_REPORT_STATUSES.has(status) || !expectedUpdatedAt) {
    return validation(cors, "Invalid review report update.");
  }
  const timestamp = now();
  const reviewedAt = status === "resolved" || status === "rejected" ? timestamp : null;
  const result = await env.DB.prepare(
    `UPDATE seller_review_reports SET status = ?, admin_note = ?, reviewed_by = ?,
      reviewed_at = ?, updated_at = ? WHERE id = ? AND updated_at = ?`,
  )
    .bind(status, adminNote, auth.userId, reviewedAt, timestamp, reportId, expectedUpdatedAt)
    .run();
  if (!result.success) return databaseError(cors);
  if (changedRows(result) !== 1) {
    const exists = await env.DB.prepare("SELECT id FROM seller_review_reports WHERE id = ?")
      .bind(reportId)
      .first();
    return exists ? stale(cors) : notFound(cors);
  }
  await insertAudit(
    env,
    auth.userId,
    "seller_review_report.moderated",
    "seller_review_report",
    reportId,
    { status },
  );
  return json({ data: { success: true, updatedAt: timestamp } }, 200, cors);
}

function reviewSelect(): string {
  return `SELECT id, seller_id, reviewer_id, listing_id, rating, comment, traits, status,
    admin_note, reviewed_by, reviewed_at, seller_response, seller_response_updated_at,
    created_at, updated_at FROM seller_reviews`;
}

async function readReview(env: TrustSupportEnv, id: string): Promise<Row | null> {
  return env.DB.prepare(`${reviewSelect()} WHERE id = ?`).bind(id).first<Row>();
}

function reviewReportSelect(): string {
  return `SELECT id, review_id, reporter_user_id, reported_reviewer_user_id, reason,
    details, status, admin_note, created_at, updated_at FROM seller_review_reports`;
}

async function readReviewReport(env: TrustSupportEnv, id: string): Promise<Row | null> {
  return env.DB.prepare(`${reviewReportSelect()} WHERE id = ?`).bind(id).first<Row>();
}

function mapSupport(row: Row) {
  return {
    id: stringValue(row.id),
    userId: stringValue(row.user_id),
    type: stringValue(row.type, "other"),
    status: supportStatusFromDb(stringValue(row.status, "open")),
    subject: stringValue(row.subject),
    message: stringValue(row.message),
    relatedListingId: nullableString(row.related_listing_id),
    relatedReportId: nullableString(row.related_report_id),
    publicResponse: nullableString(row.public_response),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapListingReport(row: Row) {
  return {
    id: stringValue(row.id),
    listingId: nullableString(row.listing_id),
    listingTitleSnapshot: nullableString(row.listing_title_snapshot),
    reporterId: stringValue(row.reporter_id),
    reportType: stringValue(row.report_type, "other"),
    reason: stringValue(row.reason),
    status: listingReportStatusFromDb(stringValue(row.status, "open")),
    assignedTo: nullableString(row.assigned_to),
    adminNote: nullableString(row.admin_note),
    resolvedAt: nullableString(row.resolved_at),
    createdAt: stringValue(row.created_at),
    updatedAt: nullableString(row.updated_at) ?? stringValue(row.created_at),
  };
}

function mapReview(row: Row) {
  return {
    id: stringValue(row.id),
    sellerUserId: stringValue(row.seller_id),
    reviewerUserId: stringValue(row.reviewer_id),
    relatedListingId: nullableString(row.listing_id),
    rating: numberValue(row.rating),
    comment: nullableString(row.comment),
    traits: jsonStringArray(row.traits).filter((trait) => REVIEW_TRAITS.has(trait)),
    status: reviewStatusFromDb(stringValue(row.status, "pending")),
    adminNote: nullableString(row.admin_note),
    reviewedBy: nullableString(row.reviewed_by),
    reviewedAt: nullableString(row.reviewed_at),
    sellerResponse: nullableString(row.seller_response),
    sellerResponseUpdatedAt: nullableString(row.seller_response_updated_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapReviewReport(row: Row) {
  return {
    id: stringValue(row.id),
    reviewId: nullableString(row.review_id),
    reporterUserId: stringValue(row.reporter_user_id),
    reportedReviewerUserId: stringValue(row.reported_reviewer_user_id),
    reason: stringValue(row.reason, "other"),
    details: nullableString(row.details),
    status: stringValue(row.status, "new"),
    adminNote: nullableString(row.admin_note),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
  };
}

function supportStatusFromDb(status: string): string {
  if (status === "in_progress") return "under_review";
  if (status === "resolved") return "resolved";
  if (status === "closed") return "rejected";
  return "new";
}

function listingReportStatusFromDb(status: string): string {
  if (status === "reviewing") return "under_review";
  if (status === "resolved") return "resolved";
  if (status === "dismissed") return "rejected";
  return "new";
}

function listingReportStatusToDb(status: string): string | null {
  if (status === "new") return "open";
  if (status === "under_review") return "reviewing";
  if (status === "resolved") return "resolved";
  if (status === "rejected") return "dismissed";
  return null;
}

function reviewStatusFromDb(status: string): string {
  if (status === "pending") return "pending_review";
  return status === "approved" ? "approved" : "rejected";
}

async function insertAudit(
  env: TrustSupportEnv,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Row,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_logs
      (id, actor_id, action, entity_type, entity_id, metadata, created_at)
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

function canModerate(roles: string[]): boolean {
  return roles.includes("owner") || roles.includes("admin") || roles.includes("moderator");
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) return "";
  return normalize(value);
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  const clean = text(value, maxLength);
  return clean || null;
}

function normalize(value: string): string {
  return Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || code === 127 ? " " : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const output: string[] = [];
  for (const item of value) {
    const clean = text(item, maxLength);
    if (!clean || output.includes(clean)) return null;
    output.push(clean);
  }
  return output;
}

function jsonStringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function integerValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function integer(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function changedRows(result: Result): number {
  return Number.isFinite(result.meta?.changes) ? Number(result.meta?.changes) : 0;
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function now(): string {
  return new Date().toISOString();
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

function stale(cors: Headers): Response {
  return json(
    { error: { code: "stale_review", message: "Resource changed since it was loaded." } },
    409,
    cors,
  );
}

function validation(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}

function databaseError(cors: Headers): Response {
  return json(
    { error: { code: "database_unavailable", message: "Data service unavailable." } },
    503,
    cors,
  );
}
