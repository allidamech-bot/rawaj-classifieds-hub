-- RAWAJ Taxonomy, Data & Search Foundation V1: owner-only draft, validation, and atomic publish RPCs.
-- Publishing updates the compatibility runtime taxonomy only after all structural gates pass.

create or replace function public.rawaj_owner_validate_taxonomy_version(
  p_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_errors jsonb := '[]'::jsonb;
  v_node_count integer := 0;
  v_active_leaf_count integer := 0;
  v_mapped_subcategory_count integer := 0;
  v_missing_count integer := 0;
  v_version_status text;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  select status
    into v_version_status
  from public.taxonomy_versions
  where id = p_version_id;

  if v_version_status is null then
    raise exception 'Taxonomy version does not exist.';
  end if;

  select count(*), count(*) filter (where is_active and is_leaf)
    into v_node_count, v_active_leaf_count
  from public.taxonomy_version_nodes
  where version_id = p_version_id;

  if v_node_count = 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'empty_version', 'count', 1)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.categories category_row
  where category_row.is_active
    and not exists (
      select 1
      from public.taxonomy_version_nodes root_row
      where root_row.version_id = p_version_id
        and root_row.parent_node_id is null
        and root_row.is_active
        and root_row.legacy_category_id = category_row.id
    );

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'active_categories_without_roots', 'count', v_missing_count)
    );
  end if;

  with recursive tree as (
    select
      root_row.node_id as root_id,
      root_row.node_id,
      root_row.is_active,
      root_row.is_leaf
    from public.taxonomy_version_nodes root_row
    where root_row.version_id = p_version_id
      and root_row.parent_node_id is null
      and root_row.is_active

    union all

    select
      tree.root_id,
      child_row.node_id,
      child_row.is_active,
      child_row.is_leaf
    from tree
    join public.taxonomy_version_nodes child_row
      on child_row.version_id = p_version_id
     and child_row.parent_node_id = tree.node_id
  )
  select count(*)
    into v_missing_count
  from public.taxonomy_version_nodes root_row
  where root_row.version_id = p_version_id
    and root_row.parent_node_id is null
    and root_row.is_active
    and not exists (
      select 1
      from tree
      where tree.root_id = root_row.node_id
        and tree.is_active
        and tree.is_leaf
    );

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'active_roots_without_active_leaves', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.taxonomy_version_nodes node_row
  where node_row.version_id = p_version_id
    and node_row.is_active
    and not node_row.is_leaf
    and not exists (
      select 1
      from public.taxonomy_version_nodes child_row
      where child_row.version_id = p_version_id
        and child_row.parent_node_id = node_row.node_id
        and child_row.is_active
    );

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'active_branches_without_active_children', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.taxonomy_version_nodes child_row
  join public.taxonomy_version_nodes parent_row
    on parent_row.version_id = child_row.version_id
   and parent_row.node_id = child_row.parent_node_id
  where child_row.version_id = p_version_id
    and child_row.is_active
    and not parent_row.is_active;

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'active_nodes_with_inactive_parent', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.taxonomy_version_nodes child_row
  join public.taxonomy_version_nodes parent_row
    on parent_row.version_id = child_row.version_id
   and parent_row.node_id = child_row.parent_node_id
  where child_row.version_id = p_version_id
    and child_row.depth <> parent_row.depth + 1;

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'invalid_depth_transitions', 'count', v_missing_count)
    );
  end if;

  with recursive walk as (
    select
      node_row.node_id as origin_id,
      node_row.parent_node_id,
      array[node_row.node_id]::text[] as visited,
      false as cycle_found
    from public.taxonomy_version_nodes node_row
    where node_row.version_id = p_version_id

    union all

    select
      walk.origin_id,
      parent_row.parent_node_id,
      walk.visited || parent_row.node_id,
      parent_row.node_id = any(walk.visited)
    from walk
    join public.taxonomy_version_nodes parent_row
      on parent_row.version_id = p_version_id
     and parent_row.node_id = walk.parent_node_id
    where not walk.cycle_found
  )
  select count(*)
    into v_missing_count
  from walk
  where cycle_found;

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'taxonomy_cycles', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.taxonomy_version_nodes leaf_row
  where leaf_row.version_id = p_version_id
    and leaf_row.is_active
    and leaf_row.is_leaf
    and (
      leaf_row.filter_schema_key is null
      or leaf_row.display_schema_key is null
      or not exists (
        select 1
        from public.taxonomy_field_rules rule_row
        join public.field_definitions field_row
          on field_row.key = rule_row.field_key
        where rule_row.version_id = leaf_row.version_id
          and rule_row.taxonomy_node_id = leaf_row.node_id
          and rule_row.is_displayable
          and field_row.is_active
      )
    );

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'active_leaves_without_complete_schema', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.subcategories subcategory_row
  join public.categories category_row
    on category_row.id = subcategory_row.category_id
  where category_row.is_active
    and not exists (
      select 1
      from public.taxonomy_legacy_mappings mapping_row
      where mapping_row.version_id = p_version_id
        and mapping_row.legacy_category_id = subcategory_row.category_id
        and mapping_row.legacy_subcategory_id = subcategory_row.id
        and mapping_row.is_active
    );

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'legacy_subcategories_without_mapping', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.taxonomy_legacy_mappings mapping_row
  left join public.taxonomy_version_nodes leaf_row
    on leaf_row.version_id = mapping_row.version_id
   and leaf_row.node_id = mapping_row.taxonomy_node_id
  where mapping_row.version_id = p_version_id
    and mapping_row.is_active
    and (
      leaf_row.node_id is null
      or not leaf_row.is_active
      or not leaf_row.is_leaf
    );

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'legacy_mappings_without_active_leaf', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_missing_count
  from public.taxonomy_version_nodes target_row
  join public.taxonomy_nodes runtime_row
    on runtime_row.slug = target_row.slug
   and runtime_row.id <> target_row.node_id
  where target_row.version_id = p_version_id;

  if v_missing_count > 0 then
    v_errors := v_errors || jsonb_build_array(
      jsonb_build_object('code', 'runtime_slug_reuse_conflicts', 'count', v_missing_count)
    );
  end if;

  select count(*)
    into v_mapped_subcategory_count
  from public.taxonomy_legacy_mappings
  where version_id = p_version_id
    and legacy_subcategory_id is not null
    and is_active;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'versionId', p_version_id,
    'status', v_version_status,
    'errors', v_errors,
    'metrics', jsonb_build_object(
      'nodes', v_node_count,
      'activeLeaves', v_active_leaf_count,
      'mappedLegacySubcategories', v_mapped_subcategory_count
    )
  );
end;
$$;

create or replace function public.rawaj_owner_create_taxonomy_draft(
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_published_version_id uuid;
  v_new_version_id uuid;
  v_next_version integer;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  lock table public.taxonomy_versions in share row exclusive mode;

  select id
    into v_published_version_id
  from public.taxonomy_versions
  where status = 'published'
  order by version_number desc
  limit 1;

  if v_published_version_id is null then
    raise exception 'Published taxonomy version is missing.';
  end if;

  if exists (select 1 from public.taxonomy_versions where status = 'draft') then
    raise exception 'A taxonomy draft already exists.';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
  from public.taxonomy_versions;

  insert into public.taxonomy_versions (
    version_number,
    status,
    based_on_version_id,
    change_summary,
    created_by
  )
  values (
    v_next_version,
    'draft',
    v_published_version_id,
    nullif(btrim(coalesce(p_change_summary, '')), ''),
    v_actor
  )
  returning id into v_new_version_id;

  insert into public.taxonomy_version_nodes (
    version_id,
    node_id,
    parent_node_id,
    slug,
    name_ar,
    name_en,
    description_ar,
    description_en,
    icon_key,
    sort_order,
    depth,
    is_active,
    is_leaf,
    filter_schema_key,
    display_schema_key,
    classification_key,
    classification_value,
    legacy_category_id,
    legacy_subcategory_id,
    seo_title_ar,
    seo_title_en,
    seo_description_ar,
    seo_description_en
  )
  select
    v_new_version_id,
    node_id,
    parent_node_id,
    slug,
    name_ar,
    name_en,
    description_ar,
    description_en,
    icon_key,
    sort_order,
    depth,
    is_active,
    is_leaf,
    filter_schema_key,
    display_schema_key,
    classification_key,
    classification_value,
    legacy_category_id,
    legacy_subcategory_id,
    seo_title_ar,
    seo_title_en,
    seo_description_ar,
    seo_description_en
  from public.taxonomy_version_nodes
  where version_id = v_published_version_id;

  insert into public.taxonomy_field_rules (
    version_id,
    taxonomy_node_id,
    field_key,
    group_key,
    sort_order,
    is_required,
    is_searchable,
    is_filterable,
    is_displayable,
    display_surfaces,
    validation_override,
    default_value
  )
  select
    v_new_version_id,
    taxonomy_node_id,
    field_key,
    group_key,
    sort_order,
    is_required,
    is_searchable,
    is_filterable,
    is_displayable,
    display_surfaces,
    validation_override,
    default_value
  from public.taxonomy_field_rules
  where version_id = v_published_version_id;

  insert into public.field_conditional_rules (
    version_id,
    taxonomy_node_id,
    trigger_field_key,
    operator,
    trigger_value,
    target_field_key,
    effect,
    priority,
    is_active
  )
  select
    v_new_version_id,
    taxonomy_node_id,
    trigger_field_key,
    operator,
    trigger_value,
    target_field_key,
    effect,
    priority,
    is_active
  from public.field_conditional_rules
  where version_id = v_published_version_id;

  insert into public.taxonomy_legacy_mappings (
    version_id,
    legacy_category_id,
    legacy_subcategory_id,
    taxonomy_node_id,
    mapping_kind,
    priority,
    attribute_patch,
    is_active
  )
  select
    v_new_version_id,
    legacy_category_id,
    legacy_subcategory_id,
    taxonomy_node_id,
    mapping_kind,
    priority,
    attribute_patch,
    is_active
  from public.taxonomy_legacy_mappings
  where version_id = v_published_version_id;

  perform public.rawaj_insert_audit_log(
    'taxonomy.draft_created',
    'taxonomy_versions',
    v_new_version_id::text,
    jsonb_build_object(
      'versionNumber', v_next_version,
      'basedOnVersionId', v_published_version_id,
      'changeSummary', nullif(btrim(coalesce(p_change_summary, '')), '')
    )
  );

  return v_new_version_id;
end;
$$;

create or replace function public.rawaj_owner_publish_taxonomy_version(
  p_version_id uuid,
  p_expected_updated_at timestamptz,
  p_change_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_validation jsonb;
  v_target_updated_at timestamptz;
  v_depth integer;
  v_max_depth integer;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  lock table public.taxonomy_versions in share row exclusive mode;
  lock table public.taxonomy_nodes in share row exclusive mode;

  select updated_at
    into v_target_updated_at
  from public.taxonomy_versions
  where id = p_version_id
    and status = 'draft'
  for update;

  if v_target_updated_at is null then
    raise exception 'Draft taxonomy version does not exist.';
  end if;

  if p_expected_updated_at is null or v_target_updated_at <> p_expected_updated_at then
    raise exception 'stale_taxonomy_version';
  end if;

  v_validation := public.rawaj_owner_validate_taxonomy_version(p_version_id);
  if coalesce((v_validation ->> 'valid')::boolean, false) is not true then
    raise exception 'taxonomy_validation_failed: %', v_validation::text;
  end if;

  update public.taxonomy_versions
  set status = 'archived',
      updated_at = now()
  where status = 'published';

  select coalesce(max(depth), 0)
    into v_max_depth
  from public.taxonomy_version_nodes
  where version_id = p_version_id;

  for v_depth in 0..v_max_depth loop
    insert into public.taxonomy_nodes (
      id,
      parent_id,
      slug,
      name_ar,
      name_en,
      description_ar,
      description_en,
      icon_key,
      sort_order,
      depth,
      is_active,
      is_leaf,
      filter_schema_key,
      classification_key,
      classification_value,
      legacy_category_id,
      legacy_subcategory_id,
      created_at,
      updated_at
    )
    select
      node_row.node_id,
      node_row.parent_node_id,
      node_row.slug,
      node_row.name_ar,
      node_row.name_en,
      node_row.description_ar,
      node_row.description_en,
      node_row.icon_key,
      node_row.sort_order,
      node_row.depth,
      node_row.is_active,
      node_row.is_leaf,
      node_row.filter_schema_key,
      node_row.classification_key,
      node_row.classification_value,
      node_row.legacy_category_id,
      node_row.legacy_subcategory_id,
      node_row.created_at,
      now()
    from public.taxonomy_version_nodes node_row
    where node_row.version_id = p_version_id
      and node_row.depth = v_depth
    on conflict (id) do update set
      parent_id = excluded.parent_id,
      slug = excluded.slug,
      name_ar = excluded.name_ar,
      name_en = excluded.name_en,
      description_ar = excluded.description_ar,
      description_en = excluded.description_en,
      icon_key = excluded.icon_key,
      sort_order = excluded.sort_order,
      depth = excluded.depth,
      is_active = excluded.is_active,
      is_leaf = excluded.is_leaf,
      filter_schema_key = excluded.filter_schema_key,
      classification_key = excluded.classification_key,
      classification_value = excluded.classification_value,
      legacy_category_id = excluded.legacy_category_id,
      legacy_subcategory_id = excluded.legacy_subcategory_id,
      updated_at = now();
  end loop;

  update public.taxonomy_nodes runtime_row
  set is_active = false,
      updated_at = now()
  where not exists (
    select 1
    from public.taxonomy_version_nodes target_row
    where target_row.version_id = p_version_id
      and target_row.node_id = runtime_row.id
  );

  update public.taxonomy_versions
  set status = 'published',
      change_summary = coalesce(
        nullif(btrim(coalesce(p_change_summary, '')), ''),
        change_summary
      ),
      published_at = now(),
      published_by = v_actor,
      updated_at = now()
  where id = p_version_id;

  perform public.rawaj_insert_audit_log(
    'taxonomy.version_published',
    'taxonomy_versions',
    p_version_id::text,
    jsonb_build_object(
      'validation', v_validation,
      'changeSummary', nullif(btrim(coalesce(p_change_summary, '')), '')
    )
  );

  return jsonb_build_object(
    'versionId', p_version_id,
    'publishedAt', now(),
    'validation', v_validation
  );
end;
$$;

revoke all on function public.rawaj_owner_validate_taxonomy_version(uuid) from public, anon;
revoke all on function public.rawaj_owner_create_taxonomy_draft(text) from public, anon;
revoke all on function public.rawaj_owner_publish_taxonomy_version(uuid, timestamptz, text) from public, anon;

grant execute on function public.rawaj_owner_validate_taxonomy_version(uuid) to authenticated;
grant execute on function public.rawaj_owner_create_taxonomy_draft(text) to authenticated;
grant execute on function public.rawaj_owner_publish_taxonomy_version(uuid, timestamptz, text) to authenticated;

comment on function public.rawaj_owner_validate_taxonomy_version(uuid) is
  'Owner-only structural release gate for taxonomy roots, leaves, schemas, compatibility mappings, cycles, and runtime slug safety.';
comment on function public.rawaj_owner_create_taxonomy_draft(text) is
  'Owner-only creation of one versioned taxonomy draft cloned from the published version.';
comment on function public.rawaj_owner_publish_taxonomy_version(uuid, timestamptz, text) is
  'Owner-only optimistic and atomic taxonomy publish operation that reconciles the runtime compatibility tree after validation.';
