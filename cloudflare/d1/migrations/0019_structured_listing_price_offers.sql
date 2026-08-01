-- Structured buyer/seller listing price offers.
-- Accepted offers never mutate listing lifecycle state automatically.
PRAGMA foreign_keys = ON;

CREATE TABLE listing_price_offers (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  parent_offer_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0 AND amount <= 9007199254740991),
  currency TEXT NOT NULL CHECK (length(currency) BETWEEN 3 AND 8),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired')),
  expires_at TEXT NOT NULL,
  responded_at TEXT,
  client_request_id TEXT NOT NULL,
  last_action_request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (buyer_id <> seller_id),
  CHECK (created_by = buyer_id OR created_by = seller_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_offer_id) REFERENCES listing_price_offers(id) ON DELETE SET NULL,
  UNIQUE (created_by, client_request_id)
);

CREATE UNIQUE INDEX idx_listing_price_offers_one_pending
  ON listing_price_offers (conversation_id)
  WHERE status = 'pending';

CREATE INDEX idx_listing_price_offers_conversation_history
  ON listing_price_offers (conversation_id, created_at ASC, id ASC);

CREATE INDEX idx_listing_price_offers_listing_status
  ON listing_price_offers (listing_id, status, updated_at DESC);

CREATE INDEX idx_listing_price_offers_expiry
  ON listing_price_offers (status, expires_at)
  WHERE status = 'pending';