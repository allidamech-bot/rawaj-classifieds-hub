-- Private R2 chat media and message moderation foundation.
PRAGMA foreign_keys = OFF;

CREATE TABLE conversation_messages_v2 (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio', 'system')),
  media_asset_id TEXT,
  media_duration_ms INTEGER CHECK (media_duration_ms IS NULL OR media_duration_ms BETWEEN 0 AND 120000),
  client_request_id TEXT,
  delivered_at TEXT,
  read_at TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

INSERT INTO conversation_messages_v2 (
  id, conversation_id, sender_id, body, message_type, media_asset_id,
  media_duration_ms, client_request_id, delivered_at, read_at, edited_at, deleted_at, created_at
)
SELECT id, conversation_id, sender_id, body, message_type, media_asset_id,
       NULL, client_request_id, delivered_at, read_at, NULL, deleted_at, created_at
  FROM conversation_messages;

DROP TABLE conversation_messages;
ALTER TABLE conversation_messages_v2 RENAME TO conversation_messages;

CREATE INDEX idx_conversation_messages_conversation
  ON conversation_messages (conversation_id, created_at ASC, id ASC);
CREATE UNIQUE INDEX idx_conversation_messages_sender_request
  ON conversation_messages (sender_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE INDEX idx_conversation_messages_unread
  ON conversation_messages (conversation_id, read_at, sender_id, created_at);

PRAGMA foreign_keys = ON;

CREATE TABLE chat_media_assets (
  asset_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio')),
  duration_ms INTEGER CHECK (
    (kind = 'image' AND duration_ms IS NULL) OR
    (kind = 'audio' AND duration_ms BETWEEN 1000 AND 120000)
  ),
  client_request_id TEXT NOT NULL,
  linked_message_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_message_id) REFERENCES conversation_messages(id) ON DELETE SET NULL,
  UNIQUE (uploader_id, client_request_id)
);

CREATE INDEX idx_chat_media_conversation
  ON chat_media_assets (conversation_id, created_at DESC);
CREATE INDEX idx_chat_media_unlinked
  ON chat_media_assets (uploader_id, linked_message_id, created_at);

CREATE TABLE message_reports (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  conversation_id TEXT,
  reporter_user_id TEXT NOT NULL,
  reported_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'resolved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES conversation_messages(id) ON DELETE SET NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  FOREIGN KEY (reporter_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  UNIQUE (message_id, reporter_user_id)
);

CREATE INDEX idx_message_reports_status
  ON message_reports (status, created_at DESC);
CREATE INDEX idx_message_reports_reported_user
  ON message_reports (reported_user_id, created_at DESC);
