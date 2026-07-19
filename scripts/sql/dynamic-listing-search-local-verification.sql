\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_count bigint;
BEGIN
  IF to_regprocedure(
    'public.rawaj_public_listing_facets_v1(text[],jsonb,uuid,numeric,numeric,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'dynamic_listing_facets_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_public_listing_search_page_v1(text[],jsonb,uuid,uuid[],numeric,numeric,text,text,text,boolean,text,jsonb,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'dynamic_listing_search_page_rpc_missing';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_public_listing_facets_v1(text[],jsonb,uuid,numeric,numeric,text)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_public_listing_search_page_v1(text[],jsonb,uuid,uuid[],numeric,numeric,text,text,text,boolean,text,jsonb,integer)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'dynamic_listing_public_rpc_execute_missing';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row
    ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'rawaj_public_listing_facets_v1',
      'rawaj_public_listing_search_page_v1'
    )
    AND (
      NOT procedure_row.prosecdef
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'dynamic_listing_search_security_configuration_invalid_%', v_count;
  END IF;
END;
$verification$;

BEGIN;
SET LOCAL ROLE anon;

DO $runtime$
DECLARE
  v_facets jsonb;
  v_page jsonb;
BEGIN
  v_facets := public.rawaj_public_listing_facets_v1();
  v_page := public.rawaj_public_listing_search_page_v1();

  IF jsonb_typeof(v_facets) <> 'object'
    OR jsonb_typeof(v_facets -> 'facets') <> 'array'
    OR jsonb_typeof(v_facets -> 'totalCount') <> 'number'
  THEN
    RAISE EXCEPTION 'dynamic_listing_facets_runtime_shape_invalid: %', v_facets;
  END IF;

  IF jsonb_typeof(v_page) <> 'object'
    OR jsonb_typeof(v_page -> 'listingIds') <> 'array'
    OR jsonb_typeof(v_page -> 'totalCount') <> 'number'
  THEN
    RAISE EXCEPTION 'dynamic_listing_search_runtime_shape_invalid: %', v_page;
  END IF;

  IF (v_page ->> 'totalCount')::bigint <> (v_facets ->> 'totalCount')::bigint THEN
    RAISE EXCEPTION 'dynamic_listing_search_total_mismatch: facets %, page %',
      v_facets ->> 'totalCount',
      v_page ->> 'totalCount';
  END IF;
END;
$runtime$;

ROLLBACK;

SELECT 'RAWAJ dynamic listing facets and search verification passed.' AS result;
