\set ON_ERROR_STOP on

-- RAWAJ clean-replay compatibility hook before
-- 202607080019_listing_moderation_console.sql.
--
-- The moderation action history was authored against a historical enum that
-- existed in the superseded classifieds foundation, while the canonical listing
-- table intentionally stores status as text. Recreate only the enum contract
-- required by the immutable audit table and moderation RPC signatures.

DO $compatibility$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type_row
    JOIN pg_namespace namespace_row
      ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = 'public'
      AND type_row.typname = 'rawaj_listing_status'
  ) THEN
    CREATE TYPE public.rawaj_listing_status AS ENUM (
      'draft',
      'pending_review',
      'approved',
      'rejected',
      'archived',
      'expired',
      'sold',
      'rented',
      'unavailable'
    );
  END IF;
END;
$compatibility$;

comment on type public.rawaj_listing_status is
  'Compatibility enum retained for moderation audit records and RPC return contracts; public.listings.status remains canonical text with database checks.';
