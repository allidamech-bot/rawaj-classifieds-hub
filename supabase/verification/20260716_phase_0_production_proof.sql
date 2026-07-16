-- RAWAJ Production proof bundle for the current repository release delta.
-- Read-only: this script does not apply migrations or modify Production data/schema.
-- Run from the Supabase SQL Editor after applying the separately reviewed migrations:
--   202607160002_require_listing_moderation_audit.sql
--   202607160003_enable_chat_realtime.sql
--   202607160004_harden_push_delivery_device_lifecycle.sql
--   202607160005_preserve_multi_device_push_preference.sql
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
  position(
    'when others then' IN lower(definition)
  ) > position(
    'perform public.rawaj_insert_audit_log' IN lower(definition)
  ) AS best_effort_block_follows_required_audit,
  (
    length(lower(definition))
    - length(replace(lower(definition), 'when others then', ''))
  ) / length('when others then') = 1 AS exactly_one_best_effort_exception_block
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

-- 7. Push lifecycle RPCs exist with the public signatures used by the application and worker.
WITH expected(signature) AS (
  VALUES
    ('public.rawaj_disable_push_device_v1(text,boolean)'::text),
    ('public.rawaj_mark_push_delivery_v1(uuid,boolean,text,boolean)'::text),
    ('public.rawaj_upsert_push_device_v1(text,text,text,text,text,text)'::text)
)
SELECT
  expected.signature,
  to_regprocedure(expected.signature) IS NOT NULL AS rpc_exists
FROM expected
ORDER BY expected.signature;

-- 8. Push RPC definitions contain the required queue-closing and multi-device safeguards.
WITH definitions AS (
  SELECT
    coalesce(
      pg_get_functiondef(
        to_regprocedure('public.rawaj_disable_push_device_v1(text,boolean)')
      ),
      ''
    ) AS disable_definition,
    coalesce(
      pg_get_functiondef(
        to_regprocedure('public.rawaj_mark_push_delivery_v1(uuid,boolean,text,boolean)')
      ),
      ''
    ) AS mark_definition,
    coalesce(
      pg_get_functiondef(
        to_regprocedure('public.rawaj_upsert_push_device_v1(text,text,text,text,text,text)')
      ),
      ''
    ) AS upsert_definition
)
SELECT
  position(
    'update public.notification_push_deliveries' IN lower(disable_definition)
  ) > 0 AS device_disable_closes_queue_rows,
  position(
    'push_channel_disabled' IN lower(disable_definition)
  ) > 0 AS account_channel_disable_closes_queue_rows,
  position(
    'when coalesce(p_disable_device, false) then ''failed''' IN lower(mark_definition)
  ) > 0 AS permanent_device_error_fails_current_delivery,
  position(
    'push_device_invalidated' IN lower(mark_definition)
  ) > 0 AS permanent_device_error_closes_sibling_deliveries,
  position(
    'if v_permission = ''granted'' then' IN lower(upsert_definition)
  ) > 0 AS granted_device_enables_account_channel,
  position(
    'values (v_user_id, v_permission = ''granted'')' IN lower(upsert_definition)
  ) = 0 AS denied_device_cannot_overwrite_account_channel
FROM definitions;

-- 9. Worker-only and authenticated RPC grants remain separated.
SELECT
  has_function_privilege(
    'authenticated',
    'public.rawaj_disable_push_device_v1(text,boolean)',
    'EXECUTE'
  ) AS authenticated_can_disable_own_device,
  has_function_privilege(
    'anon',
    'public.rawaj_disable_push_device_v1(text,boolean)',
    'EXECUTE'
  ) AS anonymous_can_disable_device,
  has_function_privilege(
    'service_role',
    'public.rawaj_mark_push_delivery_v1(uuid,boolean,text,boolean)',
    'EXECUTE'
  ) AS service_role_can_mark_delivery,
  has_function_privilege(
    'authenticated',
    'public.rawaj_mark_push_delivery_v1(uuid,boolean,text,boolean)',
    'EXECUTE'
  ) AS authenticated_can_mark_delivery,
  has_function_privilege(
    'authenticated',
    'public.rawaj_upsert_push_device_v1(text,text,text,text,text,text)',
    'EXECUTE'
  ) AS authenticated_can_register_own_device,
  has_function_privilege(
    'anon',
    'public.rawaj_upsert_push_device_v1(text,text,text,text,text,text)',
    'EXECUTE'
  ) AS anonymous_can_register_device;

-- 10. No inactive device may retain a non-terminal delivery after lifecycle reconciliation.
SELECT
  count(*) AS inactive_device_nonterminal_deliveries
FROM public.notification_push_deliveries delivery
JOIN public.push_devices device
  ON device.id = delivery.device_id
WHERE NOT device.active
  AND delivery.status IN ('pending', 'retry', 'processing');

-- 11. Capture aggregate account/device state without exporting user identifiers.
WITH per_account AS (
  SELECT
    device.user_id,
    count(*) FILTER (
      WHERE device.active AND device.permission_status = 'granted'
    ) AS active_granted_devices,
    count(*) FILTER (
      WHERE device.active AND device.permission_status <> 'granted'
    ) AS active_non_granted_devices,
    coalesce(preference.push_enabled, false) AS account_push_enabled
  FROM public.push_devices device
  LEFT JOIN public.notification_preferences preference
    ON preference.user_id = device.user_id
  GROUP BY device.user_id, preference.push_enabled
)
SELECT
  count(*) AS accounts_with_push_devices,
  count(*) FILTER (
    WHERE active_granted_devices > 0
  ) AS accounts_with_active_granted_devices,
  count(*) FILTER (
    WHERE active_non_granted_devices > 0
  ) AS accounts_with_active_non_granted_devices,
  count(*) FILTER (
    WHERE account_push_enabled AND active_granted_devices = 0
  ) AS push_enabled_accounts_without_active_granted_devices,
  count(*) FILTER (
    WHERE NOT account_push_enabled AND active_granted_devices > 0
  ) AS active_granted_devices_while_account_push_disabled
FROM per_account;

ROLLBACK;
