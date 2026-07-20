\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_definition text;
  v_active_categories bigint;
  v_draft_categories bigint;
BEGIN
  IF to_regprocedure('public.rawaj_admin_fetch_data_quality_context_v1()') IS NULL THEN
    RAISE EXCEPTION 'listing_data_quality_context_rpc_missing';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_admin_fetch_data_quality_context_v1()',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_context_anon_execute_exposed';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_admin_fetch_data_quality_context_v1()',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_context_authenticated_execute_missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc procedure_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
    WHERE namespace_row.nspname = 'public'
      AND procedure_row.proname = 'rawaj_admin_fetch_data_quality_context_v1'
      AND (
        NOT procedure_row.prosecdef
        OR procedure_row.provolatile <> 's'
        OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
      )
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_context_security_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_admin_fetch_data_quality_context_v1()'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%current_user_is_admin_like%'
    OR v_definition NOT ILIKE '%taxonomy_versions%'
    OR v_definition NOT ILIKE '%taxonomy_version_nodes%'
    OR v_definition NOT ILIKE '%taxonomy_field_rules%'
    OR v_definition NOT ILIKE '%listing_data_quality_issues%'
    OR v_definition NOT ILIKE '%categories%'
    OR v_definition NOT ILIKE '%status in (''draft'', ''published'')%'
    OR v_definition ILIKE '%update public.%'
    OR v_definition ILIKE '%insert into public.%'
    OR v_definition ILIKE '%delete from public.%' THEN
    RAISE EXCEPTION 'listing_data_quality_context_definition_invalid';
  END IF;

  SELECT count(*)
    INTO v_active_categories
  FROM public.categories category_row
  WHERE category_row.is_active;

  WITH RECURSIVE draft_version AS (
    SELECT version_row.id
    FROM public.taxonomy_versions version_row
    WHERE version_row.status = 'draft'
    ORDER BY version_row.version_number DESC
    LIMIT 1
  ), tree AS (
    SELECT
      root_row.version_id,
      root_row.node_id,
      root_row.legacy_category_id
    FROM public.taxonomy_version_nodes root_row
    JOIN draft_version ON draft_version.id = root_row.version_id
    WHERE root_row.parent_node_id IS NULL
      AND root_row.is_active

    UNION ALL

    SELECT
      child_row.version_id,
      child_row.node_id,
      tree.legacy_category_id
    FROM tree
    JOIN public.taxonomy_version_nodes child_row
      ON child_row.version_id = tree.version_id
     AND child_row.parent_node_id = tree.node_id
    WHERE child_row.is_active
  )
  SELECT count(distinct tree.legacy_category_id)
    INTO v_draft_categories
  FROM tree
  JOIN public.taxonomy_version_nodes leaf_row
    ON leaf_row.version_id = tree.version_id
   AND leaf_row.node_id = tree.node_id
   AND leaf_row.is_active
   AND leaf_row.is_leaf
  WHERE tree.legacy_category_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.taxonomy_field_rules rule_row
      WHERE rule_row.version_id = leaf_row.version_id
        AND rule_row.taxonomy_node_id = leaf_row.node_id
    );

  IF v_draft_categories <> v_active_categories THEN
    RAISE EXCEPTION 'listing_data_quality_context_category_coverage_%_of_%',
      v_draft_categories,
      v_active_categories;
  END IF;

  RAISE NOTICE 'RAWAJ data quality context verification passed for % active categories.',
    v_active_categories;
END;
$verification$;
