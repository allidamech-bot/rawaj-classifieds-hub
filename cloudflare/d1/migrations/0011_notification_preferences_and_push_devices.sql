-- Extended notification controls and encrypted push-device registration.
PRAGMA foreign_keys = ON;

ALTER TABLE notification_preferences
  ADD COLUMN price_changes_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (price_changes_enabled IN (0, 1));
ALTER TABLE notification_preferences
  ADD COLUMN saved_search_matches_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (saved_search_matches_enabled IN (0, 1));
ALTER TABLE notification_preferences
  ADD COLUMN listing_status_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (listing_status_enabled IN (0, 1));
ALTER TABLE notification_preferences
  ADD COLUMN reviews_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (reviews_enabled IN (0, 1));
ALTER TABLE notification_preferences
  ADD COLUMN promotions_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (promotions_enabled IN (0, 1));

ALTER TABLE push_devices ADD COLUMN device_key_hash TEXT;
ALTER TABLE push_devices ADD COLUMN permission_status TEXT NOT NULL DEFAULT 'prompt'
  CHECK (permission_status IN ('granted', 'denied', 'prompt'));
ALTER TABLE push_devices ADD COLUMN app_version TEXT;
ALTER TABLE push_devices ADD COLUMN locale TEXT;
ALTER TABLE push_devices ADD COLUMN last_seen_at TEXT;

CREATE UNIQUE INDEX idx_push_devices_user_device_key
  ON push_devices (user_id, device_key_hash)
  WHERE device_key_hash IS NOT NULL;
CREATE INDEX idx_push_devices_user_active
  ON push_devices (user_id, active, updated_at DESC);
