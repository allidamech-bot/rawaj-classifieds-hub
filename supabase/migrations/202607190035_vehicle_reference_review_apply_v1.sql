-- RAWAJ Taxonomy, Data & Search Foundation V1: governed vehicle reference review.
-- Queue values are never promoted automatically. Admin-like staff may match or reject;
-- only the owner may create canonical catalog rows or apply a reviewed result to a listing.

alter table public.vehicle_reference_review_queue
  add column if not exists reviewed_listing_updated_at timestamptz,
  add column if not exists applied_by uuid references public.profiles(id) on delete set null,
  add column if not exists applied_at timestamptz;

alter table public.vehicle_reference_review_queue
  drop constraint if exists vehicle_reference_review_queue_status_check;
alter table public.vehicle_reference_review_queue
  add constraint vehicle_reference_review_queue_status_check check (
    status in ('pending', 'matched', 'created', 'rejected', 'applied')
  );

alter table public.vehicle_reference_review_queue
  drop constraint if exists vehicle_reference_review_queue_applied_metadata_check;
alter table public.vehicle_reference_review_queue
  add constraint vehicle_reference_review_queue_applied_metadata_check check (
    status <> 'applied'
    or (applied_by is not null and applied_at is not null)
  );

create index if not exists vehicle_reference_review_queue_reviewed_status_idx
  on public.vehicle_reference_review_queue(
    status,
    reviewed_at desc nulls last,
    entity_type,
    id
  );

create or replace function public.rawaj_admin_fetch_vehicle_reference_queue_v1(
  p_status text default null,
  p_entity_type text default null,
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
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
  v_entity_type text := nullif(lower(btrim(coalesce(p_entity_type, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin_like() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;

  if v_status is not null
    and v_status not in ('pending', 'matched', 'created', 'rejected', 'applied') then
    raise exception 'invalid_vehicle_reference_queue_status' using errcode = '22023';
  end if;

  if v_entity_type is not null
    and v_entity_type not in ('make', 'model', 'generation', 'trim') then
    raise exception 'invalid_vehicle_reference_entity_type' using errcode = '22023';
  end if;

  with filtered as (
    select queue_row.*
    from public.vehicle_reference_review_queue queue_row
    where (v_status is null or queue_row.status = v_status)
      and (v_entity_type is null or queue_row.entity_type = v_entity_type)
  ),
  page_rows as (
    select filtered.*
    from filtered
    order by
      case filtered.status
        when 'pending' then 1
        when 'matched' then 2
        when 'created' then 3
        when 'rejected' then 4
        else 5
      end,
      filtered.occurrence_count desc,
      filtered.updated_at desc,
      filtered.id
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
          'id', page_row.id,
          'entityType', page_row.entity_type,
          'parentMakeId', page_row.parent_make_id,
          'parentMakeNameAr', parent_make.name_ar,
          'parentMakeNameEn', parent_make.name_en,
          'parentModelId', page_row.parent_model_id,
          'parentModelNameAr', parent_model.name_ar,
          'parentModelNameEn', parent_model.name_en,
          'rawValue', page_row.raw_value,
          'normalizedValue', page_row.normalized_value,
          'suggestedMatchId', page_row.suggested_match_id,
          'suggestedMatchNameAr', case page_row.entity_type
            when 'make' then matched_make.name_ar
            when 'model' then matched_model.name_ar
            when 'generation' then matched_generation.name_ar
            when 'trim' then matched_trim.name_ar
            else null
          end,
          'suggestedMatchNameEn', case page_row.entity_type
            when 'make' then matched_make.name_en
            when 'model' then matched_model.name_en
            when 'generation' then matched_generation.name_en
            when 'trim' then matched_trim.name_en
            else null
          end,
          'listingId', page_row.listing_id,
          'listingTitle', listing_row.title,
          'listingStatus', listing_row.status,
          'listingUpdatedAt', listing_row.updated_at,
          'requestedBy', page_row.requested_by,
          'status', page_row.status,
          'occurrenceCount', page_row.occurrence_count,
          'reviewNote', page_row.review_note,
          'reviewedBy', page_row.reviewed_by,
          'reviewedAt', page_row.reviewed_at,
          'reviewedListingUpdatedAt', page_row.reviewed_listing_updated_at,
          'appliedBy', page_row.applied_by,
          'appliedAt', page_row.applied_at,
          'createdAt', page_row.created_at,
          'updatedAt', page_row.updated_at
        )
        order by
          case page_row.status
            when 'pending' then 1
            when 'matched' then 2
            when 'created' then 3
            when 'rejected' then 4
            else 5
          end,
          page_row.occurrence_count desc,
          page_row.updated_at desc,
          page_row.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from page_rows page_row
  left join public.vehicle_makes parent_make
    on parent_make.id = page_row.parent_make_id
  left join public.vehicle_models parent_model
    on parent_model.id = page_row.parent_model_id
  left join public.vehicle_makes matched_make
    on page_row.entity_type = 'make'
   and matched_make.id = page_row.suggested_match_id
  left join public.vehicle_models matched_model
    on page_row.entity_type = 'model'
   and matched_model.id = page_row.suggested_match_id
  left join public.vehicle_generations matched_generation
    on page_row.entity_type = 'generation'
   and matched_generation.id = page_row.suggested_match_id
  left join public.vehicle_trims matched_trim
    on page_row.entity_type = 'trim'
   and matched_trim.id = page_row.suggested_match_id
  left join public.listings listing_row
    on listing_row.id = page_row.listing_id;

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

create or replace function public.rawaj_admin_review_vehicle_reference_v1(
  p_queue_id uuid,
  p_decision text,
  p_match_id text default null,
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
  v_match_id text := nullif(btrim(coalesce(p_match_id, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_queue public.vehicle_reference_review_queue%rowtype;
  v_listing_updated_at timestamptz;
  v_resolved_parent_make_id text;
  v_resolved_parent_model_id text;
  v_previous_status text;
  v_previous_match_id text;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'admin_permission_required' using errcode = '42501';
  end if;

  if p_queue_id is null then
    raise exception 'vehicle_reference_queue_id_required' using errcode = '22023';
  end if;

  if v_decision not in ('match', 'reject') then
    raise exception 'vehicle_reference_review_decision_invalid' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'vehicle_reference_review_note_too_long' using errcode = '22023';
  end if;

  select queue_row.*
    into v_queue
  from public.vehicle_reference_review_queue queue_row
  where queue_row.id = p_queue_id
  for update;

  if not found then
    raise exception 'vehicle_reference_queue_item_not_found' using errcode = 'P0002';
  end if;

  if v_queue.status in ('created', 'applied') then
    raise exception 'vehicle_reference_review_state_locked' using errcode = '55000';
  end if;

  if p_expected_queue_updated_at is null
    or v_queue.updated_at is distinct from p_expected_queue_updated_at then
    raise exception 'stale_vehicle_reference_review' using errcode = '40001';
  end if;

  if v_queue.listing_id is not null then
    select listing_row.updated_at
      into v_listing_updated_at
    from public.listings listing_row
    where listing_row.id = v_queue.listing_id;
  end if;

  v_previous_status := v_queue.status;
  v_previous_match_id := v_queue.suggested_match_id;

  if v_decision = 'reject' then
    update public.vehicle_reference_review_queue
    set suggested_match_id = null,
        status = 'rejected',
        review_note = v_note,
        reviewed_by = v_actor,
        reviewed_at = now(),
        reviewed_listing_updated_at = v_listing_updated_at,
        applied_by = null,
        applied_at = null
    where id = p_queue_id
    returning updated_at into v_updated_at;

    perform public.rawaj_insert_audit_log(
      'vehicle.reference_rejected',
      'vehicle_reference_review_queue',
      p_queue_id::text,
      jsonb_build_object(
        'entityType', v_queue.entity_type,
        'rawValue', v_queue.raw_value,
        'previousStatus', v_previous_status,
        'previousMatchId', v_previous_match_id,
        'note', v_note
      )
    );

    return jsonb_build_object(
      'id', p_queue_id,
      'status', 'rejected',
      'reviewedAt', now(),
      'updatedAt', v_updated_at
    );
  end if;

  if v_match_id is null then
    raise exception 'vehicle_reference_match_id_required' using errcode = '22023';
  end if;

  if v_queue.entity_type = 'make' then
    if not exists (
      select 1
      from public.vehicle_makes make_row
      where make_row.id = v_match_id
        and make_row.is_active
    ) then
      raise exception 'vehicle_reference_match_not_found' using errcode = 'P0002';
    end if;

  elsif v_queue.entity_type = 'model' then
    select model_row.make_id
      into v_resolved_parent_make_id
    from public.vehicle_models model_row
    where model_row.id = v_match_id
      and model_row.is_active;

    if v_resolved_parent_make_id is null then
      raise exception 'vehicle_reference_match_not_found' using errcode = 'P0002';
    end if;
    if v_resolved_parent_make_id is distinct from v_queue.parent_make_id then
      raise exception 'vehicle_reference_model_make_mismatch' using errcode = '23514';
    end if;

  elsif v_queue.entity_type = 'generation' then
    select generation_row.model_id
      into v_resolved_parent_model_id
    from public.vehicle_generations generation_row
    where generation_row.id = v_match_id
      and generation_row.is_active;

    if v_resolved_parent_model_id is null then
      raise exception 'vehicle_reference_match_not_found' using errcode = 'P0002';
    end if;
    if v_resolved_parent_model_id is distinct from v_queue.parent_model_id then
      raise exception 'vehicle_reference_generation_model_mismatch' using errcode = '23514';
    end if;

  elsif v_queue.entity_type = 'trim' then
    select trim_row.model_id
      into v_resolved_parent_model_id
    from public.vehicle_trims trim_row
    where trim_row.id = v_match_id
      and trim_row.is_active;

    if v_resolved_parent_model_id is null then
      raise exception 'vehicle_reference_match_not_found' using errcode = 'P0002';
    end if;
    if v_resolved_parent_model_id is distinct from v_queue.parent_model_id then
      raise exception 'vehicle_reference_trim_model_mismatch' using errcode = '23514';
    end if;

  else
    raise exception 'vehicle_reference_entity_type_invalid' using errcode = '23514';
  end if;

  update public.vehicle_reference_review_queue
  set suggested_match_id = v_match_id,
      status = 'matched',
      review_note = v_note,
      reviewed_by = v_actor,
      reviewed_at = now(),
      reviewed_listing_updated_at = v_listing_updated_at,
      applied_by = null,
      applied_at = null
  where id = p_queue_id
  returning updated_at into v_updated_at;

  perform public.rawaj_insert_audit_log(
    'vehicle.reference_matched',
    'vehicle_reference_review_queue',
    p_queue_id::text,
    jsonb_build_object(
      'entityType', v_queue.entity_type,
      'rawValue', v_queue.raw_value,
      'previousStatus', v_previous_status,
      'previousMatchId', v_previous_match_id,
      'matchId', v_match_id,
      'listingUpdatedAt', v_listing_updated_at,
      'note', v_note
    )
  );

  return jsonb_build_object(
    'id', p_queue_id,
    'status', 'matched',
    'entityType', v_queue.entity_type,
    'matchId', v_match_id,
    'reviewedAt', now(),
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.rawaj_owner_create_vehicle_reference_from_queue_v1(
  p_queue_id uuid,
  p_reference jsonb,
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
  v_queue public.vehicle_reference_review_queue%rowtype;
  v_reference jsonb := coalesce(p_reference, '{}'::jsonb);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id text;
  v_slug text;
  v_name_ar text;
  v_name_en text;
  v_country_code text;
  v_vehicle_type text;
  v_generation_id text;
  v_start_year integer;
  v_end_year integer;
  v_aliases text[] := '{}'::text[];
  v_listing_updated_at timestamptz;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;

  if p_queue_id is null then
    raise exception 'vehicle_reference_queue_id_required' using errcode = '22023';
  end if;

  if jsonb_typeof(v_reference) <> 'object' then
    raise exception 'vehicle_reference_object_required' using errcode = '22023';
  end if;

  select queue_row.*
    into v_queue
  from public.vehicle_reference_review_queue queue_row
  where queue_row.id = p_queue_id
  for update;

  if not found then
    raise exception 'vehicle_reference_queue_item_not_found' using errcode = 'P0002';
  end if;

  if v_queue.status in ('created', 'applied') then
    raise exception 'vehicle_reference_creation_state_locked' using errcode = '55000';
  end if;

  if p_expected_queue_updated_at is null
    or v_queue.updated_at is distinct from p_expected_queue_updated_at then
    raise exception 'stale_vehicle_reference_creation' using errcode = '40001';
  end if;

  v_id := lower(btrim(coalesce(v_reference ->> 'id', '')));
  v_slug := lower(btrim(coalesce(v_reference ->> 'slug', v_id)));
  v_name_ar := btrim(coalesce(v_reference ->> 'nameAr', v_queue.raw_value, ''));
  v_name_en := btrim(coalesce(v_reference ->> 'nameEn', v_name_ar));
  v_country_code := nullif(upper(btrim(coalesce(v_reference ->> 'countryCode', ''))), '');
  v_vehicle_type := nullif(lower(btrim(coalesce(v_reference ->> 'vehicleType', ''))), '');
  v_generation_id := nullif(lower(btrim(coalesce(v_reference ->> 'generationId', ''))), '');

  if v_id !~ '^[a-z0-9][a-z0-9-]*$'
    or v_slug !~ '^[a-z0-9][a-z0-9-]*$' then
    raise exception 'vehicle_reference_id_or_slug_invalid' using errcode = '22023';
  end if;

  if char_length(v_id) > 120
    or char_length(v_slug) > 120
    or char_length(v_name_ar) not between 1 and 120
    or char_length(v_name_en) not between 1 and 120 then
    raise exception 'vehicle_reference_text_length_invalid' using errcode = '22023';
  end if;

  if v_country_code is not null and v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'vehicle_reference_country_code_invalid' using errcode = '22023';
  end if;

  if v_reference ? 'startYear' and v_reference -> 'startYear' <> 'null'::jsonb then
    if jsonb_typeof(v_reference -> 'startYear') <> 'number' then
      raise exception 'vehicle_reference_start_year_numeric_required' using errcode = '22023';
    end if;
    v_start_year := (v_reference ->> 'startYear')::integer;
  end if;

  if v_reference ? 'endYear' and v_reference -> 'endYear' <> 'null'::jsonb then
    if jsonb_typeof(v_reference -> 'endYear') <> 'number' then
      raise exception 'vehicle_reference_end_year_numeric_required' using errcode = '22023';
    end if;
    v_end_year := (v_reference ->> 'endYear')::integer;
  end if;

  if (v_start_year is not null and v_start_year not between 1886 and 2100)
    or (v_end_year is not null and v_end_year not between 1886 and 2100)
    or (v_start_year is not null and v_end_year is not null and v_end_year < v_start_year) then
    raise exception 'vehicle_reference_year_range_invalid' using errcode = '22023';
  end if;

  if v_reference ? 'aliases' then
    if jsonb_typeof(v_reference -> 'aliases') <> 'array' then
      raise exception 'vehicle_reference_aliases_array_required' using errcode = '22023';
    end if;

    if jsonb_array_length(v_reference -> 'aliases') > 50 then
      raise exception 'vehicle_reference_alias_limit_exceeded' using errcode = '54000';
    end if;

    select coalesce(array_agg(distinct btrim(alias_value)), '{}'::text[])
      into v_aliases
    from jsonb_array_elements_text(v_reference -> 'aliases') alias_value
    where btrim(alias_value) <> '';

    if exists (
      select 1
      from unnest(v_aliases) alias_value
      where char_length(alias_value) > 120
    ) then
      raise exception 'vehicle_reference_alias_too_long' using errcode = '22023';
    end if;
  end if;

  select array_agg(distinct alias_value)
    into v_aliases
  from unnest(
    coalesce(v_aliases, '{}'::text[]) || array[v_queue.raw_value]
  ) alias_value
  where btrim(alias_value) <> '';
  v_aliases := coalesce(v_aliases, '{}'::text[]);

  if v_queue.entity_type = 'make' then
    if exists (
      select 1
      from public.vehicle_makes make_row
      where make_row.id = v_id or make_row.slug = v_slug
    ) then
      raise exception 'vehicle_reference_catalog_id_or_slug_exists' using errcode = '23505';
    end if;

    insert into public.vehicle_makes (
      id, slug, name_ar, name_en, aliases, country_code, sort_order
    )
    values (
      v_id,
      v_slug,
      v_name_ar,
      v_name_en,
      v_aliases,
      v_country_code,
      coalesce((select max(sort_order) + 10 from public.vehicle_makes), 10)
    );

  elsif v_queue.entity_type = 'model' then
    if not exists (
      select 1
      from public.vehicle_makes make_row
      where make_row.id = v_queue.parent_make_id
        and make_row.is_active
    ) then
      raise exception 'vehicle_reference_parent_make_missing' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.vehicle_models model_row
      where model_row.id = v_id
        or (model_row.make_id = v_queue.parent_make_id and model_row.slug = v_slug)
    ) then
      raise exception 'vehicle_reference_catalog_id_or_slug_exists' using errcode = '23505';
    end if;

    insert into public.vehicle_models (
      id, make_id, slug, name_ar, name_en, aliases, vehicle_type,
      start_year, end_year, sort_order
    )
    values (
      v_id,
      v_queue.parent_make_id,
      v_slug,
      v_name_ar,
      v_name_en,
      v_aliases,
      v_vehicle_type,
      v_start_year,
      v_end_year,
      coalesce((
        select max(sort_order) + 10
        from public.vehicle_models
        where make_id = v_queue.parent_make_id
      ), 10)
    );

  elsif v_queue.entity_type = 'generation' then
    if not exists (
      select 1
      from public.vehicle_models model_row
      where model_row.id = v_queue.parent_model_id
        and model_row.is_active
    ) then
      raise exception 'vehicle_reference_parent_model_missing' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.vehicle_generations generation_row
      where generation_row.id = v_id
        or (generation_row.model_id = v_queue.parent_model_id and generation_row.slug = v_slug)
    ) then
      raise exception 'vehicle_reference_catalog_id_or_slug_exists' using errcode = '23505';
    end if;

    insert into public.vehicle_generations (
      id, model_id, slug, name_ar, name_en, aliases,
      start_year, end_year, sort_order
    )
    values (
      v_id,
      v_queue.parent_model_id,
      v_slug,
      v_name_ar,
      v_name_en,
      v_aliases,
      v_start_year,
      v_end_year,
      coalesce((
        select max(sort_order) + 10
        from public.vehicle_generations
        where model_id = v_queue.parent_model_id
      ), 10)
    );

  elsif v_queue.entity_type = 'trim' then
    if not exists (
      select 1
      from public.vehicle_models model_row
      where model_row.id = v_queue.parent_model_id
        and model_row.is_active
    ) then
      raise exception 'vehicle_reference_parent_model_missing' using errcode = '23514';
    end if;

    if v_generation_id is not null and not exists (
      select 1
      from public.vehicle_generations generation_row
      where generation_row.id = v_generation_id
        and generation_row.model_id = v_queue.parent_model_id
        and generation_row.is_active
    ) then
      raise exception 'vehicle_reference_trim_generation_mismatch' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.vehicle_trims trim_row
      where trim_row.id = v_id
        or (trim_row.model_id = v_queue.parent_model_id and trim_row.slug = v_slug)
    ) then
      raise exception 'vehicle_reference_catalog_id_or_slug_exists' using errcode = '23505';
    end if;

    insert into public.vehicle_trims (
      id, model_id, generation_id, slug, name_ar, name_en, aliases,
      start_year, end_year, sort_order
    )
    values (
      v_id,
      v_queue.parent_model_id,
      v_generation_id,
      v_slug,
      v_name_ar,
      v_name_en,
      v_aliases,
      v_start_year,
      v_end_year,
      coalesce((
        select max(sort_order) + 10
        from public.vehicle_trims
        where model_id = v_queue.parent_model_id
      ), 10)
    );

  else
    raise exception 'vehicle_reference_entity_type_invalid' using errcode = '23514';
  end if;

  if v_queue.listing_id is not null then
    select listing_row.updated_at
      into v_listing_updated_at
    from public.listings listing_row
    where listing_row.id = v_queue.listing_id;
  end if;

  update public.vehicle_reference_review_queue
  set suggested_match_id = v_id,
      status = 'created',
      review_note = v_note,
      reviewed_by = v_actor,
      reviewed_at = now(),
      reviewed_listing_updated_at = v_listing_updated_at,
      applied_by = null,
      applied_at = null
  where id = p_queue_id
  returning updated_at into v_updated_at;

  perform public.rawaj_insert_audit_log(
    'vehicle.reference_created',
    case v_queue.entity_type
      when 'make' then 'vehicle_makes'
      when 'model' then 'vehicle_models'
      when 'generation' then 'vehicle_generations'
      else 'vehicle_trims'
    end,
    v_id,
    jsonb_build_object(
      'queueId', p_queue_id,
      'entityType', v_queue.entity_type,
      'rawValue', v_queue.raw_value,
      'parentMakeId', v_queue.parent_make_id,
      'parentModelId', v_queue.parent_model_id,
      'note', v_note
    )
  );

  return jsonb_build_object(
    'id', p_queue_id,
    'status', 'created',
    'entityType', v_queue.entity_type,
    'referenceId', v_id,
    'reviewedAt', now(),
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function public.rawaj_set_vehicle_attribute_if_absent_v1(
  p_listing_id uuid,
  p_field_key text,
  p_value_key text
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_value text;
begin
  select attribute_row.value_key
    into v_existing_value
  from public.listing_attribute_values attribute_row
  where attribute_row.listing_id = p_listing_id
    and attribute_row.field_key = p_field_key;

  if found then
    if v_existing_value is distinct from p_value_key then
      raise exception 'vehicle_reference_existing_attribute_conflict: %', p_field_key
        using errcode = '23514';
    end if;
    return 0;
  end if;

  insert into public.listing_attribute_values (
    listing_id, field_key, value_key, source
  )
  values (
    p_listing_id, p_field_key, p_value_key, 'legacy_backfill'
  );

  return 1;
end;
$$;

create or replace function public.rawaj_owner_apply_vehicle_reference_resolution_v1(
  p_queue_id uuid,
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
  v_queue public.vehicle_reference_review_queue%rowtype;
  v_listing public.listings%rowtype;
  v_published_version_id uuid;
  v_taxonomy_node_id text;
  v_make_id text;
  v_model_id text;
  v_generation_id text;
  v_trim_id text;
  v_inserted_count integer := 0;
  v_step_count integer := 0;
  v_queue_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'owner_permission_required' using errcode = '42501';
  end if;

  if p_queue_id is null then
    raise exception 'vehicle_reference_queue_id_required' using errcode = '22023';
  end if;

  select queue_row.*
    into v_queue
  from public.vehicle_reference_review_queue queue_row
  where queue_row.id = p_queue_id
  for update;

  if not found then
    raise exception 'vehicle_reference_queue_item_not_found' using errcode = 'P0002';
  end if;

  if v_queue.status not in ('matched', 'created') then
    raise exception 'vehicle_reference_requires_reviewed_resolution' using errcode = '55000';
  end if;

  if p_expected_reviewed_at is null
    or v_queue.reviewed_at is distinct from p_expected_reviewed_at then
    raise exception 'stale_vehicle_reference_application' using errcode = '40001';
  end if;

  if v_queue.listing_id is null then
    raise exception 'vehicle_reference_listing_required_for_application' using errcode = '23514';
  end if;

  if v_queue.suggested_match_id is null then
    raise exception 'vehicle_reference_match_required_for_application' using errcode = '23514';
  end if;

  select listing_row.*
    into v_listing
  from public.listings listing_row
  where listing_row.id = v_queue.listing_id
  for update;

  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  if v_queue.reviewed_listing_updated_at is null
    or v_listing.updated_at is distinct from v_queue.reviewed_listing_updated_at then
    raise exception 'listing_changed_after_vehicle_reference_review' using errcode = '40001';
  end if;

  select version_row.id, assignment_row.taxonomy_node_id
    into v_published_version_id, v_taxonomy_node_id
  from public.taxonomy_versions version_row
  join public.listing_taxonomy_assignments assignment_row
    on assignment_row.listing_id = v_listing.id
  join public.taxonomy_version_nodes node_row
    on node_row.version_id = version_row.id
   and node_row.node_id = assignment_row.taxonomy_node_id
  where version_row.status = 'published'
    and node_row.is_active
    and node_row.is_leaf
    and node_row.filter_schema_key = 'vehicles'
  order by version_row.version_number desc
  limit 1;

  if v_published_version_id is null or v_taxonomy_node_id is null then
    raise exception 'vehicle_reference_requires_published_vehicle_leaf' using errcode = '23514';
  end if;

  if v_queue.entity_type = 'make' then
    select make_row.id
      into v_make_id
    from public.vehicle_makes make_row
    where make_row.id = v_queue.suggested_match_id
      and make_row.is_active;

  elsif v_queue.entity_type = 'model' then
    select model_row.make_id, model_row.id
      into v_make_id, v_model_id
    from public.vehicle_models model_row
    join public.vehicle_makes make_row
      on make_row.id = model_row.make_id
     and make_row.is_active
    where model_row.id = v_queue.suggested_match_id
      and model_row.is_active;

    if v_make_id is distinct from v_queue.parent_make_id then
      raise exception 'vehicle_reference_model_make_mismatch' using errcode = '23514';
    end if;

  elsif v_queue.entity_type = 'generation' then
    select model_row.make_id, generation_row.model_id, generation_row.id
      into v_make_id, v_model_id, v_generation_id
    from public.vehicle_generations generation_row
    join public.vehicle_models model_row
      on model_row.id = generation_row.model_id
     and model_row.is_active
    join public.vehicle_makes make_row
      on make_row.id = model_row.make_id
     and make_row.is_active
    where generation_row.id = v_queue.suggested_match_id
      and generation_row.is_active;

    if v_model_id is distinct from v_queue.parent_model_id then
      raise exception 'vehicle_reference_generation_model_mismatch' using errcode = '23514';
    end if;

  elsif v_queue.entity_type = 'trim' then
    select
      model_row.make_id,
      trim_row.model_id,
      trim_row.generation_id,
      trim_row.id
      into v_make_id, v_model_id, v_generation_id, v_trim_id
    from public.vehicle_trims trim_row
    join public.vehicle_models model_row
      on model_row.id = trim_row.model_id
     and model_row.is_active
    join public.vehicle_makes make_row
      on make_row.id = model_row.make_id
     and make_row.is_active
    left join public.vehicle_generations generation_row
      on generation_row.id = trim_row.generation_id
     and generation_row.model_id = trim_row.model_id
     and generation_row.is_active
    where trim_row.id = v_queue.suggested_match_id
      and trim_row.is_active
      and (trim_row.generation_id is null or generation_row.id is not null);

    if v_model_id is distinct from v_queue.parent_model_id then
      raise exception 'vehicle_reference_trim_model_mismatch' using errcode = '23514';
    end if;

  else
    raise exception 'vehicle_reference_entity_type_invalid' using errcode = '23514';
  end if;

  if v_make_id is null then
    raise exception 'vehicle_reference_resolved_catalog_item_missing' using errcode = 'P0002';
  end if;

  v_step_count := public.rawaj_set_vehicle_attribute_if_absent_v1(
    v_listing.id,
    'vehicle_make',
    v_make_id
  );
  v_inserted_count := v_inserted_count + v_step_count;

  if v_model_id is not null then
    v_step_count := public.rawaj_set_vehicle_attribute_if_absent_v1(
      v_listing.id,
      'vehicle_model',
      v_model_id
    );
    v_inserted_count := v_inserted_count + v_step_count;
  end if;

  if v_generation_id is not null then
    v_step_count := public.rawaj_set_vehicle_attribute_if_absent_v1(
      v_listing.id,
      'vehicle_generation',
      v_generation_id
    );
    v_inserted_count := v_inserted_count + v_step_count;
  end if;

  if v_trim_id is not null then
    v_step_count := public.rawaj_set_vehicle_attribute_if_absent_v1(
      v_listing.id,
      'vehicle_trim',
      v_trim_id
    );
    v_inserted_count := v_inserted_count + v_step_count;
  end if;

  update public.vehicle_reference_review_queue
  set status = 'applied',
      applied_by = v_actor,
      applied_at = now()
  where id = p_queue_id
  returning updated_at into v_queue_updated_at;

  perform public.rawaj_insert_audit_log(
    'vehicle.reference_applied',
    'listing_attribute_values',
    v_listing.id::text,
    jsonb_build_object(
      'queueId', p_queue_id,
      'entityType', v_queue.entity_type,
      'referenceId', v_queue.suggested_match_id,
      'vehicleMakeId', v_make_id,
      'vehicleModelId', v_model_id,
      'vehicleGenerationId', v_generation_id,
      'vehicleTrimId', v_trim_id,
      'attributesInserted', v_inserted_count,
      'reviewedBy', v_queue.reviewed_by,
      'reviewedAt', v_queue.reviewed_at
    )
  );

  return jsonb_build_object(
    'id', p_queue_id,
    'status', 'applied',
    'listingId', v_listing.id,
    'entityType', v_queue.entity_type,
    'referenceId', v_queue.suggested_match_id,
    'attributesInserted', v_inserted_count,
    'queueUpdatedAt', v_queue_updated_at
  );
end;
$$;

revoke all on function public.rawaj_admin_fetch_vehicle_reference_queue_v1(
  text, text, integer, integer
) from public, anon;
revoke all on function public.rawaj_admin_review_vehicle_reference_v1(
  uuid, text, text, text, timestamptz
) from public, anon;
revoke all on function public.rawaj_owner_create_vehicle_reference_from_queue_v1(
  uuid, jsonb, text, timestamptz
) from public, anon;
revoke all on function public.rawaj_set_vehicle_attribute_if_absent_v1(
  uuid, text, text
) from public, anon, authenticated;
revoke all on function public.rawaj_owner_apply_vehicle_reference_resolution_v1(
  uuid, timestamptz
) from public, anon;

grant execute on function public.rawaj_admin_fetch_vehicle_reference_queue_v1(
  text, text, integer, integer
) to authenticated;
grant execute on function public.rawaj_admin_review_vehicle_reference_v1(
  uuid, text, text, text, timestamptz
) to authenticated;
grant execute on function public.rawaj_owner_create_vehicle_reference_from_queue_v1(
  uuid, jsonb, text, timestamptz
) to authenticated;
grant execute on function public.rawaj_owner_apply_vehicle_reference_resolution_v1(
  uuid, timestamptz
) to authenticated;

comment on function public.rawaj_admin_fetch_vehicle_reference_queue_v1(text, text, integer, integer) is
  'Admin-like private vehicle reference queue feed with catalog match, listing, review, and application context.';
comment on function public.rawaj_admin_review_vehicle_reference_v1(uuid, text, text, text, timestamptz) is
  'Stale-safe admin-like match or rejection. Parent make/model relationships are validated and listings remain untouched.';
comment on function public.rawaj_owner_create_vehicle_reference_from_queue_v1(uuid, jsonb, text, timestamptz) is
  'Owner-only canonical make/model/generation/trim creation from a reviewed unknown value without overwriting catalog rows.';
comment on function public.rawaj_set_vehicle_attribute_if_absent_v1(uuid, text, text) is
  'Internal merge-only helper that refuses conflicts and writes one ordered vehicle reference attribute.';
comment on function public.rawaj_owner_apply_vehicle_reference_resolution_v1(uuid, timestamptz) is
  'Owner-only application of a matched or newly created vehicle reference to a published vehicle Leaf, with stale and conflict protection.';
