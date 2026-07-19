\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_payload jsonb;
  v_leaf_id text;
  v_count bigint;
BEGIN
  IF to_regprocedure('public.rawaj_fetch_published_taxonomy_v1()') IS NULL
    OR to_regprocedure('public.rawaj_fetch_published_leaf_schema_v1(text)') IS NULL
    OR to_regprocedure('public.rawaj_fetch_vehicle_makes_v1(text,integer)') IS NULL
    OR to_regprocedure('public.rawaj_fetch_vehicle_models_v1(text,text,integer,integer)') IS NULL
    OR to_regprocedure('public.rawaj_fetch_vehicle_model_children_v1(text,integer)') IS NULL THEN
    RAISE EXCEPTION 'taxonomy_metadata_api_function_missing';
  END IF;

  v_payload := public.rawaj_fetch_published_taxonomy_v1();

  IF v_payload -> 'version' IS NULL
    OR jsonb_typeof(v_payload -> 'version') <> 'object'
    OR jsonb_typeof(v_payload -> 'nodes') <> 'array'
    OR jsonb_array_length(v_payload -> 'nodes') = 0 THEN
    RAISE EXCEPTION 'published_taxonomy_api_invalid_payload: %', v_payload;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload -> 'nodes') node_row
    WHERE node_row ->> 'id' = 'mobiles-phones'
  ) THEN
    RAISE EXCEPTION 'published_taxonomy_api_exposed_v2_draft_node';
  END IF;

  v_payload := public.rawaj_fetch_published_leaf_schema_v1('mobiles-phones');
  IF COALESCE((v_payload ->> 'found')::boolean, false) THEN
    RAISE EXCEPTION 'published_leaf_schema_api_exposed_v2_draft_leaf';
  END IF;

  SELECT node_row.node_id
    INTO v_leaf_id
  FROM public.taxonomy_versions version_row
  JOIN public.taxonomy_version_nodes node_row
    ON node_row.version_id = version_row.id
  WHERE version_row.status = 'published'
    AND node_row.is_active
    AND node_row.is_leaf
  ORDER BY node_row.depth, node_row.sort_order, node_row.node_id
  LIMIT 1;

  IF v_leaf_id IS NOT NULL THEN
    v_payload := public.rawaj_fetch_published_leaf_schema_v1(v_leaf_id);
    IF NOT COALESCE((v_payload ->> 'found')::boolean, false)
      OR v_payload #>> '{leaf,id}' <> v_leaf_id
      OR jsonb_typeof(v_payload -> 'fields') <> 'array'
      OR jsonb_typeof(v_payload -> 'conditionalRules') <> 'array' THEN
      RAISE EXCEPTION 'published_leaf_schema_api_invalid_payload_for_%: %', v_leaf_id, v_payload;
    END IF;
  END IF;

  v_payload := public.rawaj_fetch_vehicle_makes_v1('تويوتا', 10);
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload -> 'items') make_row
    WHERE make_row ->> 'id' = 'toyota'
  ) THEN
    RAISE EXCEPTION 'vehicle_make_api_missing_toyota_alias_match: %', v_payload;
  END IF;

  v_payload := public.rawaj_fetch_vehicle_models_v1('toyota', 'Kamri', null, 10);
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload -> 'items') model_row
    WHERE model_row ->> 'id' = 'toyota-camry'
      AND model_row ->> 'makeId' = 'toyota'
  ) THEN
    RAISE EXCEPTION 'vehicle_model_api_missing_camry_alias_match: %', v_payload;
  END IF;

  -- Real catalog rows may intentionally have unknown year bounds. Add two
  -- disposable bounded fixtures so the optional year predicate is exercised
  -- without treating unknown bounds as invalid data.
  INSERT INTO public.vehicle_makes (
    id, slug, name_ar, name_en, aliases, country_code, sort_order
  ) VALUES (
    'rawaj-verification',
    'rawaj-verification',
    'اختبار رواج',
    'RAWAJ Verification',
    ARRAY['RAWAJ Verification'],
    'SY',
    999990
  );

  INSERT INTO public.vehicle_models (
    id, make_id, slug, name_ar, name_en, aliases, vehicle_type,
    start_year, end_year, sort_order
  ) VALUES
    (
      'rawaj-verification-legacy',
      'rawaj-verification',
      'legacy',
      'قديم',
      'Legacy',
      ARRAY['Legacy'],
      'sedan',
      1990,
      1999,
      10
    ),
    (
      'rawaj-verification-modern',
      'rawaj-verification',
      'modern',
      'حديث',
      'Modern',
      ARRAY['Modern'],
      'sedan',
      2020,
      2030,
      20
    );

  v_payload := public.rawaj_fetch_vehicle_models_v1(
    'rawaj-verification',
    null,
    1995,
    300
  );
  IF jsonb_array_length(v_payload -> 'items') <> 1
    OR v_payload #>> '{items,0,id}' <> 'rawaj-verification-legacy' THEN
    RAISE EXCEPTION 'vehicle_model_api_year_filter_invalid_for_1995: %', v_payload;
  END IF;

  v_payload := public.rawaj_fetch_vehicle_models_v1(
    'rawaj-verification',
    null,
    2025,
    300
  );
  IF jsonb_array_length(v_payload -> 'items') <> 1
    OR v_payload #>> '{items,0,id}' <> 'rawaj-verification-modern' THEN
    RAISE EXCEPTION 'vehicle_model_api_year_filter_invalid_for_2025: %', v_payload;
  END IF;

  DELETE FROM public.vehicle_models
  WHERE make_id = 'rawaj-verification';
  DELETE FROM public.vehicle_makes
  WHERE id = 'rawaj-verification';

  v_payload := public.rawaj_fetch_vehicle_model_children_v1('toyota-camry', null);
  IF NOT COalesce((v_payload ->> 'found')::boolean, false)
    OR v_payload #>> '{model,id}' <> 'toyota-camry'
    OR jsonb_typeof(v_payload -> 'generations') <> 'array'
    OR jsonb_typeof(v_payload -> 'trims') <> 'array' THEN
    RAISE EXCEPTION 'vehicle_model_children_api_invalid_payload: %', v_payload;
  END IF;

  v_payload := public.rawaj_fetch_vehicle_model_children_v1('unknown-model', null);
  IF COALESCE((v_payload ->> 'found')::boolean, false) THEN
    RAISE EXCEPTION 'vehicle_model_children_api_found_unknown_model';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row
    ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'rawaj_fetch_published_taxonomy_v1',
      'rawaj_fetch_published_leaf_schema_v1',
      'rawaj_fetch_vehicle_makes_v1',
      'rawaj_fetch_vehicle_models_v1',
      'rawaj_fetch_vehicle_model_children_v1'
    )
    AND (
      NOT procedure_row.prosecdef
      OR procedure_row.provolatile <> 's'
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_metadata_api_security_or_volatility_invalid_%', v_count;
  END IF;

  IF NOT has_function_privilege('anon', 'public.rawaj_fetch_published_taxonomy_v1()', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_fetch_published_taxonomy_v1()', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.rawaj_fetch_published_leaf_schema_v1(text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_fetch_published_leaf_schema_v1(text)', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.rawaj_fetch_vehicle_makes_v1(text,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_fetch_vehicle_makes_v1(text,integer)', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.rawaj_fetch_vehicle_models_v1(text,text,integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_fetch_vehicle_models_v1(text,text,integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('anon', 'public.rawaj_fetch_vehicle_model_children_v1(text,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.rawaj_fetch_vehicle_model_children_v1(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'taxonomy_metadata_api_execute_grants_invalid';
  END IF;

  RAISE NOTICE 'RAWAJ taxonomy metadata API verification passed: published-only tree, leaf schema, and dependent vehicle lookups are valid.';
END;
$verification$;

SELECT
  public.rawaj_fetch_published_taxonomy_v1() #>> '{version,number}' AS published_version,
  jsonb_array_length(public.rawaj_fetch_published_taxonomy_v1() -> 'nodes') AS published_nodes,
  jsonb_array_length(public.rawaj_fetch_vehicle_makes_v1(null, 200) -> 'items') AS active_vehicle_makes;
