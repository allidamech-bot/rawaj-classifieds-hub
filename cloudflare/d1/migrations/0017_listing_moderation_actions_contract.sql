-- RAWAJ listing moderation actions contract alignment.
-- Updates the CHECK constraint on listing_moderation_actions.action to include
-- the canonical moderation action names while preserving historical 'restore' records.
--
-- The 'restore' action is deprecated and rejected by the API, but historical
-- records with this action are preserved to maintain audit trail integrity.
-- Any 'restore' record should be normalized to 'archive' via a data migration
-- after the schema change, or handled in application logic that recognizes
-- 'restore' as a legacy action that maps to 'archive' for display purposes.

PRAGMA foreign_keys = ON;

-- SQLite does not support ALTER TABLE DROP CONSTRAINT, so we recreate the table
-- with the updated CHECK constraint and preserve all existing data including
-- deprecated 'restore' action records.
CREATE TABLE listing_moderation_actions_new (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'archive', 'request_changes', 'suspend', 'unpublish', 'expire_now', 'extend_expiry', 'feature', 'unfeature', 'restore')),
  reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES auth_users(id) ON DELETE RESTRICT
);

-- Preserve ALL rows including deprecated 'restore' action records
INSERT INTO listing_moderation_actions_new
  (id, listing_id, actor_id, action, reason, metadata, created_at)
  SELECT id, listing_id, actor_id, action, reason, metadata, created_at
  FROM listing_moderation_actions;

DROP TABLE listing_moderation_actions;

ALTER TABLE listing_moderation_actions_new RENAME TO listing_moderation_actions;

CREATE INDEX idx_listing_moderation_actions_listing
  ON listing_moderation_actions (listing_id, created_at DESC);