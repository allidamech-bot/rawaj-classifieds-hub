\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_definition text;
  v_constraint text;
  v_count bigint;
BEGIN
  IF to_regprocedure(
    'public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text,integer,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'taxonomy_mapping_queue_fetch_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_admin_review_taxonomy_mapping_v1(uuid,text,uuid,text,text,timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'taxonomy_mapping_review_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(uuid,timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'taxonomy_mapping_apply_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_apply_legacy_attribute_patch_v1(uuid,uuid,text,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'taxonomy_mapping_attribute_patch_helper_missing';
  END IF;

  FOR v_definition IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'taxonomy_mapping_queue'
      AND column_name IN (
        'reviewed_listing_updated_at',
        'applied_by',
        'applied_at'
      )
  LOOP
    NULL;
  END LOOP;

  SELECT count(*)
    INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'taxonomy_mapping_queue'
    AND column_name IN (
      'reviewed_listing_updated_at',
      'applied_by',
      'applied_at'
    );

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'taxonomy_mapping_review_columns_missing_%', v_count;
  END IF;

  SELECT pg_get_constraintdef(constraint_row.oid)
    INTO v_constraint
  FROM pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.taxonomy_mapping_queue'::regclass
    AND constraint_row.conname = 'taxonomy_mapping_queue_status_check';

  IF v_constraint IS NULL
    OR v_constraint NOT ILIKE '%rejected%'
    OR v_constraint NOT ILIKE '%applied%' THEN
    RAISE EXCEPTION 'taxonomy_mapping_status_constraint_invalid: %', v_constraint;
  END IF;

  SELECT pg_get_constraintdef(constraint_row.oid)
    INTO v_constraint
  FROM pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.taxonomy_mapping_queue'::regclass
    AND constraint_row.conname = 'taxonomy_mapping_queue_applied_metadata_check';

  IF v_constraint IS NULL
    OR v_constraint NOT ILIKE '%applied_by IS NOT NULL%'
    OR v_constraint NOT ILIKE '%applied_at IS NOT NULL%' THEN
    RAISE EXCEPTION 'taxonomy_mapping_applied_metadata_constraint_invalid: %', v_constraint;
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_admin_review_taxonomy_mapping_v1(uuid,text,uuid,text,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(uuid,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'taxonomy_mapping_rpcs_executable_by_anon';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_admin_review_taxonomy_mapping_v1(uuid,text,uuid,text,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(uuid,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'taxonomy_mapping_rpcs_missing_authenticated_execute';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_apply_legacy_attribute_patch_v1(uuid,uuid,text,jsonb)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_apply_legacy_attribute_patch_v1(uuid,uuid,text,jsonb)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'taxonomy_mapping_internal_patch_helper_exposed';
  END IF;

  IF COALESCE(
    has_table_privilege('anon', 'public.taxonomy_mapping_queue', 'SELECT'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.taxonomy_mapping_queue', 'SELECT'),
    false
  ) OR COALESCE(
    has_table_privilege('anon', 'public.taxonomy_mapping_queue', 'UPDATE'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.taxonomy_mapping_queue', 'UPDATE'),
    false
  ) THEN
    RAISE EXCEPTION 'taxonomy_mapping_queue_direct_client_access_exposed';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row
    ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'rawaj_admin_fetch_taxonomy_mapping_queue_v1',
      'rawaj_admin_review_taxonomy_mapping_v1',
      'rawaj_apply_legacy_attribute_patch_v1',
      'rawaj_owner_apply_confirmed_taxonomy_mapping_v1'
    )
    AND (
      NOT procedure_row.prosecdef
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_mapping_rpc_security_configuration_invalid_%', v_count;
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_admin_review_taxonomy_mapping_v1(uuid,text,uuid,text,text,timestamp with time zone)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%stale_taxonomy_mapping_review%'
    OR v_definition NOT ILIKE '%taxonomy_mapping_target_category_mismatch%'
    OR v_definition NOT ILIKE '%taxonomy.mapping_confirmed%'
    OR v_definition NOT ILIKE '%taxonomy.mapping_rejected%'
    OR v_definition ILIKE '%insert into public.listing_taxonomy_assignments%' THEN
    RAISE EXCEPTION 'taxonomy_mapping_review_definition_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(uuid,timestamp with time zone)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%taxonomy_mapping_version_not_published%'
    OR v_definition NOT ILIKE '%listing_changed_after_taxonomy_review%'
    OR v_definition NOT ILIKE '%insert into public.listing_taxonomy_assignments%'
    OR v_definition NOT ILIKE '%taxonomy.mapping_applied%' THEN
    RAISE EXCEPTION 'taxonomy_mapping_apply_definition_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_apply_legacy_attribute_patch_v1(uuid,uuid,text,jsonb)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%not exists%listing_attribute_values existing_row%'
    OR v_definition ILIKE '%delete from public.listing_attribute_values%' THEN
    RAISE EXCEPTION 'taxonomy_mapping_patch_merge_only_contract_invalid';
  END IF;

  RAISE NOTICE 'RAWAJ taxonomy mapping review/apply verification passed: private queue, stale review, publication gate, audit, and merge-only patches are active.';
END;
$verification$;

SELECT
  procedure_row.proname,
  procedure_row.prosecdef,
  procedure_row.provolatile,
  procedure_row.proconfig
FROM pg_proc procedure_row
JOIN pg_namespace namespace_row
  ON namespace_row.oid = procedure_row.pronamespace
WHERE namespace_row.nspname = 'public'
  AND procedure_row.proname IN (
    'rawaj_admin_fetch_taxonomy_mapping_queue_v1',
    'rawaj_admin_review_taxonomy_mapping_v1',
    'rawaj_apply_legacy_attribute_patch_v1',
    'rawaj_owner_apply_confirmed_taxonomy_mapping_v1'
  )
ORDER BY procedure_row.proname;
