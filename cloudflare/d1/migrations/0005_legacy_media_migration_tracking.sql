-- Idempotent source-to-target ledger for the Supabase-to-R2 media cutover.
-- Source identifiers are stable legacy primary keys, never display names or filenames.

PRAGMA foreign_keys = ON;

CREATE TABLE legacy_media_migrations (
  source_system TEXT NOT NULL DEFAULT 'supabase',
  entity_kind TEXT NOT NULL CHECK (
    entity_kind IN ('listing_image', 'ad_placement', 'profile_avatar', 'profile_cover')
  ),
  source_id TEXT NOT NULL,
  source_bucket TEXT,
  source_path TEXT,
  target_asset_id TEXT,
  target_object_key TEXT,
  checksum_sha256 TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'migrated', 'missing', 'invalid', 'failed', 'unresolved')
  ),
  error_code TEXT,
  attempted_at TEXT NOT NULL,
  migrated_at TEXT,
  PRIMARY KEY (source_system, entity_kind, source_id),
  FOREIGN KEY (target_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE INDEX idx_legacy_media_migrations_status
  ON legacy_media_migrations (status, entity_kind, attempted_at);

CREATE UNIQUE INDEX idx_legacy_media_migrations_target_asset
  ON legacy_media_migrations (target_asset_id)
  WHERE target_asset_id IS NOT NULL;

CREATE UNIQUE INDEX idx_legacy_media_migrations_target_object
  ON legacy_media_migrations (target_object_key)
  WHERE target_object_key IS NOT NULL;
