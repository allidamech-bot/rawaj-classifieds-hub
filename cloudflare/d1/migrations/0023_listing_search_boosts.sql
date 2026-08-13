-- RAWAJ Syria paid search Boost packages.
-- Prices and durations are locked in D1; clients only choose a package code.
PRAGMA foreign_keys = ON;

CREATE TABLE listing_search_boost_orders (
  id TEXT PRIMARY KEY,
  promotion_request_id TEXT NOT NULL UNIQUE,
  listing_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL,
  package_code TEXT NOT NULL CHECK (package_code IN ('boost_6h','boost_24h','boost_3d','boost_7d')),
  duration_minutes INTEGER NOT NULL,
  price_syp INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SYP' CHECK (currency = 'SYP'),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','active','expired','rejected','cancelled')),
  starts_at TEXT,
  ends_at TEXT,
  payment_confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (package_code='boost_6h' AND duration_minutes=360 AND price_syp=200) OR
    (package_code='boost_24h' AND duration_minutes=1440 AND price_syp=350) OR
    (package_code='boost_3d' AND duration_minutes=4320 AND price_syp=700) OR
    (package_code='boost_7d' AND duration_minutes=10080 AND price_syp=1300)
  ),
  FOREIGN KEY (promotion_request_id) REFERENCES listing_promotion_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_search_boost_owner_created ON listing_search_boost_orders (requester_user_id, created_at DESC, id DESC);
CREATE INDEX idx_search_boost_status_ends ON listing_search_boost_orders (status, ends_at, id);
CREATE UNIQUE INDEX idx_search_boost_listing_open_unique ON listing_search_boost_orders (listing_id) WHERE status IN ('pending_payment','active');

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
    SELECT 1 FROM listings l WHERE l.id=NEW.listing_id AND l.owner_id=NEW.requester_user_id AND l.status='approved' AND COALESCE(l.is_demo,0)=0 AND l.archived_at IS NULL AND (l.expires_at IS NULL OR l.expires_at>NEW.created_at)
  );
  SELECT RAISE(ABORT,'search_boost_listing_already_featured') WHERE EXISTS (
    SELECT 1 FROM listings l WHERE l.id=NEW.listing_id AND l.is_featured=1 AND (l.featured_until IS NULL OR l.featured_until>NEW.created_at)
  );
  SELECT RAISE(ABORT,'search_boost_promotions_frozen') WHERE EXISTS (
    SELECT 1 FROM system_controls sc WHERE sc.key IN ('freeze_promotions','maintenance_mode','emergency_read_only') AND sc.enabled=1
  );
END;

CREATE TRIGGER search_boost_order_after_promotion_insert
AFTER INSERT ON listing_promotion_requests
WHEN NEW.client_request_id GLOB 'search-boost:*'
BEGIN
  INSERT INTO listing_search_boost_orders (
    id,promotion_request_id,listing_id,requester_user_id,package_code,duration_minutes,price_syp,currency,status,starts_at,ends_at,payment_confirmed_at,created_at,updated_at
  ) VALUES (
    'search-boost-order:'||NEW.id,NEW.id,NEW.listing_id,NEW.requester_user_id,
    CASE WHEN NEW.client_request_id GLOB 'search-boost:boost_6h:*' THEN 'boost_6h' WHEN NEW.client_request_id GLOB 'search-boost:boost_24h:*' THEN 'boost_24h' WHEN NEW.client_request_id GLOB 'search-boost:boost_3d:*' THEN 'boost_3d' ELSE 'boost_7d' END,
    CASE WHEN NEW.client_request_id GLOB 'search-boost:boost_6h:*' THEN 360 WHEN NEW.client_request_id GLOB 'search-boost:boost_24h:*' THEN 1440 WHEN NEW.client_request_id GLOB 'search-boost:boost_3d:*' THEN 4320 ELSE 10080 END,
    CASE WHEN NEW.client_request_id GLOB 'search-boost:boost_6h:*' THEN 200 WHEN NEW.client_request_id GLOB 'search-boost:boost_24h:*' THEN 350 WHEN NEW.client_request_id GLOB 'search-boost:boost_3d:*' THEN 700 ELSE 1300 END,
    'SYP','pending_payment',NULL,NULL,NULL,NEW.created_at,NEW.updated_at
  );
  UPDATE listing_promotion_requests SET admin_note=(
    SELECT '[RAWAJ_SEARCH_BOOST:'||package_code||'] '||CASE package_code
      WHEN 'boost_6h' THEN 'BOOST سريع · 6 ساعات · 200 ل.س'
      WHEN 'boost_24h' THEN 'BOOST يوم كامل · 24 ساعة · 350 ل.س · الأكثر اختياراً'
      WHEN 'boost_3d' THEN 'BOOST قوي · 3 أيام · 700 ل.س'
      ELSE 'BOOST أسبوع · 7 أيام · 1300 ل.س' END||' · موافقة الإدارة تؤكد الدفع وتبدأ المدة فوراً.'
    FROM listing_search_boost_orders WHERE promotion_request_id=NEW.id
  ) WHERE id=NEW.id;
END;

CREATE TRIGGER search_boost_validate_before_approval
BEFORE UPDATE OF status ON listing_promotion_requests
WHEN NEW.status='approved' AND OLD.status<>'approved' AND EXISTS (
  SELECT 1 FROM listing_search_boost_orders b WHERE b.promotion_request_id=NEW.id AND b.status='pending_payment'
)
BEGIN
  SELECT RAISE(ABORT,'search_boost_payment_proof_required') WHERE NEW.proof_asset_id IS NULL AND length(trim(COALESCE(NEW.payment_reference,'')))=0;
  SELECT RAISE(ABORT,'search_boost_promotions_frozen') WHERE EXISTS (
    SELECT 1 FROM system_controls sc WHERE sc.key IN ('freeze_promotions','maintenance_mode','emergency_read_only') AND sc.enabled=1
  );
  SELECT RAISE(ABORT,'search_boost_listing_not_eligible') WHERE NOT EXISTS (
    SELECT 1 FROM listings l WHERE l.id=NEW.listing_id AND l.owner_id=NEW.requester_user_id AND l.status='approved' AND COALESCE(l.is_demo,0)=0 AND l.archived_at IS NULL AND (l.expires_at IS NULL OR l.expires_at>NEW.updated_at)
  );
END;

DROP TRIGGER listing_promotion_apply_after_approval;
CREATE TRIGGER listing_promotion_apply_after_approval
AFTER UPDATE OF status ON listing_promotion_requests
WHEN NEW.status='approved' AND OLD.status<>'approved' AND NEW.client_request_id NOT GLOB 'search-boost:*'
BEGIN
  UPDATE listings SET is_featured=1,featured_until=NEW.ends_at,updated_at=NEW.updated_at
  WHERE id=NEW.listing_id AND owner_id=NEW.requester_user_id AND status='approved' AND archived_at IS NULL AND (expires_at IS NULL OR expires_at>NEW.updated_at);
END;

CREATE TRIGGER search_boost_apply_after_approval
AFTER UPDATE OF status ON listing_promotion_requests
WHEN NEW.status='approved' AND OLD.status<>'approved' AND EXISTS (
  SELECT 1 FROM listing_search_boost_orders b WHERE b.promotion_request_id=NEW.id AND b.status='pending_payment'
)
BEGIN
  UPDATE listing_promotion_requests SET ends_at=(
    SELECT strftime('%Y-%m-%dT%H:%M:%fZ',COALESCE(NEW.starts_at,NEW.updated_at),'+'||b.duration_minutes||' minutes') FROM listing_search_boost_orders b WHERE b.promotion_request_id=NEW.id
  ) WHERE id=NEW.id;
  UPDATE listing_search_boost_orders SET status='active',starts_at=COALESCE(NEW.starts_at,NEW.updated_at),ends_at=(SELECT ends_at FROM listing_promotion_requests WHERE id=NEW.id),payment_confirmed_at=NEW.updated_at,updated_at=NEW.updated_at
  WHERE promotion_request_id=NEW.id AND status='pending_payment';
  UPDATE listings SET is_featured=1,featured_until=(SELECT ends_at FROM listing_promotion_requests WHERE id=NEW.id),updated_at=NEW.updated_at
  WHERE id=NEW.listing_id AND owner_id=NEW.requester_user_id AND status='approved' AND archived_at IS NULL AND (expires_at IS NULL OR expires_at>NEW.updated_at);
END;

CREATE TRIGGER search_boost_sync_terminal_promotion
AFTER UPDATE OF status ON listing_promotion_requests
WHEN NEW.status IN ('expired','rejected','cancelled') AND OLD.status<>NEW.status AND EXISTS (
  SELECT 1 FROM listing_search_boost_orders b WHERE b.promotion_request_id=NEW.id
)
BEGIN
  UPDATE listing_search_boost_orders SET status=CASE NEW.status WHEN 'expired' THEN 'expired' WHEN 'rejected' THEN 'rejected' ELSE 'cancelled' END,updated_at=NEW.updated_at
  WHERE promotion_request_id=NEW.id AND status IN ('pending_payment','active');
END;

CREATE TRIGGER search_boost_preserve_metadata_after_note_update
AFTER UPDATE OF admin_note ON listing_promotion_requests
WHEN EXISTS (SELECT 1 FROM listing_search_boost_orders b WHERE b.promotion_request_id=NEW.id)
  AND COALESCE(NEW.admin_note,'') NOT GLOB '[[]RAWAJ_SEARCH_BOOST:*'
BEGIN
  UPDATE listing_promotion_requests SET admin_note=(
    SELECT '[RAWAJ_SEARCH_BOOST:'||b.package_code||'] '||CASE b.package_code
      WHEN 'boost_6h' THEN 'BOOST سريع · 6 ساعات · 200 ل.س'
      WHEN 'boost_24h' THEN 'BOOST يوم كامل · 24 ساعة · 350 ل.س · الأكثر اختياراً'
      WHEN 'boost_3d' THEN 'BOOST قوي · 3 أيام · 700 ل.س'
      ELSE 'BOOST أسبوع · 7 أيام · 1300 ل.س' END||CASE WHEN length(trim(COALESCE(NEW.admin_note,'')))>0 THEN ' | ملاحظة الإدارة: '||substr(trim(NEW.admin_note),1,650) ELSE '' END
    FROM listing_search_boost_orders b WHERE b.promotion_request_id=NEW.id
  ) WHERE id=NEW.id;
END;
