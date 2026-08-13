-- RAWAJ Syria listing-share referral growth loop.
-- A referral is only qualified after the referred user's submitted non-demo listing is approved.
-- Rewards are non-cash, single-use 24-hour listing boosts that reuse the governed promotion system.
PRAGMA foreign_keys = ON;

CREATE TABLE referral_claims (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL,
  source_listing_id TEXT,
  referred_listing_id TEXT,
  status TEXT NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'qualified', 'rewarded', 'disqualified')),
  qualified_listing_id TEXT,
  disqualification_reason TEXT,
  claimed_at TEXT NOT NULL,
  qualified_at TEXT,
  rewarded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (referrer_user_id <> referred_user_id),
  UNIQUE (referred_user_id),
  UNIQUE (referred_listing_id),
  FOREIGN KEY (referrer_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  FOREIGN KEY (referred_listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  FOREIGN KEY (qualified_listing_id) REFERENCES listings(id) ON DELETE SET NULL
);

CREATE INDEX idx_referral_claims_referrer_created
  ON referral_claims (referrer_user_id, created_at DESC, id DESC);
CREATE INDEX idx_referral_claims_referred_status
  ON referral_claims (referred_user_id, status, updated_at DESC);
CREATE INDEX idx_referral_claims_source_listing
  ON referral_claims (source_listing_id, created_at DESC);

CREATE TABLE referral_rewards (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'listing_boost_24h'
    CHECK (reward_type IN ('listing_boost_24h')),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'redeemed', 'revoked')),
  duration_hours INTEGER NOT NULL DEFAULT 24 CHECK (duration_hours = 24),
  suggested_listing_id TEXT,
  listing_id TEXT,
  promotion_request_id TEXT UNIQUE,
  granted_at TEXT NOT NULL,
  redeemed_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (claim_id) REFERENCES referral_claims(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (suggested_listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  FOREIGN KEY (promotion_request_id) REFERENCES listing_promotion_requests(id) ON DELETE SET NULL
);

CREATE INDEX idx_referral_rewards_user_status
  ON referral_rewards (user_id, status, created_at DESC, id DESC);

CREATE TRIGGER referral_reward_validate_before_redeem
BEFORE UPDATE OF status ON referral_rewards
WHEN NEW.status = 'redeemed' AND OLD.status = 'available'
BEGIN
  SELECT RAISE(ABORT, 'referral_reward_missing_listing')
   WHERE NEW.listing_id IS NULL OR NEW.promotion_request_id IS NULL OR NEW.redeemed_at IS NULL;

  SELECT RAISE(ABORT, 'referral_reward_promotions_frozen')
   WHERE EXISTS (
    SELECT 1
      FROM system_controls sc
     WHERE sc.key IN ('freeze_promotions', 'maintenance_mode', 'emergency_read_only')
       AND sc.enabled = 1
  );

  SELECT RAISE(ABORT, 'referral_reward_listing_not_eligible')
   WHERE NOT EXISTS (
    SELECT 1
      FROM listings l
     WHERE l.id = NEW.listing_id
       AND l.owner_id = NEW.user_id
       AND l.status = 'approved'
       AND COALESCE(l.is_demo, 0) = 0
       AND l.archived_at IS NULL
       AND (l.expires_at IS NULL OR l.expires_at > NEW.updated_at)
  );

  SELECT RAISE(ABORT, 'referral_reward_listing_already_featured')
   WHERE EXISTS (
    SELECT 1
      FROM listings l
     WHERE l.id = NEW.listing_id
       AND l.is_featured = 1
       AND (l.featured_until IS NULL OR l.featured_until > NEW.updated_at)
  );

  SELECT RAISE(ABORT, 'referral_reward_promotion_pending')
   WHERE EXISTS (
    SELECT 1
      FROM listing_promotion_requests p
     WHERE p.listing_id = NEW.listing_id
       AND p.requester_user_id = NEW.user_id
       AND p.status = 'pending_review'
  );
END;

CREATE TRIGGER referral_reward_apply_after_redeem
AFTER UPDATE OF status ON referral_rewards
WHEN NEW.status = 'redeemed' AND OLD.status = 'available'
BEGIN
  INSERT INTO listing_promotion_requests (
    id,
    listing_id,
    requester_user_id,
    client_request_id,
    promotion_type,
    status,
    requested_days,
    starts_at,
    ends_at,
    payment_method,
    payment_reference,
    proof_asset_id,
    admin_note,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  ) VALUES (
    NEW.promotion_request_id,
    NEW.listing_id,
    NEW.user_id,
    'referral:' || NEW.id,
    'highlighted',
    'pending_review',
    1,
    NULL,
    NULL,
    'referral_reward',
    NEW.id,
    NULL,
    'Automatic 24-hour RAWAJ referral boost',
    NULL,
    NULL,
    NEW.redeemed_at,
    NEW.redeemed_at
  );

  UPDATE listing_promotion_requests
     SET status = 'approved',
         starts_at = NEW.redeemed_at,
         ends_at = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.redeemed_at, '+1 day'),
         reviewed_at = NEW.redeemed_at,
         updated_at = NEW.redeemed_at
   WHERE id = NEW.promotion_request_id
     AND requester_user_id = NEW.user_id
     AND status = 'pending_review';

  UPDATE referral_claims
     SET status = 'rewarded',
         rewarded_at = NEW.redeemed_at,
         updated_at = NEW.redeemed_at
   WHERE id = NEW.claim_id
     AND status = 'qualified';
END;

CREATE TRIGGER referral_qualify_after_listing_approval
AFTER UPDATE OF status ON listings
WHEN NEW.status = 'approved'
  AND OLD.status <> 'approved'
  AND COALESCE(NEW.is_demo, 0) = 0
BEGIN
  UPDATE referral_claims
     SET status = 'qualified',
         qualified_listing_id = NEW.id,
         qualified_at = NEW.updated_at,
         updated_at = NEW.updated_at
   WHERE referred_user_id = NEW.owner_id
     AND referred_listing_id = NEW.id
     AND status = 'claimed';

  INSERT OR IGNORE INTO referral_rewards (
    id,
    claim_id,
    user_id,
    reward_type,
    status,
    duration_hours,
    suggested_listing_id,
    listing_id,
    promotion_request_id,
    granted_at,
    redeemed_at,
    revoked_at,
    created_at,
    updated_at
  )
  SELECT
    'referral-boost:' || rc.id,
    rc.id,
    rc.referrer_user_id,
    'listing_boost_24h',
    'available',
    24,
    rc.source_listing_id,
    NULL,
    NULL,
    NEW.updated_at,
    NULL,
    NULL,
    NEW.updated_at,
    NEW.updated_at
  FROM referral_claims rc
  WHERE rc.referred_user_id = NEW.owner_id
    AND rc.referred_listing_id = NEW.id
    AND rc.status = 'qualified';

  UPDATE referral_rewards
     SET status = 'redeemed',
         listing_id = suggested_listing_id,
         promotion_request_id = 'referral-promo:' || id,
         redeemed_at = NEW.updated_at,
         updated_at = NEW.updated_at
   WHERE claim_id IN (
    SELECT rc.id
      FROM referral_claims rc
     WHERE rc.referred_user_id = NEW.owner_id
       AND rc.referred_listing_id = NEW.id
       AND rc.status = 'qualified'
   )
     AND status = 'available'
     AND suggested_listing_id IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
        FROM system_controls sc
       WHERE sc.key IN ('freeze_promotions', 'maintenance_mode', 'emergency_read_only')
         AND sc.enabled = 1
     )
     AND EXISTS (
      SELECT 1
        FROM listings source
       WHERE source.id = referral_rewards.suggested_listing_id
         AND source.owner_id = referral_rewards.user_id
         AND source.status = 'approved'
         AND COALESCE(source.is_demo, 0) = 0
         AND source.archived_at IS NULL
         AND (source.expires_at IS NULL OR source.expires_at > NEW.updated_at)
         AND NOT (
          source.is_featured = 1
          AND (source.featured_until IS NULL OR source.featured_until > NEW.updated_at)
         )
     )
     AND NOT EXISTS (
      SELECT 1
        FROM listing_promotion_requests p
       WHERE p.listing_id = referral_rewards.suggested_listing_id
         AND p.requester_user_id = referral_rewards.user_id
         AND p.status = 'pending_review'
     );
END;
