-- Listing promotion requests with private R2 payment receipts.
PRAGMA foreign_keys = ON;

CREATE TABLE listing_promotion_requests (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  promotion_type TEXT NOT NULL DEFAULT 'featured_home'
    CHECK (promotion_type IN ('featured_home', 'highlighted', 'urgent', 'top_category')),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_days INTEGER NOT NULL CHECK (requested_days BETWEEN 1 AND 90),
  starts_at TEXT,
  ends_at TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  proof_asset_id TEXT,
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (proof_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  UNIQUE (requester_user_id, client_request_id)
);

CREATE UNIQUE INDEX idx_listing_promotion_open_unique
  ON listing_promotion_requests (listing_id, requester_user_id)
  WHERE status = 'pending_review';
CREATE INDEX idx_listing_promotion_status_created
  ON listing_promotion_requests (status, created_at DESC);
