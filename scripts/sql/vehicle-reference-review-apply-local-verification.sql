\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_definition text;
  v_constraint text;
  v_count bigint;
BEGIN
  IF to_regprocedure(
    'public.rawaj_admin_fetch_vehicle_reference_queue_v1(text,text,integer,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'vehicle_reference_queue_fetch_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text,timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'vehicle_reference_review_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_owner_create_vehicle_reference_from_queue_v1(uuid,jsonb,text,timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'vehicle_reference_create_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_set_vehicle_attribute_if_absent_v1(uuid,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'vehicle_reference_attribute_helper_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_owner_apply_vehicle_reference_resolution_v1(uuid,timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'vehicle_reference_apply_rpc_missing';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'vehicle_reference_review_queue'
    AND column_name IN (
      'reviewed_listing_updated_at',
      'applied_by',
      'applied_at'
    );

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'vehicle_reference_review_columns_missing_%', v_count;
  END IF;

  SELECT pg_get_constraintdef(constraint_row.oid)
    INTO v_constraint
  FROM pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.vehicle_reference_review_queue'::regclass
    AND constraint_row.conname = 'vehicle_reference_review_queue_status_check';

  IF v_constraint IS NULL
    OR v_constraint NOT ILIKE '%matched%'
    OR v_constraint NOT ILIKE '%created%'
    OR v_constraint NOT ILIKE '%rejected%'
    OR v_constraint NOT ILIKE '%applied%' THEN
    RAISE EXCEPTION 'vehicle_reference_status_constraint_invalid: %', v_constraint;
  END IF;

  SELECT pg_get_constraintdef(constraint_row.oid)
    INTO v_constraint
  FROM pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.vehicle_reference_review_queue'::regclass
    AND constraint_row.conname = 'vehicle_reference_review_queue_applied_metadata_check';

  IF v_constraint IS NULL
    OR v_constraint NOT ILIKE '%applied_by IS NOT NULL%'
    OR v_constraint NOT ILIKE '%applied_at IS NOT NULL%' THEN
    RAISE EXCEPTION 'vehicle_reference_applied_metadata_constraint_invalid: %', v_constraint;
  END IF;

  IF COALESCE(
    has_table_privilege('anon', 'public.vehicle_reference_review_queue', 'SELECT'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.vehicle_reference_review_queue', 'SELECT'),
    false
  ) OR COALESCE(
    has_table_privilege('anon', 'public.vehicle_reference_review_queue', 'UPDATE'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.vehicle_reference_review_queue', 'UPDATE'),
    false
  ) THEN
    RAISE EXCEPTION 'vehicle_reference_queue_direct_client_access_exposed';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_admin_fetch_vehicle_reference_queue_v1(text,text,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_owner_create_vehicle_reference_from_queue_v1(uuid,jsonb,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_owner_apply_vehicle_reference_resolution_v1(uuid,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'vehicle_reference_rpcs_executable_by_anon';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_admin_fetch_vehicle_reference_queue_v1(text,text,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_owner_create_vehicle_reference_from_queue_v1(uuid,jsonb,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_owner_apply_vehicle_reference_resolution_v1(uuid,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'vehicle_reference_rpcs_missing_authenticated_execute';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_set_vehicle_attribute_if_absent_v1(uuid,text,text)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_set_vehicle_attribute_if_absent_v1(uuid,text,text)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'vehicle_reference_internal_attribute_helper_exposed';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row
    ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'rawaj_admin_fetch_vehicle_reference_queue_v1',
      'rawaj_admin_review_vehicle_reference_v1',
      'rawaj_owner_create_vehicle_reference_from_queue_v1',
      'rawaj_set_vehicle_attribute_if_absent_v1',
      'rawaj_owner_apply_vehicle_reference_resolution_v1'
    )
    AND (
      NOT procedure_row.prosecdef
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'vehicle_reference_rpc_security_configuration_invalid_%', v_count;
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text,timestamp with time zone)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%stale_vehicle_reference_review%'
    OR v_definition NOT ILIKE '%vehicle_reference_model_make_mismatch%'
    OR v_definition NOT ILIKE '%vehicle_reference_generation_model_mismatch%'
    OR v_definition NOT ILIKE '%vehicle_reference_trim_model_mismatch%'
    OR v_definition NOT ILIKE '%vehicle.reference_matched%'
    OR v_definition NOT ILIKE '%vehicle.reference_rejected%'
    OR v_definition ILIKE '%insert into public.listing_attribute_values%' THEN
    RAISE EXCEPTION 'vehicle_reference_review_definition_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_owner_create_vehicle_reference_from_queue_v1(uuid,jsonb,text,timestamp with time zone)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%owner_permission_required%'
    OR v_definition NOT ILIKE '%stale_vehicle_reference_creation%'
    OR v_definition NOT ILIKE '%vehicle_reference_catalog_id_or_slug_exists%'
    OR v_definition NOT ILIKE '%vehicle_reference_trim_generation_mismatch%'
    OR v_definition NOT ILIKE '%vehicle.reference_created%'
    OR v_definition ILIKE '%update public.listings%' THEN
    RAISE EXCEPTION 'vehicle_reference_creation_definition_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_owner_apply_vehicle_reference_resolution_v1(uuid,timestamp with time zone)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%listing_changed_after_vehicle_reference_review%'
    OR v_definition NOT ILIKE '%vehicle_reference_requires_published_vehicle_leaf%'
    OR v_definition NOT ILIKE '%vehicle_make%'
    OR v_definition NOT ILIKE '%vehicle_model%'
    OR v_definition NOT ILIKE '%vehicle_generation%'
    OR v_definition NOT ILIKE '%vehicle_trim%'
    OR v_definition NOT ILIKE '%vehicle.reference_applied%' THEN
    RAISE EXCEPTION 'vehicle_reference_apply_definition_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_set_vehicle_attribute_if_absent_v1(uuid,text,text)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%vehicle_reference_existing_attribute_conflict%'
    OR v_definition NOT ILIKE '%legacy_backfill%'
    OR v_definition ILIKE '%delete from public.listing_attribute_values%' THEN
    RAISE EXCEPTION 'vehicle_reference_attribute_helper_invalid';
  END IF;

  RAISE NOTICE 'RAWAJ vehicle reference review/apply verification passed: private queue, parent validation, owner creation, published Leaf gate, and conflict-safe attribute writes are active.';
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
    'rawaj_admin_fetch_vehicle_reference_queue_v1',
    'rawaj_admin_review_vehicle_reference_v1',
    'rawaj_owner_create_vehicle_reference_from_queue_v1',
    'rawaj_set_vehicle_attribute_if_absent_v1',
    'rawaj_owner_apply_vehicle_reference_resolution_v1'
  )
ORDER BY procedure_row.proname;
