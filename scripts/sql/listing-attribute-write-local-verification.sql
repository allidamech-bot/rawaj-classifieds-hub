\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_policy text;
  v_count bigint;
BEGIN
  IF to_regprocedure('public.rawaj_listing_attribute_completeness_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'listing_attribute_completeness_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_owner_replace_listing_attributes_v1(uuid,timestamp with time zone,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'listing_attribute_replace_rpc_missing';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_listing_attribute_completeness_v1(uuid)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_owner_replace_listing_attributes_v1(uuid,timestamp with time zone,jsonb)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'listing_attribute_rpcs_executable_by_anon';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_listing_attribute_completeness_v1(uuid)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_owner_replace_listing_attributes_v1(uuid,timestamp with time zone,jsonb)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'listing_attribute_rpcs_missing_authenticated_execute';
  END IF;

  IF COALESCE(
    has_table_privilege('anon', 'public.listing_attribute_values', 'INSERT'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.listing_attribute_values', 'INSERT'),
    false
  ) OR COALESCE(
    has_table_privilege('anon', 'public.listing_attribute_values', 'UPDATE'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.listing_attribute_values', 'UPDATE'),
    false
  ) OR COALESCE(
    has_table_privilege('anon', 'public.listing_attribute_values', 'DELETE'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.listing_attribute_values', 'DELETE'),
    false
  ) THEN
    RAISE EXCEPTION 'listing_attribute_table_direct_client_write_exposed';
  END IF;

  SELECT qual
    INTO v_policy
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'listing_attribute_values'
    AND policyname = 'listing_attribute_values_public_read';

  IF v_policy IS NULL
    OR v_policy NOT ILIKE '%status = ''approved''%'
    OR v_policy NOT ILIKE '%archived_at IS NULL%'
    OR v_policy NOT ILIKE '%expires_at IS NULL%'
    OR v_policy NOT ILIKE '%expires_at > now()%'
    OR v_policy NOT ILIKE '%NOT field_row.is_sensitive%' THEN
    RAISE EXCEPTION 'listing_attribute_public_policy_visibility_contract_invalid: %', v_policy;
  END IF;

  SELECT qual
    INTO v_policy
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'listing_attribute_values'
    AND policyname = 'listing_attribute_values_owner_read';

  IF v_policy IS NULL
    OR v_policy NOT ILIKE '%owner_id = ( SELECT auth.uid()%'
  THEN
    RAISE EXCEPTION 'listing_attribute_owner_policy_contract_invalid: %', v_policy;
  END IF;

  SELECT qual
    INTO v_policy
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'listing_attribute_values'
    AND policyname = 'listing_attribute_values_admin_read';

  IF v_policy IS NULL
    OR v_policy NOT ILIKE '%current_user_is_admin_like()%'
  THEN
    RAISE EXCEPTION 'listing_attribute_admin_policy_contract_invalid: %', v_policy;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'listing_attribute_values'
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    AND (
      'anon' = ANY(roles)
      OR 'authenticated' = ANY(roles)
      OR 'public' = ANY(roles)
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'listing_attribute_direct_client_write_policies_found_%', v_count;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row
    ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'rawaj_listing_attribute_completeness_v1',
      'rawaj_owner_replace_listing_attributes_v1'
    )
    AND (
      NOT procedure_row.prosecdef
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'listing_attribute_rpc_security_configuration_invalid_%', v_count;
  END IF;

  RAISE NOTICE 'RAWAJ listing attribute write verification passed: governed RPCs and visibility policies are active.';
END;
$verification$;

SELECT
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'listing_attribute_values'
ORDER BY policyname;
