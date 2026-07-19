-- RAWAJ Taxonomy, Data & Search Foundation V1: governed review and apply queues.
-- Queue review never changes listings. Confirmed taxonomy mappings are applied only by an owner
-- after the referenced taxonomy version has been published into the runtime taxonomy.

alter table public.taxonomy_mapping_queue
  drop constraint if exists taxonomy_mapping_queue_status_check;

alter table public.taxonomy_mapping_queue
  add constraint taxonomy_mapping_queue_status_check check (
    status in (
      'pending',
      'auto_mapped',
      'needs_review',
      'confirmed',
      'unresolved',
      'rejected',
      'applied'
    )
  );

alter table public.taxonomy_mapping_queue
  add column if not exists applied_by uuid references public.profiles(id) on delete set null,
  add column if not exists applied_at timestamptz;

create index if not exists taxonomy_mapping_queue_reviewed_status_idx
  on public.taxonomy_mapping_queue(reviewed_at desc, status, listing_id);

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
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_items jsonb;
  v_total bigint;
begin
  if auth.uid() is null or not public.current_user_is_admin_like() then
    raise exception 'Admin-like permission required.' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'pending', 'auto_mapped', 'needs_review', 'confirmed', 'unresolved', 'rejected', 'applied'
  ) then
    raise exception 'Invalid taxonomy mapping queue status.' using errcode = '22023';
  end if;

  select count(*)
    into v_total
  from public.taxonomy_mapping_queue queue_row
  where v_status is null or queue_row.status = v_status;

  select coalesce(jsonb_agg(item_row.payload order by item_row.updated_at desc, item_row.listing_id), '[]'::jsonb)
    into v_items
  from (
    select
      queue_row.updated_at,
      queue_row.listing_id,
      jsonb_build_object(
        'listingId', queue_row.listing_id,
        'listingTitle', listing_row.title,
        'listingStatus', listing_row.status,
        'ownerId', listing_row.owner_id,
        'legacyCategoryId', listing_row.category_id,
        'legacySubcategoryId', listing_row.subcategory_id,
        'currentTaxonomyNodeId', queue_row.current_taxonomy_node_id,
        'currentTaxonomyNameAr', current_node.name_ar,
        'suggestedVersionId', queue_row.suggested_version_id,
        'suggestedVersionNumber', suggested_version.version_number,
        'suggestedVersionStatus', suggested_version.status,
        'suggestedTaxonomyNodeId', queue_row.suggested_taxonomy_node_id,
        'suggestedTaxonomyNameAr', suggested_node.name_ar,
        'suggestedTaxonomyNameEn', suggested_node.name_en,
        'confidence', queue_row.confidence,
        'status', queue_row.status,
        'mappingSource', queue_row.mapping_source,
        'evidence', queue_row.evidence,
        'attemptCount', queue_row.attempt_count,
        'reviewedBy', queue_row.reviewed_by,
        'reviewedAt', queue_row.reviewed_at,
        'reviewNote', queue_row.review_note,
        'appliedBy', queue_row.applied_by,
        'appliedAt', queue_row.applied_at,
        'createdAt', queue_row.created_at,
        'updatedAt', queue_row.updated_at
      ) as payload
    from public.taxonomy_mapping_queue queue_row
    join public.listings listing_row on listing_row.id = queue_row.listing_id
    left join public.taxonomy_nodes current_node
      on current_node.id = queue_row.current_taxonomy_node_id
    left join public.taxonomy_versions suggested_version
      on suggested_version.id = queue_row.suggested_version_id
    left join public.taxonomy_version_nodes suggested_node
      on suggested_node.version_id = queue_row.suggested_version_id
     and suggested_node.node_id = queue_row.suggested_taxonomy_node_id
    where v_status is null or queue_row.status = v_status
    order by queue_row.updated_at desc, queue_row.listing_id
    limit v_limit
    offset v_offset
  ) item_row;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function public.rawaj_admin_review_taxonomy_mapping_v1(
  p_listing_id uuid,
  p_action text,
  p_suggested_version_id uuid default null,
  p_suggested_taxonomy_node_id text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_queue public.taxonomy_mapping_queue%rowtype;
  v_version_id uuid;
  v_node_id text;
  v_node public.taxonomy_version_nodes%rowtype;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Admin-like permission required.' using errcode = '42501';
  end if;

  if v_action not in ('confirm', 'reject', 'unresolve') then
    raise exception 'Invalid taxonomy mapping review action.' using errcode = '22023';
  end if;

  select * into v_queue
  from public.taxonomy_mapping_queue
  where listing_id = p_listing_id
  for update;

  if not found then
    raise exception 'Taxonomy mapping queue item not found.' using errcode = 'P0002';
  end if;

  if v_queue.status = 'applied' then
    raise exception 'Applied taxonomy mappings cannot be reviewed again.' using errcode = '23514';
  end if;

  if v_action = 'confirm' then
    v_version_id := coalesce(p_suggested_version_id, v_queue.suggested_version_id);
    v_node_id := coalesce(nullif(btrim(coalesce(p_suggested_taxonomy_node_id, '')), ''), v_queue.suggested_taxonomy_node_id);

    if v_version_id is null or v_node_id is null then
      raise exception 'A taxonomy version and leaf are required to confirm a mapping.' using errcode = '22023';
    end if;

    select * into v_node
    from public.taxonomy_version_nodes
    where version_id = v_version_id
      and node_id = v_node_id
      and is_active
      and is_leaf;

    if not found then
      raise exception 'Suggested taxonomy node must be an active leaf in the selected version.' using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.taxonomy_versions
      where id = v_version_id and status in ('draft', 'published')
    ) then
      raise exception 'Suggested taxonomy version is not reviewable.' using errcode = '23514';
    end if;

    update public.taxonomy_mapping_queue
    set suggested_version_id = v_version_id,
        suggested_taxonomy_node_id = v_node_id,
        status = 'confirmed',
        mapping_source = 'manual',
        reviewed_by = v_actor,
        reviewed_at = now(),
        review_note = v_note,
        updated_at = now()
    where listing_id = p_listing_id;
  elsif v_action = 'reject' then
    update public.taxonomy_mapping_queue
    set status = 'rejected',
        reviewed_by = v_actor,
        reviewed_at = now(),
        review_note = v_note,
        updated_at = now()
    where listing_id = p_listing_id;
  else
    update public.taxonomy_mapping_queue
    set suggested_version_id = null,
        suggested_taxonomy_node_id = null,
        confidence = null,
        status = 'unresolved',
        mapping_source = 'manual',
        reviewed_by = v_actor,
        reviewed_at = now(),
        review_note = v_note,
        updated_at = now()
    where listing_id = p_listing_id;
  end if;

  perform public.rawaj_insert_audit_log(
    'taxonomy.mapping_reviewed',
    'taxonomy_mapping_queue',
    p_listing_id::text,
    jsonb_build_object(
      'action', v_action,
      'suggestedVersionId', v_version_id,
      'suggestedTaxonomyNodeId', v_node_id,
      'note', v_note
    )
  );

  return (
    select jsonb_build_object(
      'listingId', queue_row.listing_id,
      'status', queue_row.status,
      'suggestedVersionId', queue_row.suggested_version_id,
      'suggestedTaxonomyNodeId', queue_row.suggested_taxonomy_node_id,
      'reviewedBy', queue_row.reviewed_by,
      'reviewedAt', queue_row.reviewed_at,
      'reviewNote', queue_row.review_note
    )
    from public.taxonomy_mapping_queue queue_row
    where queue_row.listing_id = p_listing_id
  );
end;
$$;

create or replace function public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(
  p_version_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_version_number integer;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_ids jsonb := '[]'::jsonb;
  v_row record;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.' using errcode = '42501';
  end if;

  select version_number
    into v_version_number
  from public.taxonomy_versions
  where id = p_version_id
    and status = 'published';

  if v_version_number is null then
    raise exception 'Only a published taxonomy version can be applied.' using errcode = '23514';
  end if;

  for v_row in
    select queue_row.listing_id, queue_row.suggested_taxonomy_node_id
    from public.taxonomy_mapping_queue queue_row
    where queue_row.status = 'confirmed'
      and queue_row.suggested_version_id = p_version_id
    order by queue_row.reviewed_at nulls last, queue_row.listing_id
    limit v_limit
    for update skip locked
  loop
    if not exists (
      select 1
      from public.listings listing_row
      where listing_row.id = v_row.listing_id
    ) or not exists (
      select 1
      from public.taxonomy_nodes node_row
      where node_row.id = v_row.suggested_taxonomy_node_id
        and node_row.is_active
        and node_row.is_leaf
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.listing_taxonomy_assignments (
      listing_id,
      taxonomy_node_id,
      assignment_source,
      created_at,
      updated_at
    )
    values (
      v_row.listing_id,
      v_row.suggested_taxonomy_node_id,
      'explicit',
      now(),
      now()
    )
    on conflict (listing_id) do update
    set taxonomy_node_id = excluded.taxonomy_node_id,
        assignment_source = 'explicit',
        updated_at = now();

    update public.taxonomy_mapping_queue
    set current_taxonomy_node_id = v_row.suggested_taxonomy_node_id,
        status = 'applied',
        applied_by = v_actor,
        applied_at = now(),
        updated_at = now()
    where listing_id = v_row.listing_id;

    v_applied := v_applied + 1;
    v_ids := v_ids || jsonb_build_array(v_row.listing_id);
  end loop;

  perform public.rawaj_insert_audit_log(
    'taxonomy.confirmed_mappings_applied',
    'taxonomy_versions',
    p_version_id::text,
    jsonb_build_object(
      'versionNumber', v_version_number,
      'appliedCount', v_applied,
      'skippedCount', v_skipped,
      'listingIds', v_ids
    )
  );

  return jsonb_build_object(
    'versionId', p_version_id,
    'versionNumber', v_version_number,
    'appliedCount', v_applied,
    'skippedCount', v_skipped,
    'listingIds', v_ids
  );
end;
$$;

create or replace function public.rawaj_admin_fetch_vehicle_reference_review_queue_v1(
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_entity_type text := nullif(btrim(coalesce(p_entity_type, '')), '');
  v_items jsonb;
  v_total bigint;
begin
  if auth.uid() is null or not public.current_user_is_admin_like() then
    raise exception 'Admin-like permission required.' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('pending', 'matched', 'created', 'rejected') then
    raise exception 'Invalid vehicle review status.' using errcode = '22023';
  end if;

  if v_entity_type is not null and v_entity_type not in ('make', 'model', 'generation', 'trim') then
    raise exception 'Invalid vehicle entity type.' using errcode = '22023';
  end if;

  select count(*) into v_total
  from public.vehicle_reference_review_queue queue_row
  where (v_status is null or queue_row.status = v_status)
    and (v_entity_type is null or queue_row.entity_type = v_entity_type);

  select coalesce(jsonb_agg(item_row.payload order by item_row.occurrence_count desc, item_row.updated_at desc), '[]'::jsonb)
    into v_items
  from (
    select
      queue_row.occurrence_count,
      queue_row.updated_at,
      jsonb_build_object(
        'id', queue_row.id,
        'entityType', queue_row.entity_type,
        'parentMakeId', queue_row.parent_make_id,
        'parentModelId', queue_row.parent_model_id,
        'rawValue', queue_row.raw_value,
        'normalizedValue', queue_row.normalized_value,
        'suggestedMatchId', queue_row.suggested_match_id,
        'listingId', queue_row.listing_id,
        'listingTitle', listing_row.title,
        'requestedBy', queue_row.requested_by,
        'status', queue_row.status,
        'occurrenceCount', queue_row.occurrence_count,
        'reviewNote', queue_row.review_note,
        'reviewedBy', queue_row.reviewed_by,
        'reviewedAt', queue_row.reviewed_at,
        'createdAt', queue_row.created_at,
        'updatedAt', queue_row.updated_at
      ) as payload
    from public.vehicle_reference_review_queue queue_row
    left join public.listings listing_row on listing_row.id = queue_row.listing_id
    where (v_status is null or queue_row.status = v_status)
      and (v_entity_type is null or queue_row.entity_type = v_entity_type)
    order by queue_row.occurrence_count desc, queue_row.updated_at desc
    limit v_limit
    offset v_offset
  ) item_row;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function public.rawaj_admin_review_vehicle_reference_v1(
  p_queue_id uuid,
  p_action text,
  p_match_id text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_match_id text := nullif(btrim(coalesce(p_match_id, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_queue public.vehicle_reference_review_queue%rowtype;
  v_valid boolean := false;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Admin-like permission required.' using errcode = '42501';
  end if;

  if v_action not in ('match', 'created', 'reject') then
    raise exception 'Invalid vehicle review action.' using errcode = '22023';
  end if;

  select * into v_queue
  from public.vehicle_reference_review_queue
  where id = p_queue_id
  for update;

  if not found then
    raise exception 'Vehicle review queue item not found.' using errcode = 'P0002';
  end if;

  if v_action in ('match', 'created') then
    if v_match_id is null then
      raise exception 'A controlled reference ID is required.' using errcode = '22023';
    end if;

    if v_queue.entity_type = 'make' then
      select exists (
        select 1 from public.vehicle_makes where id = v_match_id and is_active
      ) into v_valid;
    elsif v_queue.entity_type = 'model' then
      select exists (
        select 1 from public.vehicle_models
        where id = v_match_id and make_id = v_queue.parent_make_id and is_active
      ) into v_valid;
    elsif v_queue.entity_type = 'generation' then
      select exists (
        select 1 from public.vehicle_generations
        where id = v_match_id and model_id = v_queue.parent_model_id and is_active
      ) into v_valid;
    else
      select exists (
        select 1 from public.vehicle_trims
        where id = v_match_id and model_id = v_queue.parent_model_id and is_active
      ) into v_valid;
    end if;

    if not v_valid then
      raise exception 'Controlled vehicle reference does not match the queue scope.' using errcode = '23514';
    end if;

    update public.vehicle_reference_review_queue
    set suggested_match_id = v_match_id,
        status = case when v_action = 'created' then 'created' else 'matched' end,
        review_note = v_note,
        reviewed_by = v_actor,
        reviewed_at = now(),
        updated_at = now()
    where id = p_queue_id;
  else
    update public.vehicle_reference_review_queue
    set suggested_match_id = null,
        status = 'rejected',
        review_note = v_note,
        reviewed_by = v_actor,
        reviewed_at = now(),
        updated_at = now()
    where id = p_queue_id;
  end if;

  perform public.rawaj_insert_audit_log(
    'vehicle.reference_reviewed',
    'vehicle_reference_review_queue',
    p_queue_id::text,
    jsonb_build_object(
      'action', v_action,
      'entityType', v_queue.entity_type,
      'matchId', v_match_id,
      'note', v_note
    )
  );

  return (
    select jsonb_build_object(
      'id', queue_row.id,
      'entityType', queue_row.entity_type,
      'status', queue_row.status,
      'suggestedMatchId', queue_row.suggested_match_id,
      'reviewedBy', queue_row.reviewed_by,
      'reviewedAt', queue_row.reviewed_at,
      'reviewNote', queue_row.review_note
    )
    from public.vehicle_reference_review_queue queue_row
    where queue_row.id = p_queue_id
  );
end;
$$;

revoke all on function public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text, integer, integer) from public, anon;
revoke all on function public.rawaj_admin_review_taxonomy_mapping_v1(uuid, text, uuid, text, text) from public, anon;
revoke all on function public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(uuid, integer) from public, anon;
revoke all on function public.rawaj_admin_fetch_vehicle_reference_review_queue_v1(text, text, integer, integer) from public, anon;
revoke all on function public.rawaj_admin_review_vehicle_reference_v1(uuid, text, text, text) from public, anon;

grant execute on function public.rawaj_admin_fetch_taxonomy_mapping_queue_v1(text, integer, integer) to authenticated;
grant execute on function public.rawaj_admin_review_taxonomy_mapping_v1(uuid, text, uuid, text, text) to authenticated;
grant execute on function public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(uuid, integer) to authenticated;
grant execute on function public.rawaj_admin_fetch_vehicle_reference_review_queue_v1(text, text, integer, integer) to authenticated;
grant execute on function public.rawaj_admin_review_vehicle_reference_v1(uuid, text, text, text) to authenticated;

comment on function public.rawaj_admin_review_taxonomy_mapping_v1(uuid, text, uuid, text, text) is
  'Reviews a non-destructive listing taxonomy suggestion. Confirmation does not mutate the listing.';
comment on function public.rawaj_owner_apply_confirmed_taxonomy_mappings_v1(uuid, integer) is
  'Owner-only batch application of confirmed mappings after the referenced taxonomy version is published.';
comment on function public.rawaj_admin_review_vehicle_reference_v1(uuid, text, text, text) is
  'Reviews unknown vehicle values against the controlled catalog without silently changing listing data.';
