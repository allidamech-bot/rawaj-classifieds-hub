-- Governed listing lifecycle, immutable price history, favorite price context,
-- and idempotent expiry reminders for the Cloudflare-only runtime.
PRAGMA foreign_keys = ON;

CREATE TABLE listing_price_changes (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  old_price REAL NOT NULL CHECK (old_price > 0),
  new_price REAL NOT NULL CHECK (new_price > 0 AND new_price < old_price),
  currency TEXT NOT NULL DEFAULT 'SYP' CHECK (currency = 'SYP'),
  created_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_listing_price_changes_listing_created
  ON listing_price_changes (listing_id, created_at DESC, id DESC);
CREATE INDEX idx_listing_price_changes_owner_created
  ON listing_price_changes (owner_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX idx_listing_price_changes_transition_unique
  ON listing_price_changes (listing_id, old_price, new_price);

CREATE TABLE favorite_listing_snapshots (
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  price_snapshot REAL,
  currency_snapshot TEXT NOT NULL DEFAULT 'SYP' CHECK (currency_snapshot = 'SYP'),
  status_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX idx_favorite_listing_snapshots_user_created
  ON favorite_listing_snapshots (user_id, created_at DESC, listing_id);

CREATE TABLE listing_expiry_reminder_deliveries (
  listing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reminder_kind TEXT NOT NULL CHECK (reminder_kind IN ('expiring_7d', 'expiring_1d')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (listing_id, reminder_kind),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_listing_expiry_reminders_user_created
  ON listing_expiry_reminder_deliveries (user_id, created_at DESC);

CREATE TRIGGER listing_promotion_validate_before_approval
BEFORE UPDATE OF status ON listing_promotion_requests
WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM listings l
     WHERE l.id = NEW.listing_id
       AND l.owner_id = NEW.requester_user_id
       AND l.status = 'approved'
       AND l.archived_at IS NULL
       AND (l.expires_at IS NULL OR l.expires_at > NEW.updated_at)
  )
BEGIN
  SELECT RAISE(ABORT, 'promotion_listing_not_public');
END;

CREATE TRIGGER listing_promotion_apply_after_approval
AFTER UPDATE OF status ON listing_promotion_requests
WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
BEGIN
  UPDATE listings
     SET is_featured = 1,
         featured_until = NEW.ends_at,
         updated_at = NEW.updated_at
   WHERE id = NEW.listing_id
     AND owner_id = NEW.requester_user_id
     AND status = 'approved'
     AND archived_at IS NULL
     AND (expires_at IS NULL OR expires_at > NEW.updated_at);
END;
