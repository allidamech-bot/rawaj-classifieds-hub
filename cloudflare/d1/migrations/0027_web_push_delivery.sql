-- Extend the existing FCM outbox to browser/PWA tokens. No historical backfill.
PRAGMA foreign_keys = ON;
DROP TRIGGER trg_enqueue_android_notification;
DROP TRIGGER trg_enqueue_android_message;

-- Existing in-app notifications are the source of truth for these events.
CREATE TRIGGER trg_enqueue_android_notification
AFTER INSERT ON notifications
BEGIN
  INSERT OR IGNORE INTO push_delivery_jobs
    (device_id, user_id, token_hash, event_kind, event_id, created_at, next_attempt_at)
  SELECT d.id, d.user_id, d.token_hash, 'notification', NEW.id, NEW.created_at, NEW.created_at
  FROM push_devices d
  JOIN notification_preferences p ON p.user_id = d.user_id
  WHERE d.user_id = NEW.user_id AND d.platform IN ('android', 'web')
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
    AND d.platform IN ('android', 'web') AND d.active = 1 AND d.permission_status = 'granted'
    AND p.push_enabled = 1 AND p.messages_enabled = 1;
END;
