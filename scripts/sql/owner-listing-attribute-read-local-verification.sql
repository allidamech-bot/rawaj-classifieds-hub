\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_definition text;
BEGIN
  IF to_regprocedure('public.rawaj_owner_fetch_listing_attributes_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'owner_listing_attribute_read_rpc_missing';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_owner_fetch_listing_attributes_v1(uuid)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'owner_listing_attribute_read_anon_execute_exposed';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_owner_fetch_listing_attributes_v1(uuid)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'owner_listing_attribute_read_authenticated_execute_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc procedure_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
    WHERE namespace_row.nspname = 'public'
      AND procedure_row.proname = 'rawaj_owner_fetch_listing_attributes_v1'
      AND (
        NOT procedure_row.prosecdef
        OR procedure_row.provolatile <> 's'
        OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
      )
  ) THEN
    RAISE EXCEPTION 'owner_listing_attribute_read_security_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_owner_fetch_listing_attributes_v1(uuid)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%listing_attribute_read_forbidden%'
    OR v_definition NOT ILIKE '%current_user_is_admin_like%'
    OR v_definition NOT ILIKE '%listing_attribute_values%'
    OR v_definition NOT ILIKE '%taxonomy_versions%'
    OR v_definition NOT ILIKE '%taxonomy_version_nodes%'
    OR v_definition NOT ILIKE '%taxonomy_field_rules%'
    OR v_definition NOT ILIKE '%jsonb_object_agg%'
    OR v_definition NOT ILIKE '%listingUpdatedAt%'
    OR v_definition NOT ILIKE '%taxonomyNodeId%'
    OR v_definition NOT ILIKE '%multi_select%'
    OR v_definition ILIKE '%filter_schema_key = ''vehicles''%'
    OR v_definition ILIKE '%update public.%'
    OR v_definition ILIKE '%insert into public.%'
    OR v_definition ILIKE '%delete from public.%' THEN
    RAISE EXCEPTION 'owner_listing_attribute_read_definition_invalid';
  END IF;

  RAISE NOTICE 'RAWAJ governed owner listing attribute hydration verification passed.';
END;
$verification$;
