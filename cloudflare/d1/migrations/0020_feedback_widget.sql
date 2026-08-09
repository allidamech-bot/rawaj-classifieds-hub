PRAGMA foreign_keys = ON;

-- User-feedback feature flag is deliberately separate from emergency system controls.
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY CHECK (key IN ('feedback_widget_enabled')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  reason TEXT NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO feature_flags (key, enabled, reason, version, updated_by, updated_at)
VALUES ('feedback_widget_enabled', 0, '', 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE user_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  type TEXT NOT NULL CHECK (type IN ('complaint', 'suggestion', 'technical_issue', 'other')),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 4 AND 160),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 3000),
  context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json)),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT,
  admin_note TEXT,
  public_response TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_user_feedback_status_created
  ON user_feedback (status, priority, created_at DESC, id DESC);
CREATE INDEX idx_user_feedback_user_created
  ON user_feedback (user_id, created_at DESC, id DESC);
