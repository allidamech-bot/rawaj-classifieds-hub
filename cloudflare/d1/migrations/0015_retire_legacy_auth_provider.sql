-- Retire the former provider label while preserving imported application identities.
-- Firebase remains the only active authentication provider.

UPDATE auth_users
SET auth_provider = 'legacy_import'
WHERE auth_provider = 'supabase';

DROP INDEX IF EXISTS idx_auth_users_supabase_identity;

CREATE INDEX IF NOT EXISTS idx_auth_users_legacy_import_identity
  ON auth_users (auth_user_id)
  WHERE auth_provider = 'legacy_import';
