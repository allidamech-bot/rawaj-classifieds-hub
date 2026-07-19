\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_count bigint;
BEGIN
  IF to_regprocedure('public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text,integer,integer)') IS NULL
    OR to_regprocedure('public.rawaj_admin_review_taxonomy_mapping_v1(uuid,text,uuid,text,text)') IS NULL
    OR to_regprocedure('public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(uuid,integer)') IS NULL
    OR to_regprocedure('public.rawaj_admin_fetch_vehicle_reference_review_queue_v1(text,text,integer,integer)') IS NULL
    OR to_regprocedure('public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'taxonomy_review_queue_rpc_missing';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'rawaj_admin_fetch_taxonomy_mapping_queue_v1',
      'rawaj_admin_review_taxonomy_mapping_v1',
      'rawaj_owner_apply_confirmed_taxonomy_mappings_v1',
      'rawaj_admin_fetch_vehicle_reference_review_queue_v1',
      'rawaj_admin_review_vehicle_reference_v1'
    )
    AND (
      NOT procedure_row.prosecdef
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_review_queue_rpc_security_invalid_%', v_count;
  END IF;

  IF has_function_privilege('anon', 'public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text,integer,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.rawaj_admin_review_taxonomy_mapping_v1(uuid,text,uuid,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(uuid,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.rawaj_admin_fetch_vehicle_reference_review_queue_v1(text,text,integer,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'taxonomy_review_queue_anon_execute_leak';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text,integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_admin_review_taxonomy_mapping_v1(uuid,text,uuid,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(uuid,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_admin_fetch_vehicle_reference_review_queue_v1(text,text,integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'taxonomy_review_queue_authenticated_execute_missing';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'taxonomy_mapping_queue'
    AND column_name IN ('applied_by', 'applied_at');

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'taxonomy_review_queue_application_columns_missing_%', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
    JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
    WHERE namespace_row.nspname = 'public'
      AND table_row.relname = 'taxonomy_mapping_queue'
      AND constraint_row.conname = 'taxonomy_mapping_queue_status_check'
      AND pg_get_constraintdef(constraint_row.oid) LIKE '%applied%'
      AND pg_get_constraintdef(constraint_row.oid) LIKE '%rejected%'
  ) THEN
    RAISE EXCEPTION 'taxonomy_review_queue_terminal_statuses_missing';
  END IF;

  RAISE NOTICE 'RAWAJ taxonomy and vehicle review queue verification passed.';
END;
$verification$;

SELECT
  to_regprocedure('public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text,integer,integer)') IS NOT NULL AS taxonomy_queue_reader,
  to_regprocedure('public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(uuid,integer)') IS NOT NULL AS taxonomy_queue_apply,
  to_regprocedure('public.rawaj_admin_review_vehicle_reference_v1(uuid,text,text,text)') IS NOT NULL AS vehicle_queue_review;
