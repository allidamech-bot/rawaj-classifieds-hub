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
}

export interface ReferralsEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

const asAuthEnv = (env: ReferralsEnv) => env as unknown as AuthEnv;

export function isReferralPath(path: string): boolean {
  return (
    path === "/v1/account/referrals" ||
    path === "/v1/account/referrals/claim" ||
    /^\/v1\/account\/referrals\/rewards\/[^/]+\/redeem$/.test(path)
  );
}

export async function handleReferrals(
  request: Request,
  env: ReferralsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  if (!isReferralPath(path)) return null;
  const cors = corsHeaders(request, asAuthEnv(env));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (path === "/v1/account/referrals" && request.method === "GET") {
    return referralSummary(request, env, cors);
  }
  if (path === "/v1/account/referrals/claim" && request.method === "POST") {
    return claimReferral(request, env, cors);
  }
  const rewardMatch = path.match(/^\/v1\/account\/referrals\/rewards\/([^/]+)\/redeem$/);
  if (rewardMatch && request.method === "POST") {
    return redeemReward(request, env, cors, decodeURIComponent(rewardMatch[1]));
  }
  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

async function referralSummary(request: Request, env: ReferralsEnv, cors: Headers) {
  const auth = await authenticate(request, asAuthEnv(env));
  if (!auth) return unauthorized(cors);

  const claimRows = await env.DB.prepare(
    `SELECT status, COUNT(*) AS count FROM referral_claims WHERE referrer_user_id = ? GROUP BY status`,
  )
    .bind(auth.userId)
    .all<{ status: string; count: number }>();
  if (!claimRows.success) return databaseError(cors, claimRows.error);

  const rewardRows = await env.DB.prepare(
    `SELECT rr.id, rr.claim_id, rr.reward_type, rr.status, rr.duration_hours,
            rr.suggested_listing_id, rr.listing_id, rr.promotion_request_id,
            rr.granted_at, rr.redeemed_at, rr.created_at, rr.updated_at,
            source.title AS suggested_listing_title,
            redeemed.title AS redeemed_listing_title
       FROM referral_rewards rr
       LEFT JOIN listings source ON source.id = rr.suggested_listing_id
       LEFT JOIN listings redeemed ON redeemed.id = rr.listing_id
      WHERE rr.user_id = ?
      ORDER BY rr.created_at DESC, rr.id DESC LIMIT 100`,
  )
    .bind(auth.userId)
    .all<Row>();
  if (!rewardRows.success) return databaseError(cors, rewardRows.error);

  const referrals = { claimed: 0, qualified: 0, rewarded: 0, disqualified: 0 };
  for (const row of claimRows.results ?? []) {
    const status = text(row.status);
    if (status in referrals) referrals[status as keyof typeof referrals] = num(row.count);
  }
  const rewards = (rewardRows.results ?? []).map(mapReward);
  return json(
    {
      data: {
        referrals,
        availableRewardCount: rewards.filter((r) => r.status === "available").length,
        rewards,
      },
    },
    200,
    cors,
  );
}

async function claimReferral(request: Request, env: ReferralsEnv, cors: Headers) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);

  const sourceListingId = cleanId(body.data.sourceListingId);
  const referredListingId = cleanId(body.data.referredListingId);
  if (!sourceListingId || !referredListingId || sourceListingId === referredListingId) {
    return validation(cors, "A valid source listing and referred listing are required.");
  }

  const existing = await env.DB.prepare(
    `SELECT id, referrer_user_id, source_listing_id, referred_listing_id, status
       FROM referral_claims WHERE referred_user_id = ? LIMIT 1`,
  )
    .bind(auth.userId)
    .first<Row>();
  if (existing) {
    if (
      nullable(existing.source_listing_id) === sourceListingId &&
      nullable(existing.referred_listing_id) === referredListingId
    ) {
      return json({ data: mapClaim(existing), idempotent: true }, 200, cors);
    }
    return conflict(cors, "This account already has a referral attribution.");
  }

  const source = await env.DB.prepare(
    `SELECT l.id, l.owner_id, l.status, p.account_status, u.disabled_at
       FROM listings l JOIN public_profiles p ON p.id=l.owner_id JOIN auth_users u ON u.id=l.owner_id
      WHERE l.id = ? LIMIT 1`,
  )
    .bind(sourceListingId)
    .first<Row>();
  if (
    !source ||
    !nullable(source.owner_id) ||
    nullable(source.owner_id) === auth.userId ||
    text(source.status) === "draft" ||
    text(source.account_status) !== "active" ||
    source.disabled_at
  ) {
    return conflict(cors, "The shared listing is not eligible for referral attribution.");
  }

  const referred = await env.DB.prepare(
    `SELECT id, owner_id, status FROM listings WHERE id = ? AND owner_id = ? LIMIT 1`,
  )
    .bind(referredListingId, auth.userId)
    .first<Row>();
  if (!referred || !["pending_review", "approved"].includes(text(referred.status))) {
    return conflict(cors, "The referred listing must be a real listing submitted for review.");
  }

  const previous = await env.DB.prepare(
    `SELECT id FROM listings WHERE owner_id=? AND id<>? AND status<>'draft' LIMIT 1`,
  )
    .bind(auth.userId, referredListingId)
    .first<{ id: string }>();
  if (previous)
    return conflict(cors, "Referral rewards are for a user's first submitted real listing.");

  const timestamp = new Date().toISOString();
  const claimId = crypto.randomUUID();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO referral_claims (
       id,referrer_user_id,referred_user_id,source_listing_id,referred_listing_id,status,
       qualified_listing_id,disqualification_reason,claimed_at,qualified_at,rewarded_at,created_at,updated_at
     ) VALUES (?,?,?,?,?,'claimed',NULL,NULL,?,NULL,NULL,?,?)`,
  )
    .bind(
      claimId,
      text(source.owner_id),
      auth.userId,
      sourceListingId,
      referredListingId,
      timestamp,
      timestamp,
      timestamp,
    )
    .run();
  if (!inserted.success) return databaseError(cors, inserted.error);

  const stored = await env.DB.prepare(
    `SELECT id, referrer_user_id, source_listing_id, referred_listing_id, status FROM referral_claims WHERE referred_user_id=? LIMIT 1`,
  )
    .bind(auth.userId)
    .first<Row>();
  if (!stored) return databaseError(cors);
  await audit(env, auth.userId, "referral.claimed", text(stored.id), {
    sourceListingId,
    referredListingId,
    referrerUserId: text(stored.referrer_user_id),
  });
  return json({ data: mapClaim(stored), idempotent: false }, 201, cors);
}

async function redeemReward(
  request: Request,
  env: ReferralsEnv,
  cors: Headers,
  rewardIdRaw: string,
) {
  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
  if (auth instanceof Response) return auth;
  const rewardId = cleanId(rewardIdRaw);
  if (!rewardId) return validation(cors, "Invalid reward id.");
  const body = await readJson(request);
  if (!body.ok) return json({ error: body.error }, body.status, cors);
  const listingId = cleanId(body.data.listingId);
  if (!listingId) return validation(cors, "Listing id is required.");

  const current = await env.DB.prepare(
    `SELECT id,claim_id,user_id,status,listing_id,promotion_request_id,duration_hours,granted_at,redeemed_at,created_at,updated_at
       FROM referral_rewards WHERE id=? AND user_id=? LIMIT 1`,
  )
    .bind(rewardId, auth.userId)
    .first<Row>();
  if (!current) return notFound(cors, "Referral reward not found.");
  if (text(current.status) === "redeemed") {
    if (nullable(current.listing_id) !== listingId)
      return conflict(cors, "This referral reward has already been used on another listing.");
    return json({ data: mapReward(current), idempotent: true }, 200, cors);
  }
  if (text(current.status) !== "available")
    return conflict(cors, "This referral reward is not available.");

  const timestamp = new Date().toISOString();
  const promotionRequestId = `referral-promo:${rewardId}`;
  const updated = await env.DB.prepare(
    `UPDATE referral_rewards SET status='redeemed',listing_id=?,promotion_request_id=?,redeemed_at=?,updated_at=?
      WHERE id=? AND user_id=? AND status='available'`,
  )
    .bind(listingId, promotionRequestId, timestamp, timestamp, rewardId, auth.userId)
    .run();
  if (!updated.success) return redemptionFailure(cors, updated.error);

  const stored = await env.DB.prepare(
    `SELECT id,claim_id,user_id,reward_type,status,duration_hours,suggested_listing_id,listing_id,promotion_request_id,granted_at,redeemed_at,created_at,updated_at
       FROM referral_rewards WHERE id=? AND user_id=? LIMIT 1`,
  )
    .bind(rewardId, auth.userId)
    .first<Row>();
  if (!stored) return databaseError(cors);
  await audit(env, auth.userId, "referral.reward_redeemed", rewardId, {
    listingId,
    promotionRequestId,
  });
  return json({ data: mapReward(stored), idempotent: false }, 200, cors);
}

async function audit(
  env: ReferralsEnv,
  actorId: string,
  action: string,
  entityId: string,
  metadata: Row,
) {
  const result = await env.DB.prepare(
    `INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata,created_at) VALUES (?,?,?,'referral',?,?,?)`,
  )
    .bind(
      crypto.randomUUID(),
      actorId,
      action,
      entityId,
      JSON.stringify(metadata),
      new Date().toISOString(),
    )
    .run();
  if (!result.success)
    console.error(
      JSON.stringify({
        event: "referral_audit_write_failed",
        action,
        entityId,
        error: result.error,
      }),
    );
}

function mapClaim(row: Row) {
  return {
    id: text(row.id),
    referrerUserId: text(row.referrer_user_id),
    sourceListingId: nullable(row.source_listing_id),
    referredListingId: nullable(row.referred_listing_id),
    status: text(row.status, "claimed"),
  };
}
function mapReward(row: Row) {
  return {
    id: text(row.id),
    claimId: text(row.claim_id),
    rewardType: text(row.reward_type, "listing_boost_24h"),
    status: text(row.status, "available"),
    durationHours: num(row.duration_hours) || 24,
    suggestedListingId: nullable(row.suggested_listing_id),
    suggestedListingTitle: nullable(row.suggested_listing_title),
    listingId: nullable(row.listing_id),
    listingTitle: nullable(row.redeemed_listing_title),
    promotionRequestId: nullable(row.promotion_request_id),
    grantedAt: nullable(row.granted_at),
    redeemedAt: nullable(row.redeemed_at),
    createdAt: nullable(row.created_at),
    updatedAt: nullable(row.updated_at),
  };
}
function redemptionFailure(cors: Headers, error?: string) {
  const value = error ?? "";
  if (value.includes("referral_reward_listing_not_eligible"))
    return conflict(cors, "Choose an approved, active listing that belongs to you.");
  if (value.includes("referral_reward_listing_already_featured"))
    return conflict(cors, "This listing already has an active boost.");
  if (value.includes("referral_reward_promotion_pending"))
    return conflict(cors, "This listing already has a promotion request under review.");
  if (value.includes("referral_reward_missing_listing"))
    return validation(cors, "A listing is required to redeem this reward.");
  return databaseError(cors, error);
}
function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return /^[A-Za-z0-9:_-]{1,180}$/.test(clean) ? clean : null;
}
function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}
function nullable(value: unknown): string | null {
  const valueText = text(value).trim();
  return valueText || null;
}
function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}
function validation(cors: Headers, message: string) {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}
function unauthorized(cors: Headers) {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function notFound(cors: Headers, message: string) {
  return json({ error: { code: "not_found", message } }, 404, cors);
}
function conflict(cors: Headers, message: string) {
  return json({ error: { code: "status_mismatch", message } }, 409, cors);
}
function databaseError(cors: Headers, error?: string) {
  console.error(JSON.stringify({ event: "referral_database_error", error }));
  return json(
    { error: { code: "database_error", message: "Database operation failed." } },
    500,
    cors,
  );
}
