-- RAWAJ listing moderation actions contract alignment.
-- Updates the CHECK constraint on listing_moderation_actions.action to include
-- the canonical moderation action names and removes the legacy 'restore' alias.

PRAGMA foreign_keys = ON;

-- SQLite does not support ALTER TABLE DROP CONSTRAINT, so we recreate the table
-- with the updated CHECK constraint and preserve all existing data.
CREATE TABLE listing_moderation_actions_new (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'archive', 'request_changes', 'suspend', 'unpublish', 'expire_now', 'extend_expiry', 'feature', 'unfeature')),
  reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES auth_users(id) ON DELETE RESTRICT
);

INSERT INTO listing_moderation_actions_new
  (id, listing_id, actor_id, action, reason, metadata, created_at)
  SELECT id, listing_id, actor_id, action, reason, metadata, created_at
  FROM listing_moderation_actions
  WHERE action IN ('submit', 'approve', 'reject', 'archive', 'request_changes', 'suspend', 'unpublish', 'expire_now', 'extend_expiry', 'feature', 'unfeature');

DROP TABLE listing_moderation_actions;

ALTER TABLE listing_moderation_actions_new RENAME TO listing_moderation_actions;

CREATE INDEX idx_listing_moderation_actions_listing
  ON listing_moderation_actions (listing_id, created_at DESC);
