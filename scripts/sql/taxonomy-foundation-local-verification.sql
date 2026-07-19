\set ON_ERROR_STOP on

DO $verification$
DECLARE
  v_published_version_id uuid;
  v_draft_version_id uuid;
  v_count bigint;
BEGIN
  IF to_regclass('public.taxonomy_versions') IS NULL
    OR to_regclass('public.taxonomy_version_nodes') IS NULL
    OR to_regclass('public.taxonomy_field_rules') IS NULL
    OR to_regclass('public.taxonomy_legacy_mappings') IS NULL
    OR to_regclass('public.listing_attribute_values') IS NULL
    OR to_regclass('public.vehicle_makes') IS NULL
    OR to_regclass('public.vehicle_models') IS NULL
    OR to_regclass('public.vehicle_reference_review_queue') IS NULL THEN
    RAISE EXCEPTION 'taxonomy_foundation_required_tables_missing';
  END IF;

  SELECT count(*), min(id)
    INTO v_count, v_published_version_id
  FROM public.taxonomy_versions
  WHERE status = 'published';

  IF v_count <> 1 OR v_published_version_id IS NULL THEN
    RAISE EXCEPTION 'taxonomy_foundation_requires_exactly_one_published_version: %', v_count;
  END IF;

  SELECT id
    INTO v_draft_version_id
  FROM public.taxonomy_versions
  WHERE version_number = 2
    AND status = 'draft';

  IF v_draft_version_id IS NULL THEN
    RAISE EXCEPTION 'taxonomy_v2_draft_missing_or_published_implicitly';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM public.taxonomy_version_nodes
  WHERE version_id = v_draft_version_id
    AND parent_node_id IS NULL
    AND is_active;

  IF v_count <> 13 THEN
    RAISE EXCEPTION 'taxonomy_v2_expected_13_active_roots_found_%', v_count;
  END IF;

  WITH RECURSIVE taxonomy_tree AS (
    SELECT
      root_row.node_id AS root_id,
      root_row.node_id,
      root_row.is_leaf,
      root_row.is_active
    FROM public.taxonomy_version_nodes root_row
    WHERE root_row.version_id = v_draft_version_id
      AND root_row.parent_node_id IS NULL
      AND root_row.is_active

    UNION ALL

    SELECT
      taxonomy_tree.root_id,
      child_row.node_id,
      child_row.is_leaf,
      child_row.is_active
    FROM taxonomy_tree
    JOIN public.taxonomy_version_nodes child_row
      ON child_row.version_id = v_draft_version_id
     AND child_row.parent_node_id = taxonomy_tree.node_id
     AND child_row.is_active
  ), roots_without_leaf AS (
    SELECT root_id
    FROM taxonomy_tree
    GROUP BY root_id
    HAVING count(*) FILTER (WHERE is_leaf AND is_active) = 0
  )
  SELECT count(*) INTO v_count FROM roots_without_leaf;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_v2_active_roots_without_active_leaf_%', v_count;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM public.taxonomy_version_nodes leaf_row
  WHERE leaf_row.version_id = v_draft_version_id
    AND leaf_row.is_active
    AND leaf_row.is_leaf
    AND NOT EXISTS (
      SELECT 1
      FROM public.taxonomy_field_rules rule_row
      WHERE rule_row.version_id = leaf_row.version_id
        AND rule_row.taxonomy_node_id = leaf_row.node_id
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_v2_active_leaves_without_field_rules_%', v_count;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM public.taxonomy_version_nodes node_row
  JOIN public.taxonomy_version_nodes parent_row
    ON parent_row.version_id = node_row.version_id
   AND parent_row.node_id = node_row.parent_node_id
  WHERE node_row.version_id = v_draft_version_id
    AND node_row.depth <> parent_row.depth + 1;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_v2_parent_depth_mismatch_%', v_count;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM (
    SELECT slug
    FROM public.taxonomy_version_nodes
    WHERE version_id = v_draft_version_id
    GROUP BY slug
    HAVING count(*) > 1
  ) duplicate_slugs;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_v2_duplicate_slugs_%', v_count;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM public.subcategories subcategory_row
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.taxonomy_legacy_mappings mapping_row
    WHERE mapping_row.version_id = v_draft_version_id
      AND mapping_row.legacy_category_id = subcategory_row.category_id
      AND mapping_row.legacy_subcategory_id = subcategory_row.id
      AND mapping_row.is_active
  );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_v2_legacy_subcategories_without_mapping_%', v_count;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM public.taxonomy_legacy_mappings mapping_row
  LEFT JOIN public.taxonomy_version_nodes target_row
    ON target_row.version_id = mapping_row.version_id
   AND target_row.node_id = mapping_row.taxonomy_node_id
  WHERE mapping_row.version_id = v_draft_version_id
    AND mapping_row.is_active
    AND (
      target_row.node_id IS NULL
      OR NOT target_row.is_active
      OR NOT target_row.is_leaf
    );

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_v2_legacy_mappings_without_active_leaf_%', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.vehicle_makes WHERE is_active;
  IF v_count < 40 THEN
    RAISE EXCEPTION 'vehicle_catalog_active_make_count_too_small_%', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.vehicle_models WHERE is_active;
  IF v_count < 80 THEN
    RAISE EXCEPTION 'vehicle_catalog_active_model_count_too_small_%', v_count;
  END IF;

  SELECT count(*)
    INTO v_count
  FROM public.vehicle_models model_row
  LEFT JOIN public.vehicle_makes make_row
    ON make_row.id = model_row.make_id
  WHERE make_row.id IS NULL;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'vehicle_catalog_orphan_models_%', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vehicle_models
    WHERE id = 'toyota-camry'
      AND make_id = 'toyota'
      AND 'Kamri' = ANY(aliases)
  ) THEN
    RAISE EXCEPTION 'vehicle_catalog_camry_alias_contract_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vehicle_models
    WHERE id = 'kia-cerato'
      AND make_id = 'kia'
      AND 'Cirato' = ANY(aliases)
  ) THEN
    RAISE EXCEPTION 'vehicle_catalog_cerato_alias_contract_missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vehicle_models
    WHERE id = 'hyundai-elantra'
      AND make_id = 'hyundai'
      AND 'Avante' = ANY(aliases)
  ) THEN
    RAISE EXCEPTION 'vehicle_catalog_avante_alias_contract_missing';
  END IF;

  IF COALESCE(has_table_privilege('anon', 'public.taxonomy_mapping_queue', 'SELECT'), false)
    OR COALESCE(has_table_privilege('authenticated', 'public.taxonomy_mapping_queue', 'SELECT'), false) THEN
    RAISE EXCEPTION 'taxonomy_mapping_queue_exposed_to_clients';
  END IF;

  IF COALESCE(has_table_privilege('anon', 'public.vehicle_reference_review_queue', 'SELECT'), false)
    OR COALESCE(has_table_privilege('authenticated', 'public.vehicle_reference_review_queue', 'SELECT'), false) THEN
    RAISE EXCEPTION 'vehicle_reference_review_queue_exposed_to_clients';
  END IF;

  SELECT count(*)
    INTO v_count
  FROM pg_class table_row
  JOIN pg_namespace namespace_row
    ON namespace_row.oid = table_row.relnamespace
  WHERE namespace_row.nspname = 'public'
    AND table_row.relname IN (
      'taxonomy_versions',
      'taxonomy_version_nodes',
      'taxonomy_mapping_queue',
      'taxonomy_legacy_mappings',
      'option_sets',
      'option_values',
      'field_definitions',
      'taxonomy_field_rules',
      'field_conditional_rules',
      'listing_attribute_values',
      'vehicle_makes',
      'vehicle_models',
      'vehicle_generations',
      'vehicle_trims',
      'vehicle_reference_review_queue'
    )
    AND NOT table_row.relrowsecurity;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'taxonomy_foundation_tables_without_rls_%', v_count;
  END IF;

  IF COALESCE(
    has_function_privilege(
      'anon',
      'public.rawaj_touch_taxonomy_foundation_updated_at()',
      'EXECUTE'
    ),
    false
  ) OR COALESCE(
    has_function_privilege(
      'authenticated',
      'public.rawaj_touch_taxonomy_foundation_updated_at()',
      'EXECUTE'
    ),
    false
  ) THEN
    RAISE EXCEPTION 'taxonomy_trigger_helper_executable_by_clients';
  END IF;

  RAISE NOTICE 'RAWAJ local verification passed: published_version=%, draft_version=%, active_makes_and_models_valid=true',
    v_published_version_id,
    v_draft_version_id;
END;
$verification$;

SELECT
  version_number,
  status,
  (SELECT count(*) FROM public.taxonomy_version_nodes node_row WHERE node_row.version_id = version_row.id) AS nodes,
  (SELECT count(*) FROM public.taxonomy_version_nodes node_row WHERE node_row.version_id = version_row.id AND node_row.is_active AND node_row.is_leaf) AS active_leaves
FROM public.taxonomy_versions version_row
ORDER BY version_number;

SELECT
  (SELECT count(*) FROM public.vehicle_makes WHERE is_active) AS active_vehicle_makes,
  (SELECT count(*) FROM public.vehicle_models WHERE is_active) AS active_vehicle_models,
  (SELECT count(*) FROM public.taxonomy_legacy_mappings WHERE is_active) AS active_legacy_mappings,
  (SELECT count(*) FROM public.taxonomy_field_rules) AS taxonomy_field_rules;
