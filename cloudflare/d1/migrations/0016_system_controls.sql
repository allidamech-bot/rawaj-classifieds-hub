PRAGMA foreign_keys = ON;

CREATE TABLE system_controls (
  key TEXT PRIMARY KEY CHECK (
    key IN (
      'freeze_new_listings',
      'freeze_new_messages',
      'freeze_promotions',
      'freeze_verifications',
      'maintenance_mode',
      'emergency_read_only'
    )
  ),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

INSERT INTO system_controls (key, enabled, reason, version, updated_by, updated_at)
VALUES
  ('freeze_new_listings', 0, '', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('freeze_new_messages', 0, '', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('freeze_promotions', 0, '', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('freeze_verifications', 0, '', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('maintenance_mode', 0, '', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('emergency_read_only', 0, '', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
