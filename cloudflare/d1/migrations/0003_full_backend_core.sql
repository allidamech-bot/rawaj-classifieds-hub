-- RAWAJ permanent Cloudflare backend foundation.
-- This migration is the write-side system of record, not an emergency or read-only layer.

PRAGMA foreign_keys = ON;

ALTER TABLE public_profiles ADD COLUMN email TEXT;
ALTER TABLE public_profiles ADD COLUMN phone TEXT;
ALTER TABLE public_profiles ADD COLUMN whatsapp TEXT;
ALTER TABLE public_profiles ADD COLUMN preferred_contact_method TEXT;
ALTER TABLE public_profiles ADD COLUMN profile_version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX idx_public_profiles_email
  ON public_profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  password_algorithm TEXT,
  email_confirmed_at TEXT,
  disabled_at TEXT,
  last_sign_in_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (id) REFERENCES public_profiles(id) ON DELETE CASCADE
);

CREATE TABLE auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  provider_email TEXT,
  identity_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(identity_data)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_subject),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_identities_user
  ON auth_identities (user_id, provider);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent_hash TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_user_active
  ON auth_sessions (user_id, revoked_at, expires_at);

CREATE TABLE auth_one_time_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_confirmation', 'password_reset', 'email_change', 'oauth_state')),
  token_hash TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload)),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_one_time_tokens_user_purpose
  ON auth_one_time_tokens (user_id, purpose, consumed_at, expires_at);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'seller', 'user')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE listing_moderation_actions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'archive', 'restore', 'feature', 'unfeature')),
  reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_listing_moderation_actions_listing
  ON listing_moderation_actions (listing_id, created_at DESC);

CREATE TABLE favorites (
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX idx_favorites_user_created
  ON favorites (user_id, created_at DESC);

CREATE TABLE recent_listing_views (
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 1 CHECK (view_count > 0),
  PRIMARY KEY (user_id, listing_id),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX idx_recent_listing_views_user
  ON recent_listing_views (user_id, viewed_at DESC);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(query)),
  alerts_enabled INTEGER NOT NULL DEFAULT 0 CHECK (alerts_enabled IN (0, 1)),
  last_matched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_saved_searches_user
  ON saved_searches (user_id, updated_at DESC);

CREATE TABLE seller_follows (
  follower_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, seller_id),
  CHECK (follower_id <> seller_id),
  FOREIGN KEY (follower_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked', 'closed')),
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (listing_id, buyer_id, seller_id),
  CHECK (buyer_id <> seller_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  FOREIGN KEY (buyer_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_buyer
  ON conversations (buyer_id, last_message_at DESC);
CREATE INDEX idx_conversations_seller
  ON conversations (seller_id, last_message_at DESC);

CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  media_asset_id TEXT,
  delivered_at TEXT,
  read_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_conversation_messages_conversation
  ON conversation_messages (conversation_id, created_at ASC, id ASC);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data)),
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY,
  email_enabled INTEGER NOT NULL DEFAULT 1 CHECK (email_enabled IN (0, 1)),
  push_enabled INTEGER NOT NULL DEFAULT 1 CHECK (push_enabled IN (0, 1)),
  messages_enabled INTEGER NOT NULL DEFAULT 1 CHECK (messages_enabled IN (0, 1)),
  listing_updates_enabled INTEGER NOT NULL DEFAULT 1 CHECK (listing_updates_enabled IN (0, 1)),
  marketing_enabled INTEGER NOT NULL DEFAULT 0 CHECK (marketing_enabled IN (0, 1)),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE push_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  encrypted_token TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE seller_reviews (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  listing_id TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (seller_id, reviewer_id, listing_id),
  CHECK (seller_id <> reviewer_id),
  FOREIGN KEY (seller_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL
);

CREATE INDEX idx_seller_reviews_seller_status
  ON seller_reviews (seller_id, status, created_at DESC);

CREATE TABLE listing_reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_listing_reports_status
  ON listing_reports (status, created_at DESC);

CREATE TABLE user_blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE user_restrictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  restriction_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_user_restrictions_active
  ON user_restrictions (user_id, restriction_type, starts_at, ends_at);

CREATE TABLE support_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_support_requests_status
  ON support_requests (status, priority, created_at DESC);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_id) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor
  ON audit_logs (actor_id, created_at DESC);
