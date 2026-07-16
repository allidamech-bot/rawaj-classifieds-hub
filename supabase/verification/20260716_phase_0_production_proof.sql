-- RAWAJ Phase 0 Production proof bundle.
-- Read-only: this script does not apply migrations or modify Production data/schema.
-- Run from the Supabase SQL Editor after applying the separately reviewed migrations:
--   202607160002_require_listing_moderation_audit.sql
--   202607160003_enable_chat_realtime.sql
-- Retain the exported result sets with timestamp, actor, project and release commit.

BEGIN TRANSACTION READ ONLY;

-- 1. Evidence identity.
SELECT
  now() AS captured_at,
  current_database() AS database_name,
  current_user AS database_actor,
  current_setting('server_version') AS postgres_version;

-- 2. Required review RPC exists with the expected signature.
SELECT
  to_regprocedure(
    'public.rawaj_review_listing_decision(uuid,text,text,timestamptz)'
  ) IS NOT NULL AS review_rpc_exists;

-- 3. Review status change, moderation history and audit log are mandatory; only notification is
--    allowed to remain best-effort.
WITH target AS (
  SELECT pg_get_functiondef(p.oid) AS definition
  FROM pg_catalog.pg_proc p
  WHERE p.oid = to_regprocedure(
    'public.rawaj_review_listing_decision(uuid,text,text,timestamptz)'
  )
)
SELECT
  position(
    'insert into public.listing_moderation_actions' IN lower(definition)
  ) > 0 AS writes_moderation_history,
  position(
    'perform public.rawaj_insert_audit_log' IN lower(definition)
  ) > 0 AS writes_audit_log,
  position(
    'perform public.rawaj_create_notification' IN lower(definition)
  ) > position(
    'perform public.rawaj_insert_audit_log' IN lower(definition)
  ) AS notification_follows_required_audit,
  (
    length(lower(definition))
    - length(replace(lower(definition), 'exception', ''))
  ) / length('exception') = 1 AS exactly_one_best_effort_exception_block
FROM target;

-- 4. Both chat tables are members of supabase_realtime.
WITH expected(table_name) AS (
  VALUES ('conversations'::text), ('conversation_messages'::text)
)
SELECT
  expected.table_name,
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables publication_table
    WHERE publication_table.pubname = 'supabase_realtime'
      AND publication_table.schemaname = 'public'
      AND publication_table.tablename = expected.table_name
  ) AS realtime_enabled
FROM expected
ORDER BY expected.table_name;

-- 5. Chat tables retain RLS and participant-only SELECT policies.
SELECT
  namespace.nspname AS schema_name,
  relation.relname AS table_name,
  relation.relrowsecurity AS rls_enabled,
  relation.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class relation
JOIN pg_catalog.pg_namespace namespace
  ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND relation.relname IN ('conversations', 'conversation_messages')
ORDER BY relation.relname;

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'conversation_messages')
ORDER BY tablename, policyname;

-- 6. Authenticated can SELECT through RLS; anon cannot SELECT either chat table.
WITH expected(table_name) AS (
  VALUES ('conversations'::text), ('conversation_messages'::text)
)
SELECT
  expected.table_name,
  has_table_privilege(
    'authenticated',
    format('public.%I', expected.table_name),
    'SELECT'
  ) AS authenticated_select,
  has_table_privilege(
    'anon',
    format('public.%I', expected.table_name),
    'SELECT'
  ) AS anonymous_select
FROM expected
ORDER BY expected.table_name;

ROLLBACK;
