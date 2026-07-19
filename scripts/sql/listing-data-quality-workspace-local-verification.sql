\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_count bigint;
  v_definition text;
  v_missing_roots bigint;
BEGIN
  IF to_regclass('public.listing_data_quality_issues') IS NULL THEN
    RAISE EXCEPTION 'listing_data_quality_issues_table_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_owner_refresh_listing_data_quality_v1(uuid,integer,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'listing_data_quality_refresh_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_admin_fetch_listing_data_quality_v1(text,text,text,text,integer,integer)'
  ) IS NULL THEN
    RAISE EXCEPTION 'listing_data_quality_fetch_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_admin_review_listing_data_quality_v1(uuid,text,text,timestamp with time zone)'
  ) IS NULL THEN
    RAISE EXCEPTION 'listing_data_quality_review_rpc_missing';
  END IF;

  IF to_regprocedure(
    'public.rawaj_upsert_listing_data_quality_issue_v1(uuid,uuid,text,text,text,text,text,text,text,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'listing_data_quality_internal_upsert_missing';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'listing_data_quality_issues'
    AND column_name IN (
      'listing_id',
      'taxonomy_version_id',
      'taxonomy_node_id',
      'category_id',
      'subcategory_id',
      'field_key',
      'issue_type',
      'issue_code',
      'severity',
      'status',
      'evidence',
      'reviewed_by',
      'reviewed_at',
      'review_note',
      'resolved_at'
    );

  IF v_count <> 15 THEN
    RAISE EXCEPTION 'listing_data_quality_columns_missing_%', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class table_row
    JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
    WHERE namespace_row.nspname = 'public'
      AND table_row.relname = 'listing_data_quality_issues'
      AND table_row.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_rls_not_enabled';
  END IF;

  IF COALESCE(
    has_table_privilege('anon', 'public.listing_data_quality_issues', 'SELECT'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.listing_data_quality_issues', 'SELECT'),
    false
  ) OR COALESCE(
    has_table_privilege('authenticated', 'public.listing_data_quality_issues', 'UPDATE'),
    false
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_direct_client_access_exposed';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_owner_refresh_listing_data_quality_v1(uuid,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_admin_fetch_listing_data_quality_v1(text,text,text,text,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_admin_review_listing_data_quality_v1(uuid,text,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_rpcs_executable_by_anon';
  END IF;

  IF NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_owner_refresh_listing_data_quality_v1(uuid,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_admin_fetch_listing_data_quality_v1(text,text,text,text,integer,integer)',
      'EXECUTE'
    ),
    false
  ) OR NOT COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_admin_review_listing_data_quality_v1(uuid,text,text,timestamp with time zone)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_authenticated_execute_missing';
  END IF;

  IF COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_upsert_listing_data_quality_issue_v1(uuid,uuid,text,text,text,text,text,text,text,jsonb)',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_upsert_listing_data_quality_issue_v1(uuid,uuid,text,text,text,text,text,text,text,jsonb)',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'listing_data_quality_internal_upsert_exposed';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_proc procedure_row
  JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND procedure_row.proname IN (
      'rawaj_owner_refresh_listing_data_quality_v1',
      'rawaj_admin_fetch_listing_data_quality_v1',
      'rawaj_admin_review_listing_data_quality_v1',
      'rawaj_upsert_listing_data_quality_issue_v1'
    )
    AND (
      NOT procedure_row.prosecdef
      OR NOT ('search_path=public, pg_temp' = ANY(procedure_row.proconfig))
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'listing_data_quality_rpc_security_configuration_invalid_%', v_count;
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_owner_refresh_listing_data_quality_v1(uuid,integer,integer)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%taxonomy_field_rules%'
    OR v_definition NOT ILIKE '%option_values%'
    OR v_definition NOT ILIKE '%required_field_missing%'
    OR v_definition NOT ILIKE '%field_not_allowed_for_leaf%'
    OR v_definition NOT ILIKE '%controlled_option_invalid%'
    OR v_definition NOT ILIKE '%numeric_value_out_of_range%'
    OR v_definition NOT ILIKE '%text_value_too_long%'
    OR v_definition NOT ILIKE '%legacy_details_require_mapping%'
    OR v_definition ILIKE '%update public.listings%'
    OR v_definition ILIKE '%delete from public.listing_attribute_values%'
    OR v_definition ILIKE '%insert into public.listing_attribute_values%' THEN
    RAISE EXCEPTION 'listing_data_quality_refresh_definition_invalid';
  END IF;

  SELECT pg_get_functiondef(
    'public.rawaj_admin_review_listing_data_quality_v1(uuid,text,text,timestamp with time zone)'::regprocedure
  ) INTO v_definition;

  IF v_definition NOT ILIKE '%stale_data_quality_review%'
    OR v_definition NOT ILIKE '%data_quality.issue_reviewed%'
    OR v_definition ILIKE '%update public.listings%'
    OR v_definition ILIKE '%listing_attribute_values%' THEN
    RAISE EXCEPTION 'listing_data_quality_review_definition_invalid';
  END IF;

  WITH draft_version AS (
    SELECT version_row.id
    FROM public.taxonomy_versions version_row
    WHERE version_row.status = 'draft'
    ORDER BY version_row.version_number DESC
    LIMIT 1
  ),
  recursive_tree AS (
    SELECT
      root_row.version_id,
      root_row.node_id AS root_node_id,
      root_row.node_id,
      root_row.legacy_category_id
    FROM public.taxonomy_version_nodes root_row
    JOIN draft_version ON draft_version.id = root_row.version_id
    WHERE root_row.parent_node_id IS NULL
      AND root_row.is_active

    UNION ALL

    SELECT
      child_row.version_id,
      recursive_tree.root_node_id,
      child_row.node_id,
      recursive_tree.legacy_category_id
    FROM recursive_tree
    JOIN public.taxonomy_version_nodes child_row
      ON child_row.version_id = recursive_tree.version_id
     AND child_row.parent_node_id = recursive_tree.node_id
    WHERE child_row.is_active
  ),
  covered_categories AS (
    SELECT DISTINCT recursive_tree.legacy_category_id
    FROM recursive_tree
    JOIN public.taxonomy_version_nodes leaf_row
      ON leaf_row.version_id = recursive_tree.version_id
     AND leaf_row.node_id = recursive_tree.node_id
     AND leaf_row.is_leaf
     AND leaf_row.is_active
    WHERE recursive_tree.legacy_category_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.taxonomy_field_rules rule_row
        WHERE rule_row.version_id = leaf_row.version_id
          AND rule_row.taxonomy_node_id = leaf_row.node_id
      )
  )
  SELECT count(*)
    INTO v_missing_roots
  FROM public.categories category_row
  WHERE category_row.is_active
    AND NOT EXISTS (
      SELECT 1
      FROM covered_categories covered_row
      WHERE covered_row.legacy_category_id = category_row.id
    );

  IF v_missing_roots <> 0 THEN
    RAISE EXCEPTION 'listing_data_quality_category_field_coverage_missing_%', v_missing_roots;
  END IF;

  RAISE NOTICE 'RAWAJ cross-category listing data quality verification passed: every active category is covered by governed leaf fields and review-only quality RPCs.';
END;
$verification$;

SELECT
  procedure_row.proname,
  procedure_row.prosecdef,
  procedure_row.provolatile,
  procedure_row.proconfig
FROM pg_proc procedure_row
JOIN pg_namespace namespace_row ON namespace_row.oid = procedure_row.pronamespace
WHERE namespace_row.nspname = 'public'
  AND procedure_row.proname IN (
    'rawaj_owner_refresh_listing_data_quality_v1',
    'rawaj_admin_fetch_listing_data_quality_v1',
    'rawaj_admin_review_listing_data_quality_v1',
    'rawaj_upsert_listing_data_quality_issue_v1'
  )
ORDER BY procedure_row.proname;
