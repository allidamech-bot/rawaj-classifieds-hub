-- RAWAJ Taxonomy, Data & Search Foundation V1: reviewed legacy mapping application.
-- No queue suggestion is applied automatically. Review is admin-like; application is owner-only
-- and remains blocked until the referenced taxonomy version is the published version.

alter table public.taxonomy_mapping_queue
  add column if not exists reviewed_listing_updated_at timestamptz,
  add column if not exists applied_by uuid references public.profiles(id) on delete set null,
  add column if not exists applied_at timestamptz;

alter table public.taxonomy_mapping_queue
  drop constraint if exists taxonomy_mapping_queue_status_check;
alter table public.taxonomy_mapping_queue
  add constraint taxonomy_mapping_queue_status_check check (
    status in (
      'pending', 'auto_mapped', 'needs_review', 'confirmed', 'unresolved',
      'rejected', 'applied'
    )
  );

alter table public.taxonomy_mapping_queue
  drop constraint if exists taxonomy_mapping_queue_applied_metadata_check;
alter table public.taxonomy_mapping_queue
  add constraint taxonomy_mapping_queue_applied_metadata_check check (
    status <> 'applied'
    or (applied_by is not null and applied_at is not null)
  );

create index if not exists taxonomy_mapping_queue_reviewed_status_idx
  on public.taxonomy_mapping_queue(status, reviewed_at desc nulls last, listing_id);

create or replace function public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin_like() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'pending', 'auto_mapped', 'needs_review', 'confirmed', 'unresolved',
    'rejected', 'applied'
  ) then
    raise exception 'invalid_taxonomy_mapping_queue_status' using errcode = '22023';
  end if;

  with filtered as (
    select queue_row.*
    from public.taxonomy_mapping_queue queue_row
    where v_status is null or queue_row.status = v_status
  ),
  page_rows as (
    select filtered.*
    from filtered
    order by
      case filtered.status
        when 'needs_review' then 1
        when 'unresolved' then 2
        when 'auto_mapped' then 3
        when 'pending' then 4
        when 'confirmed' then 5
        when 'rejected' then 6
        else 7
      end,
      filtered.confidence desc nulls last,
      filtered.updated_at desc,
      filtered.listing_id
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'limit', v_limit,
    'offset', v_offset,
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'listingId', page_row.listing_id,
          'listingTitle', listing_row.title,
          'listingStatus', listing_row.status,
          'listingCategoryId', listing_row.category_id,
          'listingSubcategoryId', listing_row.subcategory_id,
          'listingUpdatedAt', listing_row.updated_at,
          'currentTaxonomyNodeId', page_row.current_taxonomy_node_id,
          'suggestedVersionId', page_row.suggested_version_id,
          'suggestedVersionNumber', version_row.version_number,
          'suggestedVersionStatus', version_row.status,
          'suggestedTaxonomyNodeId', page_row.suggested_taxonomy_node_id,
          'suggestedNameAr', node_row.name_ar,
          'suggestedNameEn', node_row.name_en,
          'confidence', page_row.confidence,
          'status', page_row.status,
          'mappingSource', page_row.mapping_source,
          'evidence', page_row.evidence,
          'attemptCount', page_row.attempt_count,
          'reviewedBy', page_row.reviewed_by,
          'reviewedAt', page_row.reviewed_at,
          'reviewNote', page_row.review_note,
          'reviewedListingUpdatedAt', page_row.reviewed_listing_updated_at,
          'appliedBy', page_row.applied_by,
          'appliedAt', page_row.applied_at,
          'createdAt', page_row.created_at,
          'updatedAt', page_row.updated_at
        )
        order by
          case page_row.status
            when 'needs_review' then 1
            when 'unresolved' then 2
            when 'auto_mapped' then 3
            when 'pending' then 4
            when 'confirmed' then 5
            when 'rejected' then 6
            else 7
          end,
          page_row.confidence desc nulls last,
          page_row.updated_at desc,
          page_row.listing_id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from page_rows page_row
  join public.listings listing_row
    on listing_row.id = page_row.listing_id
  left join public.taxonomy_versions version_row
    on version_row.id = page_row.suggested_version_id
  left join public.taxonomy_version_nodes node_row
    on node_row.version_id = page_row.suggested_version_id
   and node_row.node_id = page_row.suggested_taxonomy_node_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'total', 0,
      'limit', v_limit,
      'offset', v_offset,
      'items', '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.rawaj_admin_review_taxonomy_mapping_v1(
  p_listing_id uuid,
  p_decision text,
  p_version_id uuid default null,
  p_taxonomy_node_id text default null,
  p_note text default null,
  p_expected_queue_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_queue public.taxonomy_mapping_queue%rowtype;
  v_listing public.listings%rowtype;
  v_target public.taxonomy_version_nodes%rowtype;
  v_target_version_id uuid;
  v_target_node_id text;
  v_version_status text;
  v_target_category_id text;
  v_previous_status text;
  v_previous_version_id uuid;
  v_previous_node_id text;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'listing_id_required' using errcode = '22023';
  end if;

  if v_decision not in ('confirm', 'reject') then
    raise exception 'taxonomy_mapping_decision_invalid' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'taxonomy_mapping_review_note_too_long' using errcode = '22023';
  end if;

  select queue_row.*
    into v_queue
  from public.taxonomy_mapping_queue queue_row
  where queue_row.listing_id = p_listing_id
  for update;

  if not found then
    raise exception 'taxonomy_mapping_queue_item_not_found' using errcode = 'P0002';
  end if;

  if v_queue.status = 'applied' then
    raise exception 'taxonomy_mapping_already_applied' using errcode = '55000';
  end if;

  if p_expected_queue_updated_at is null
    or v_queue.updated_at is distinct from p_expected_queue_updated_at then
    raise exception 'stale_taxonomy_mapping_review' using errcode = '40001';
  end if;

  select listing_row.*
    into v_listing
  from public.listings listing_row
  where listing_row.id = p_listing_id
  for update;

  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  v_previous_status := v_queue.status;
  v_previous_version_id := v_queue.suggested_version_id;
  v_previous_node_id := v_queue.suggested_taxonomy_node_id;

  if v_decision = 'reject' then
    update public.taxonomy_mapping_queue
    set status = 'rejected',
        reviewed_by = v_actor,
        reviewed_at = now(),
        reviewed_listing_updated_at = v_listing.updated_at,
        review_note = v_note,
        applied_by = null,
        applied_at = null
    where listing_id = p_listing_id
    returning updated_at into v_updated_at;

    perform public.rawaj_insert_audit_log(
      'taxonomy.mapping_rejected',
      'taxonomy_mapping_queue',
      p_listing_id::text,
      jsonb_build_object(
        'previousStatus', v_previous_status,
        'suggestedVersionId', v_previous_version_id,
        'suggestedTaxonomyNodeId', v_previous_node_id,
        'note', v_note
      )
    );

    return jsonb_build_object(
      'listingId', p_listing_id,
      'status', 'rejected',
      'reviewedAt', now(),
      'updatedAt', v_updated_at
    );
  end if;

  v_target_version_id := coalesce(p_version_id, v_queue.suggested_version_id);
  v_target_node_id := nullif(btrim(coalesce(p_taxonomy_node_id, v_queue.suggested_taxonomy_node_id, '')), '');

  if v_target_version_id is null or v_target_node_id is null then
    raise exception 'taxonomy_mapping_target_required' using errcode = '22023';
  end if;

  select version_row.status
    into v_version_status
  from public.taxonomy_versions version_row
  where version_row.id = v_target_version_id;

  if v_version_status is null then
    raise exception 'taxonomy_mapping_version_not_found' using errcode = 'P0002';
  end if;

  if v_version_status not in ('draft', 'published') then
    raise exception 'taxonomy_mapping_version_not_reviewable' using errcode = '55000';
  end if;

  select node_row.*
    into v_target
  from public.taxonomy_version_nodes node_row
  where node_row.version_id = v_target_version_id
    and node_row.node_id = v_target_node_id
    and node_row.is_active
    and node_row.is_leaf;

  if not found then
    raise exception 'taxonomy_mapping_target_requires_active_leaf' using errcode = '23514';
  end if;

  with recursive lineage as (
    select
      node_row.node_id,
      node_row.parent_node_id,
      node_row.depth,
      node_row.legacy_category_id
    from public.taxonomy_version_nodes node_row
    where node_row.version_id = v_target_version_id
      and node_row.node_id = v_target_node_id

    union all

    select
      parent_row.node_id,
      parent_row.parent_node_id,
      parent_row.depth,
      parent_row.legacy_category_id
    from public.taxonomy_version_nodes parent_row
    join lineage child_row
      on child_row.parent_node_id = parent_row.node_id
    where parent_row.version_id = v_target_version_id
  )
  select (
    array_agg(legacy_category_id order by depth asc)
      filter (where legacy_category_id is not null)
  )[1]
  into v_target_category_id
  from lineage;

  if v_target_category_id is null
    or v_target_category_id is distinct from v_listing.category_id then
    raise exception 'taxonomy_mapping_target_category_mismatch' using errcode = '23514';
  end if;

  update public.taxonomy_mapping_queue
  set suggested_version_id = v_target_version_id,
      suggested_taxonomy_node_id = v_target_node_id,
      status = 'confirmed',
      mapping_source = case
        when v_target_version_id is distinct from v_previous_version_id
          or v_target_node_id is distinct from v_previous_node_id
          then 'manual'
        else mapping_source
      end,
      evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
        'reviewedCategoryId', v_listing.category_id,
        'reviewedSubcategoryId', v_listing.subcategory_id,
        'reviewedTargetNameAr', v_target.name_ar,
        'reviewedTargetNameEn', v_target.name_en
      ),
      reviewed_by = v_actor,
      reviewed_at = now(),
      reviewed_listing_updated_at = v_listing.updated_at,
      review_note = v_note,
      applied_by = null,
      applied_at = null
  where listing_id = p_listing_id
  returning updated_at into v_updated_at;

  perform public.rawaj_insert_audit_log(
    'taxonomy.mapping_confirmed',
    'taxonomy_mapping_queue',
    p_listing_id::text,
    jsonb_build_object(
      'previousStatus', v_previous_status,
      'previousVersionId', v_previous_version_id,
      'previousTaxonomyNodeId', v_previous_node_id,
      'versionId', v_target_version_id,
      'taxonomyNodeId', v_target_node_id,
      'listingUpdatedAt', v_listing.updated_at,
      'note', v_note
    )
  );

  return jsonb_build_object(
    'listingId', p_listing_id,
    'status', 'confirmed',
    'versionId', v_target_version_id,
    'taxonomyNodeId', v_target_node_id,
    'reviewedAt', now(),
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.rawaj_apply_legacy_attribute_patch_v1(
  p_listing_id uuid,
  p_version_id uuid,
  p_taxonomy_node_id text,
  p_patch jsonb default '{}'::jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_invalid_keys text;
  v_field record;
  v_input jsonb;
  v_scalar_text text;
  v_written_count integer := 0;
begin
  if jsonb_typeof(v_patch) <> 'object' then
    raise exception 'legacy_attribute_patch_object_required' using errcode = '22023';
  end if;

  if jsonb_object_length(v_patch) > 50 then
    raise exception 'legacy_attribute_patch_limit_exceeded' using errcode = '54000';
  end if;

  select string_agg(input_key, ', ' order by input_key)
    into v_invalid_keys
  from jsonb_object_keys(v_patch) input_key
  where not exists (
    select 1
    from public.taxonomy_field_rules rule_row
    join public.field_definitions field_row
      on field_row.key = rule_row.field_key
     and field_row.is_active
     and not field_row.is_sensitive
    where rule_row.version_id = p_version_id
      and rule_row.taxonomy_node_id = p_taxonomy_node_id
      and rule_row.field_key = input_key
  );

  if v_invalid_keys is not null then
    raise exception 'legacy_attribute_patch_keys_not_allowed: %', v_invalid_keys
      using errcode = '22023';
  end if;

  for v_field in
    select
      field_row.key,
      field_row.field_type,
      field_row.data_provider_key,
      input_row.value as input_value,
      rule_row.sort_order
    from jsonb_each(v_patch) input_row
    join public.taxonomy_field_rules rule_row
      on rule_row.version_id = p_version_id
     and rule_row.taxonomy_node_id = p_taxonomy_node_id
     and rule_row.field_key = input_row.key
    join public.field_definitions field_row
      on field_row.key = rule_row.field_key
     and field_row.is_active
     and not field_row.is_sensitive
    where input_row.value <> 'null'::jsonb
      and not exists (
        select 1
        from public.listing_attribute_values existing_row
        where existing_row.listing_id = p_listing_id
          and existing_row.field_key = input_row.key
      )
    order by
      case field_row.data_provider_key
        when 'vehicle_makes' then 10
        when 'vehicle_models_by_make' then 20
        when 'vehicle_generations_by_model' then 30
        when 'vehicle_trims_by_model' then 40
        else 50
      end,
      rule_row.sort_order,
      field_row.key
  loop
    v_input := v_field.input_value;
    v_scalar_text := null;

    if v_field.field_type in ('text', 'textarea') then
      if jsonb_typeof(v_input) <> 'string' then
        raise exception 'legacy_attribute_patch_text_required: %', v_field.key
          using errcode = '22023';
      end if;
      v_scalar_text := btrim(v_input #>> '{}');
      if v_scalar_text = '' then
        continue;
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_text, source
      ) values (
        p_listing_id, v_field.key, v_scalar_text, 'legacy_backfill'
      );

    elsif v_field.field_type in ('integer', 'numeric', 'year') then
      if jsonb_typeof(v_input) <> 'number' then
        raise exception 'legacy_attribute_patch_numeric_required: %', v_field.key
          using errcode = '22023';
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_numeric, source
      ) values (
        p_listing_id, v_field.key, (v_input #>> '{}')::numeric, 'legacy_backfill'
      );

    elsif v_field.field_type = 'boolean' then
      if jsonb_typeof(v_input) <> 'boolean' then
        raise exception 'legacy_attribute_patch_boolean_required: %', v_field.key
          using errcode = '22023';
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_boolean, source
      ) values (
        p_listing_id, v_field.key, (v_input #>> '{}')::boolean, 'legacy_backfill'
      );

    elsif v_field.field_type = 'date' then
      if jsonb_typeof(v_input) <> 'string' then
        raise exception 'legacy_attribute_patch_date_required: %', v_field.key
          using errcode = '22023';
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_date, source
      ) values (
        p_listing_id, v_field.key, (v_input #>> '{}')::date, 'legacy_backfill'
      );

    elsif v_field.field_type in ('single_select', 'reference', 'location') then
      if jsonb_typeof(v_input) <> 'string' then
        raise exception 'legacy_attribute_patch_key_required: %', v_field.key
          using errcode = '22023';
      end if;
      v_scalar_text := btrim(v_input #>> '{}');
      if v_scalar_text = '' then
        continue;
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_key, source
      ) values (
        p_listing_id, v_field.key, v_scalar_text, 'legacy_backfill'
      );

    elsif v_field.field_type = 'multi_select' then
      if jsonb_typeof(v_input) <> 'array' then
        raise exception 'legacy_attribute_patch_array_required: %', v_field.key
          using errcode = '22023';
      end if;
      if jsonb_array_length(v_input) = 0 then
        continue;
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_json, source
      ) values (
        p_listing_id, v_field.key, v_input, 'legacy_backfill'
      );

    else
      raise exception 'legacy_attribute_patch_field_type_unsupported: %', v_field.field_type
        using errcode = '0A000';
    end if;

    v_written_count := v_written_count + 1;
  end loop;

  return v_written_count;
end;
$$;

create or replace function public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(
  p_listing_id uuid,
  p_expected_reviewed_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_queue public.taxonomy_mapping_queue%rowtype;
  v_listing public.listings%rowtype;
  v_version_status text;
  v_patch jsonb := '{}'::jsonb;
  v_patch_count integer := 0;
  v_assignment_updated_at timestamptz;
  v_queue_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'listing_id_required' using errcode = '22023';
  end if;

  select queue_row.*
    into v_queue
  from public.taxonomy_mapping_queue queue_row
  where queue_row.listing_id = p_listing_id
  for update;

  if not found then
    raise exception 'taxonomy_mapping_queue_item_not_found' using errcode = 'P0002';
  end if;

  if v_queue.status <> 'confirmed' then
    raise exception 'taxonomy_mapping_requires_confirmed_review' using errcode = '55000';
  end if;

  if p_expected_reviewed_at is null
    or v_queue.reviewed_at is distinct from p_expected_reviewed_at then
    raise exception 'stale_taxonomy_mapping_application' using errcode = '40001';
  end if;

  if v_queue.suggested_version_id is null
    or v_queue.suggested_taxonomy_node_id is null then
    raise exception 'taxonomy_mapping_target_required' using errcode = '23514';
  end if;

  select listing_row.*
    into v_listing
  from public.listings listing_row
  where listing_row.id = p_listing_id
  for update;

  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  if v_queue.reviewed_listing_updated_at is null
    or v_listing.updated_at is distinct from v_queue.reviewed_listing_updated_at then
    raise exception 'listing_changed_after_taxonomy_review' using errcode = '40001';
  end if;

  select version_row.status
    into v_version_status
  from public.taxonomy_versions version_row
  where version_row.id = v_queue.suggested_version_id;

  if v_version_status <> 'published' then
    raise exception 'taxonomy_mapping_version_not_published' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.taxonomy_version_nodes version_node
    join public.taxonomy_nodes runtime_node
      on runtime_node.id = version_node.node_id
    where version_node.version_id = v_queue.suggested_version_id
      and version_node.node_id = v_queue.suggested_taxonomy_node_id
      and version_node.is_active
      and version_node.is_leaf
      and runtime_node.is_active
      and runtime_node.is_leaf
  ) then
    raise exception 'taxonomy_mapping_published_runtime_leaf_missing' using errcode = '23514';
  end if;

  insert into public.listing_taxonomy_assignments (
    listing_id,
    taxonomy_node_id,
    assignment_source,
    created_at,
    updated_at
  ) values (
    p_listing_id,
    v_queue.suggested_taxonomy_node_id,
    'explicit',
    now(),
    now()
  )
  on conflict (listing_id) do update
  set taxonomy_node_id = excluded.taxonomy_node_id,
      assignment_source = 'explicit',
      updated_at = now()
  returning updated_at into v_assignment_updated_at;

  select mapping_row.attribute_patch
    into v_patch
  from public.taxonomy_legacy_mappings mapping_row
  where mapping_row.version_id = v_queue.suggested_version_id
    and mapping_row.legacy_category_id = v_listing.category_id
    and (
      mapping_row.legacy_subcategory_id is not distinct from v_listing.subcategory_id
      or mapping_row.legacy_subcategory_id is null
    )
    and mapping_row.taxonomy_node_id = v_queue.suggested_taxonomy_node_id
    and mapping_row.is_active
  order by
    (mapping_row.legacy_subcategory_id is not null) desc,
    mapping_row.priority desc,
    mapping_row.created_at
  limit 1;

  v_patch := coalesce(v_patch, '{}'::jsonb);
  v_patch_count := public.rawaj_apply_legacy_attribute_patch_v1(
    p_listing_id,
    v_queue.suggested_version_id,
    v_queue.suggested_taxonomy_node_id,
    v_patch
  );

  update public.taxonomy_mapping_queue
  set current_taxonomy_node_id = suggested_taxonomy_node_id,
      status = 'applied',
      applied_by = v_actor,
      applied_at = now()
  where listing_id = p_listing_id
  returning updated_at into v_queue_updated_at;

  perform public.rawaj_insert_audit_log(
    'taxonomy.mapping_applied',
    'listing_taxonomy_assignments',
    p_listing_id::text,
    jsonb_build_object(
      'versionId', v_queue.suggested_version_id,
      'taxonomyNodeId', v_queue.suggested_taxonomy_node_id,
      'reviewedBy', v_queue.reviewed_by,
      'reviewedAt', v_queue.reviewed_at,
      'legacyAttributePatchKeys', coalesce(
        (select jsonb_agg(patch_key order by patch_key) from jsonb_object_keys(v_patch) patch_key),
        '[]'::jsonb
      ),
      'legacyAttributesWritten', v_patch_count
    )
  );

  return jsonb_build_object(
    'listingId', p_listing_id,
    'status', 'applied',
    'versionId', v_queue.suggested_version_id,
    'taxonomyNodeId', v_queue.suggested_taxonomy_node_id,
    'assignmentUpdatedAt', v_assignment_updated_at,
    'queueUpdatedAt', v_queue_updated_at,
    'legacyAttributesWritten', v_patch_count
  );
end;
$$;

revoke all on function public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text, integer, integer)
  from public, anon;
revoke all on function public.rawaj_admin_review_taxonomy_mapping_v1(
  uuid, text, uuid, text, text, timestamptz
) from public, anon;
revoke all on function public.rawaj_apply_legacy_attribute_patch_v1(
  uuid, uuid, text, jsonb
) from public, anon, authenticated;
revoke all on function public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(
  uuid, timestamptz
) from public, anon;

grant execute on function public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text, integer, integer)
  to authenticated;
grant execute on function public.rawaj_admin_review_taxonomy_mapping_v1(
  uuid, text, uuid, text, text, timestamptz
) to authenticated;
grant execute on function public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(
  uuid, timestamptz
) to authenticated;

comment on function public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text, integer, integer) is
  'Admin-like private paginated queue feed with listing, target Leaf, confidence, review, and application metadata.';
comment on function public.rawaj_admin_review_taxonomy_mapping_v1(uuid, text, uuid, text, text, timestamptz) is
  'Stale-safe admin-like confirmation or rejection of one mapping suggestion. It never changes the listing assignment.';
comment on function public.rawaj_apply_legacy_attribute_patch_v1(uuid, uuid, text, jsonb) is
  'Internal merge-only legacy attribute patch writer. Existing listing attributes are never overwritten.';
comment on function public.rawaj_owner_apply_confirmed_taxonomy_mapping_v1(uuid, timestamptz) is
  'Owner-only application of a confirmed mapping after publication, with stale listing protection, audit logging, and merge-only legacy attributes.';
