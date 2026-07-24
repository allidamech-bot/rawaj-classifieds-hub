-- Supabase Auth is the sole authentication and identity provider.
-- Legacy password/session columns remain for non-destructive rollback only and
-- are no longer read or written by the Worker.

ALTER TABLE auth_users ADD COLUMN auth_provider TEXT;
ALTER TABLE auth_users ADD COLUMN auth_user_id TEXT;

UPDATE auth_users
SET auth_provider = 'supabase',
    auth_user_id = id
WHERE auth_provider IS NULL
  AND auth_user_id IS NULL;

CREATE UNIQUE INDEX idx_auth_users_provider_identity
  ON auth_users (auth_provider, auth_user_id)
  WHERE auth_provider IS NOT NULL AND auth_user_id IS NOT NULL;

CREATE INDEX idx_auth_users_supabase_identity
  ON auth_users (auth_user_id)
  WHERE auth_provider = 'supabase';
