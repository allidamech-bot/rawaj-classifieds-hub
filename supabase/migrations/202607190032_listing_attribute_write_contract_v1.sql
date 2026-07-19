-- RAWAJ Taxonomy, Data & Search Foundation V1: governed listing attribute writes.
-- Additive cutover preparation only. Existing listing write and submit behavior is unchanged.

-- Public clients may read only non-sensitive attributes belonging to a currently
-- visible listing. Owners and admin-like staff retain complete attribute access.
drop policy if exists listing_attribute_values_visible_with_listing
  on public.listing_attribute_values;
drop policy if exists listing_attribute_values_public_read
  on public.listing_attribute_values;
drop policy if exists listing_attribute_values_owner_read
  on public.listing_attribute_values;
drop policy if exists listing_attribute_values_admin_read
  on public.listing_attribute_values;

create policy listing_attribute_values_public_read
on public.listing_attribute_values
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings listing_row
    join public.field_definitions field_row
      on field_row.key = listing_attribute_values.field_key
    where listing_row.id = listing_attribute_values.listing_id
      and listing_row.status = 'approved'
      and listing_row.archived_at is null
      and (listing_row.expires_at is null or listing_row.expires_at > now())
      and field_row.is_active
      and not field_row.is_sensitive
  )
);

create policy listing_attribute_values_owner_read
on public.listing_attribute_values
for select
to authenticated
using (
  exists (
    select 1
    from public.listings listing_row
    where listing_row.id = listing_attribute_values.listing_id
      and listing_row.owner_id = (select auth.uid())
  )
);

create policy listing_attribute_values_admin_read
on public.listing_attribute_values
for select
to authenticated
using (public.current_user_is_admin_like());

create or replace function public.rawaj_listing_attribute_completeness_v1(
  p_listing_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_owner_id uuid;
  v_version_id uuid;
  v_taxonomy_node_id text;
  v_required_count integer := 0;
  v_filled_required_count integer := 0;
  v_filled_count integer := 0;
  v_missing_required jsonb := '[]'::jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select listing_row.owner_id
    into v_owner_id
  from public.listings listing_row
  where listing_row.id = p_listing_id;

  if v_owner_id is null then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  if v_owner_id <> v_actor and not public.current_user_is_admin_like() then
    raise exception 'listing_attribute_read_forbidden' using errcode = '42501';
  end if;

  select version_row.id, assignment_row.taxonomy_node_id
    into v_version_id, v_taxonomy_node_id
  from public.taxonomy_versions version_row
  join public.listing_taxonomy_assignments assignment_row
    on assignment_row.listing_id = p_listing_id
  join public.taxonomy_version_nodes node_row
    on node_row.version_id = version_row.id
   and node_row.node_id = assignment_row.taxonomy_node_id
  where version_row.status = 'published'
    and node_row.is_active
    and node_row.is_leaf
  order by version_row.version_number desc
  limit 1;

  if v_version_id is null or v_taxonomy_node_id is null then
    return jsonb_build_object(
      'complete', false,
      'blockingCode', 'published_taxonomy_leaf_required',
      'taxonomyVersionId', v_version_id,
      'taxonomyNodeId', v_taxonomy_node_id,
      'requiredCount', 0,
      'filledRequiredCount', 0,
      'filledCount', 0,
      'missingRequiredFields', '[]'::jsonb
    );
  end if;

  select
    count(*) filter (where rule_row.is_required),
    count(*) filter (
      where rule_row.is_required
        and attribute_row.field_key is not null
    ),
    count(attribute_row.field_key),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'fieldKey', rule_row.field_key,
          'labelAr', field_row.label_ar,
          'labelEn', field_row.label_en,
          'groupKey', rule_row.group_key,
          'sortOrder', rule_row.sort_order
        )
        order by rule_row.sort_order, rule_row.field_key
      ) filter (
        where rule_row.is_required
          and attribute_row.field_key is null
      ),
      '[]'::jsonb
    )
    into
      v_required_count,
      v_filled_required_count,
      v_filled_count,
      v_missing_required
  from public.taxonomy_field_rules rule_row
  join public.field_definitions field_row
    on field_row.key = rule_row.field_key
   and field_row.is_active
  left join public.listing_attribute_values attribute_row
    on attribute_row.listing_id = p_listing_id
   and attribute_row.field_key = rule_row.field_key
  where rule_row.version_id = v_version_id
    and rule_row.taxonomy_node_id = v_taxonomy_node_id;

  return jsonb_build_object(
    'complete', v_required_count = v_filled_required_count,
    'blockingCode', case
      when v_required_count = v_filled_required_count then null
      else 'required_listing_attributes_missing'
    end,
    'taxonomyVersionId', v_version_id,
    'taxonomyNodeId', v_taxonomy_node_id,
    'requiredCount', v_required_count,
    'filledRequiredCount', v_filled_required_count,
    'filledCount', v_filled_count,
    'missingRequiredFields', v_missing_required
  );
end;
$$;

create or replace function public.rawaj_owner_replace_listing_attributes_v1(
  p_listing_id uuid,
  p_expected_updated_at timestamptz,
  p_attributes jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_attributes jsonb := coalesce(p_attributes, '{}'::jsonb);
  v_version_id uuid;
  v_taxonomy_node_id text;
  v_invalid_field_keys text;
  v_field record;
  v_input jsonb;
  v_scalar_text text;
  v_updated_at timestamptz;
  v_written_count integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'listing_id_required' using errcode = '22023';
  end if;

  if p_expected_updated_at is null then
    raise exception 'stale_owner_update' using errcode = '40001';
  end if;

  if jsonb_typeof(v_attributes) <> 'object' then
    raise exception 'listing_attributes_object_required' using errcode = '22023';
  end if;

  if jsonb_object_length(v_attributes) > 100 then
    raise exception 'listing_attribute_limit_exceeded' using errcode = '54000';
  end if;

  select listing_row.*
    into v_listing
  from public.listings listing_row
  where listing_row.id = p_listing_id
  for update;

  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  if v_listing.owner_id <> v_actor then
    raise exception 'listing_attribute_write_forbidden' using errcode = '42501';
  end if;

  if v_listing.status not in ('draft', 'rejected') then
    raise exception 'listing_attributes_require_editable_listing' using errcode = '55000';
  end if;

  if v_listing.updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_owner_update' using errcode = '40001';
  end if;

  select version_row.id, assignment_row.taxonomy_node_id
    into v_version_id, v_taxonomy_node_id
  from public.taxonomy_versions version_row
  join public.listing_taxonomy_assignments assignment_row
    on assignment_row.listing_id = p_listing_id
  join public.taxonomy_version_nodes node_row
    on node_row.version_id = version_row.id
   and node_row.node_id = assignment_row.taxonomy_node_id
  where version_row.status = 'published'
    and node_row.is_active
    and node_row.is_leaf
  order by version_row.version_number desc
  limit 1;

  if v_version_id is null or v_taxonomy_node_id is null then
    raise exception 'published_taxonomy_leaf_required' using errcode = '23514';
  end if;

  select string_agg(input_row.field_key, ', ' order by input_row.field_key)
    into v_invalid_field_keys
  from jsonb_object_keys(v_attributes) as input_row(field_key)
  where not exists (
    select 1
    from public.taxonomy_field_rules rule_row
    join public.field_definitions field_row
      on field_row.key = rule_row.field_key
     and field_row.is_active
    where rule_row.version_id = v_version_id
      and rule_row.taxonomy_node_id = v_taxonomy_node_id
      and rule_row.field_key = input_row.field_key
  );

  if v_invalid_field_keys is not null then
    raise exception 'listing_attribute_keys_not_allowed: %', v_invalid_field_keys
      using errcode = '22023';
  end if;

  delete from public.listing_attribute_values
  where listing_id = p_listing_id;

  for v_field in
    select
      field_row.key,
      field_row.field_type,
      field_row.data_provider_key,
      input_row.value as input_value,
      rule_row.sort_order
    from jsonb_each(v_attributes) input_row
    join public.taxonomy_field_rules rule_row
      on rule_row.version_id = v_version_id
     and rule_row.taxonomy_node_id = v_taxonomy_node_id
     and rule_row.field_key = input_row.key
    join public.field_definitions field_row
      on field_row.key = rule_row.field_key
     and field_row.is_active
    where input_row.value <> 'null'::jsonb
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
        raise exception 'listing_attribute_text_json_required: %', v_field.key
          using errcode = '22023';
      end if;
      v_scalar_text := btrim(v_input #>> '{}');
      if v_scalar_text = '' then
        continue;
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_text, source
      ) values (
        p_listing_id, v_field.key, v_scalar_text, 'user'
      );

    elsif v_field.field_type in ('integer', 'numeric', 'year') then
      if jsonb_typeof(v_input) <> 'number' then
        raise exception 'listing_attribute_numeric_json_required: %', v_field.key
          using errcode = '22023';
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_numeric, source
      ) values (
        p_listing_id, v_field.key, (v_input #>> '{}')::numeric, 'user'
      );

    elsif v_field.field_type = 'boolean' then
      if jsonb_typeof(v_input) <> 'boolean' then
        raise exception 'listing_attribute_boolean_json_required: %', v_field.key
          using errcode = '22023';
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_boolean, source
      ) values (
        p_listing_id, v_field.key, (v_input #>> '{}')::boolean, 'user'
      );

    elsif v_field.field_type = 'date' then
      if jsonb_typeof(v_input) <> 'string' then
        raise exception 'listing_attribute_date_json_required: %', v_field.key
          using errcode = '22023';
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_date, source
      ) values (
        p_listing_id, v_field.key, (v_input #>> '{}')::date, 'user'
      );

    elsif v_field.field_type in ('single_select', 'reference', 'location') then
      if jsonb_typeof(v_input) <> 'string' then
        raise exception 'listing_attribute_key_json_required: %', v_field.key
          using errcode = '22023';
      end if;
      v_scalar_text := btrim(v_input #>> '{}');
      if v_scalar_text = '' then
        continue;
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_key, source
      ) values (
        p_listing_id, v_field.key, v_scalar_text, 'user'
      );

    elsif v_field.field_type = 'multi_select' then
      if jsonb_typeof(v_input) <> 'array' then
        raise exception 'listing_attribute_array_json_required: %', v_field.key
          using errcode = '22023';
      end if;
      if jsonb_array_length(v_input) = 0 then
        continue;
      end if;
      insert into public.listing_attribute_values (
        listing_id, field_key, value_json, source
      ) values (
        p_listing_id, v_field.key, v_input, 'user'
      );

    else
      raise exception 'listing_attribute_field_type_unsupported: %', v_field.field_type
        using errcode = '0A000';
    end if;

    v_written_count := v_written_count + 1;
  end loop;

  update public.listings
  set updated_at = now()
  where id = p_listing_id
  returning updated_at into v_updated_at;

  return jsonb_build_object(
    'listingId', p_listing_id,
    'updatedAt', v_updated_at,
    'writtenCount', v_written_count,
    'completeness', public.rawaj_listing_attribute_completeness_v1(p_listing_id)
  );
end;
$$;

revoke all on function public.rawaj_listing_attribute_completeness_v1(uuid)
  from public, anon;
revoke all on function public.rawaj_owner_replace_listing_attributes_v1(uuid, timestamptz, jsonb)
  from public, anon;
grant execute on function public.rawaj_listing_attribute_completeness_v1(uuid)
  to authenticated;
grant execute on function public.rawaj_owner_replace_listing_attributes_v1(uuid, timestamptz, jsonb)
  to authenticated;

comment on function public.rawaj_listing_attribute_completeness_v1(uuid) is
  'Authorized completeness report for the published Leaf schema, including stable missing required-field metadata.';
comment on function public.rawaj_owner_replace_listing_attributes_v1(uuid, timestamptz, jsonb) is
  'Stale-safe atomic full replacement of typed attributes for an owned editable listing. Dormant until the listing has a published active Leaf assignment.';
