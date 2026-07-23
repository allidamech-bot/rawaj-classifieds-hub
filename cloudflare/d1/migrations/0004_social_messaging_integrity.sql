-- Favorites, saved-search compatibility, and messaging integrity.
PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_favorites_listing_user
  ON favorites (listing_id, user_id);

ALTER TABLE saved_searches ADD COLUMN name_ar TEXT;
ALTER TABLE saved_searches ADD COLUMN filters TEXT CHECK (filters IS NULL OR json_valid(filters));
ALTER TABLE saved_searches ADD COLUMN alert_frequency TEXT NOT NULL DEFAULT 'weekly'
  CHECK (alert_frequency IN ('daily', 'weekly', 'off'));
ALTER TABLE saved_searches ADD COLUMN last_alert_checked_at TEXT;

UPDATE saved_searches
   SET name_ar = name,
       filters = query,
       alert_frequency = CASE WHEN alerts_enabled = 1 THEN 'weekly' ELSE 'off' END
 WHERE name_ar IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_listing_participants
  ON conversations (listing_id, buyer_id, seller_id);

ALTER TABLE conversation_messages ADD COLUMN client_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_sender_request
  ON conversation_messages (sender_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_unread
  ON conversation_messages (conversation_id, read_at, sender_id, created_at);
