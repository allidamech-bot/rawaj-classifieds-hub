PRAGMA foreign_keys = ON;

-- Repair Syria referral/search-boost triggers created by 0022/0023.
-- The canonical Syria listings schema does not contain an is_demo column.

DROP TRIGGER IF EXISTS referral_reward_validate_before_redeem;
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

DROP TRIGGER IF EXISTS referral_qualify_after_listing_approval;
CREATE TRIGGER referral_qualify_after_listing_approval
AFTER UPDATE OF status ON listings
WHEN NEW.status = 'approved'
  AND OLD.status <> 'approved'
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

DROP TRIGGER IF EXISTS search_boost_validate_before_promotion_insert;
CREATE TRIGGER search_boost_validate_before_promotion_insert
BEFORE INSERT ON listing_promotion_requests
WHEN NEW.client_request_id GLOB 'search-boost:*'
BEGIN
  SELECT RAISE(ABORT,'search_boost_invalid_package') WHERE NEW.promotion_type <> 'highlighted' OR NOT (
    (NEW.client_request_id GLOB 'search-boost:boost_6h:*' AND NEW.requested_days=1) OR
    (NEW.client_request_id GLOB 'search-boost:boost_24h:*' AND NEW.requested_days=1) OR
    (NEW.client_request_id GLOB 'search-boost:boost_3d:*' AND NEW.requested_days=3) OR
    (NEW.client_request_id GLOB 'search-boost:boost_7d:*' AND NEW.requested_days=7)
  );

  SELECT RAISE(ABORT,'search_boost_listing_not_eligible') WHERE NOT EXISTS (
    SELECT 1
      FROM listings l
     WHERE l.id=NEW.listing_id
       AND l.owner_id=NEW.requester_user_id
       AND l.status='approved'
       AND l.archived_at IS NULL
       AND (l.expires_at IS NULL OR l.expires_at>NEW.created_at)
  );

  SELECT RAISE(ABORT,'search_boost_listing_already_featured') WHERE EXISTS (
    SELECT 1 FROM listings l
     WHERE l.id=NEW.listing_id
       AND l.is_featured=1
       AND (l.featured_until IS NULL OR l.featured_until>NEW.created_at)
  );

  SELECT RAISE(ABORT,'search_boost_promotions_frozen') WHERE EXISTS (
    SELECT 1 FROM system_controls sc
     WHERE sc.key IN ('freeze_promotions','maintenance_mode','emergency_read_only')
       AND sc.enabled=1
  );
END;

DROP TRIGGER IF EXISTS search_boost_validate_before_approval;
CREATE TRIGGER search_boost_validate_before_approval
BEFORE UPDATE OF status ON listing_promotion_requests
WHEN NEW.status='approved'
  AND OLD.status<>'approved'
  AND EXISTS (
    SELECT 1
      FROM listing_search_boost_orders b
     WHERE b.promotion_request_id=NEW.id
       AND b.status='pending_payment'
  )
BEGIN
  SELECT RAISE(ABORT,'search_boost_payment_proof_required')
   WHERE NEW.proof_asset_id IS NULL
     AND length(trim(COALESCE(NEW.payment_reference,'')))=0;

  SELECT RAISE(ABORT,'search_boost_promotions_frozen') WHERE EXISTS (
    SELECT 1 FROM system_controls sc
     WHERE sc.key IN ('freeze_promotions','maintenance_mode','emergency_read_only')
       AND sc.enabled=1
  );

  SELECT RAISE(ABORT,'search_boost_listing_not_eligible') WHERE NOT EXISTS (
    SELECT 1
      FROM listings l
     WHERE l.id=NEW.listing_id
       AND l.owner_id=NEW.requester_user_id
       AND l.status='approved'
       AND l.archived_at IS NULL
       AND (l.expires_at IS NULL OR l.expires_at>NEW.updated_at)
  );
END;
