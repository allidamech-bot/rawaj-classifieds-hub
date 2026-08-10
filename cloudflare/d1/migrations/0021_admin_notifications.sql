PRAGMA foreign_keys = ON;

-- Admin Notification System: durable, idempotent, per-admin read state.
-- Additive only. No destructive changes to existing tables.
CREATE TABLE admin_notifications (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'user_created',
    'listing_submitted',
    'feedback_created',
    'support_created',
    'report_created'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'users',
    'listings',
    'feedback',
    'support',
    'reports'
  )),
  entity_id TEXT NOT NULL CHECK (length(entity_id) <= 160),
  title TEXT NOT NULL CHECK (length(title) <= 300),
  body TEXT NOT NULL CHECK (length(body) <= 1000),
  event_key TEXT NOT NULL UNIQUE CHECK (length(event_key) <= 200),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_admin_notifications_entity
  ON admin_notifications (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_admin_notifications_created
  ON admin_notifications (created_at DESC, id DESC);

-- Per-admin read state: Admin A reading an item must NOT clear it for Admin B.
CREATE TABLE admin_notification_reads (
  notification_id TEXT NOT NULL,
  admin_user_id TEXT NOT NULL,
  read_at TEXT,
  PRIMARY KEY (notification_id, admin_user_id),
  FOREIGN KEY (notification_id) REFERENCES admin_notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_notification_reads_admin
  ON admin_notification_reads (admin_user_id, read_at);
