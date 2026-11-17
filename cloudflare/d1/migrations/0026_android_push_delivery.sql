-- Durable, bounded Android notification delivery. Existing notifications and
-- registered devices are retained; historical events are not backfilled.
PRAGMA foreign_keys = ON;

CREATE TABLE push_delivery_jobs (
  device_id TEXT NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('notification', 'message')),
  event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  next_attempt_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  lease_id TEXT,
  last_error TEXT,
  PRIMARY KEY (device_id, event_kind, event_id)
);

CREATE INDEX idx_push_delivery_due
  ON push_delivery_jobs (status, next_attempt_at, created_at);
CREATE INDEX idx_push_delivery_created
  ON push_delivery_jobs (created_at);
CREATE INDEX idx_push_delivery_event
  ON push_delivery_jobs (event_kind, event_id, status, next_attempt_at);

-- Existing in-app notifications are the source of truth for these events.
CREATE TRIGGER trg_enqueue_android_notification
AFTER INSERT ON notifications
BEGIN
  INSERT OR IGNORE INTO push_delivery_jobs
    (device_id, user_id, token_hash, event_kind, event_id, created_at, next_attempt_at)
  SELECT d.id, d.user_id, d.token_hash, 'notification', NEW.id, NEW.created_at, NEW.created_at
  FROM push_devices d
  JOIN notification_preferences p ON p.user_id = d.user_id
  WHERE d.user_id = NEW.user_id AND d.platform = 'android'
    AND d.active = 1 AND d.permission_status = 'granted' AND p.push_enabled = 1
    AND CASE
      WHEN NEW.type GLOB 'offer.*' THEN p.messages_enabled
      WHEN NEW.type GLOB 'price.*' OR NEW.type = 'listing.price_changed' THEN p.price_changes_enabled
      WHEN NEW.type GLOB 'saved_search.*' THEN p.saved_search_matches_enabled
      WHEN NEW.type GLOB 'listing.*' THEN p.listing_status_enabled
      WHEN NEW.type GLOB 'review.*' THEN p.reviews_enabled
      WHEN NEW.type GLOB 'promotion.*' THEN p.promotions_enabled
      ELSE 0
    END = 1;
END;

-- A message already has an unread counter; avoid duplicating it by creating
-- another in-app notification. Send a device alert linked to its conversation.
CREATE TRIGGER trg_enqueue_android_message
AFTER INSERT ON conversation_messages
WHEN NEW.deleted_at IS NULL AND NEW.message_type <> 'system'
BEGIN
  INSERT OR IGNORE INTO push_delivery_jobs
    (device_id, user_id, token_hash, event_kind, event_id, created_at, next_attempt_at)
  SELECT d.id, d.user_id, d.token_hash, 'message', NEW.id, NEW.created_at, NEW.created_at
  FROM conversations c
  JOIN push_devices d ON d.user_id = CASE
    WHEN NEW.sender_id = c.buyer_id THEN c.seller_id ELSE c.buyer_id END
  JOIN notification_preferences p ON p.user_id = d.user_id
  WHERE c.id = NEW.conversation_id AND c.status = 'active'
    AND NEW.sender_id IN (c.buyer_id, c.seller_id)
    AND d.platform = 'android' AND d.active = 1 AND d.permission_status = 'granted'
    AND p.push_enabled = 1 AND p.messages_enabled = 1;
END;
