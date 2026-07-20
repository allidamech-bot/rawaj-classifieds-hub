\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_definition text;
  v_count bigint;
BEGIN
  IF to_regprocedure('public.rawaj_submit_listing_for_review(uuid)') IS NULL THEN
    RAISE EXCEPTION 'dynamic_listing_submit_rpc_missing';
  END IF;

  IF to_regprocedure('public.rawaj_listing_attribute_completeness_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'dynamic_listing_completeness_rpc_missing';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_submit_listing_for_review(uuid)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%version_row.status = ''published''%'
    OR v_definition NOT ILIKE '%taxonomy_field_rules%'
    OR v_definition NOT ILIKE '%listing_published_taxonomy_leaf_required%'
    OR v_definition NOT ILIKE '%rawaj_listing_attribute_completeness_v1%'
    OR v_definition NOT ILIKE '%listing_attributes_incomplete%'
    OR v_definition NOT ILIKE '%missingRequiredFields%'
    OR v_definition NOT ILIKE '%status = ''pending_review''%' THEN
    RAISE EXCEPTION 'dynamic_listing_submit_definition_invalid';
  END IF;

  IF position('rawaj_listing_attribute_completeness_v1' in v_definition)
    >= position('status = ''pending_review''' in v_definition) THEN
    RAISE EXCEPTION 'dynamic_listing_submit_completeness_runs_after_status_change';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row
    ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname = 'rawaj_submit_listing_for_review'
    AND (
      NOT procedure_row.prosecdef
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'dynamic_listing_submit_security_configuration_invalid';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_submit_listing_for_review(uuid)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'dynamic_listing_submit_executable_by_anon';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_submit_listing_for_review(uuid)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'dynamic_listing_submit_missing_authenticated_execute';
  END IF;

  RAISE NOTICE 'RAWAJ dynamic listing submit verification passed: current behavior is preserved until governed fields are published, then Leaf and required attributes are enforced before status mutation.';
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
  AND procedure_row.proname = 'rawaj_submit_listing_for_review';
