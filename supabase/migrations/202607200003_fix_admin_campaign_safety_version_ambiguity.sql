-- RAWAJ admin action runtime repair.
-- Qualifies optimistic-concurrency version increments in campaign and safety RPCs
-- whose RETURNS TABLE output also exposes a column named version.

create or replace function public.rawaj_owner_upsert_campaign(
  p_id uuid,
  p_name text,
  p_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_target_pages text[],
  p_target_category_ids text[],
  p_expected_version bigint default null
)
returns table (
  id uuid,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
  v_pages text[] := coalesce(p_target_pages, array[]::text[]);
  v_categories text[] := coalesce(p_target_category_ids, array[]::text[]);
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 160 then
    raise exception 'Campaign name must be between 2 and 160 characters.';
  end if;

  if p_status not in ('draft', 'active', 'paused', 'ended') then
    raise exception 'Unsupported campaign status.';
  end if;

  if exists (
    select 1
    from unnest(v_pages) page
    where page not in ('home', 'search_results', 'listing_detail', 'categories', 'offers')
  ) then
    raise exception 'Unsupported campaign target page.';
  end if;

  if p_starts_at is not null
     and p_ends_at is not null
     and p_ends_at <= p_starts_at then
    raise exception 'End time must be after start time.';
  end if;

  if p_id is null then
    insert into public.ad_campaigns (
      name,
      status,
      starts_at,
      ends_at,
      target_pages,
      target_category_ids,
      created_by,
      updated_by
    )
    values (
      v_name,
      p_status,
      p_starts_at,
      p_ends_at,
      v_pages,
      v_categories,
      v_actor,
      v_actor
    )
    returning
      ad_campaigns.id,
      ad_campaigns.version,
      ad_campaigns.updated_at
    into
      v_id,
      v_version,
      v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for updates.';
    end if;

    update public.ad_campaigns as campaign_row
    set
      name = v_name,
      status = p_status,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      target_pages = v_pages,
      target_category_ids = v_categories,
      version = campaign_row.version + 1,
      updated_by = v_actor,
      updated_at = now()
    where campaign_row.id = p_id
      and campaign_row.version = p_expected_version
    returning
      campaign_row.id,
      campaign_row.version,
      campaign_row.updated_at
    into
      v_id,
      v_version,
      v_updated_at;

    if v_id is null then
      if exists (
        select 1
        from public.ad_campaigns existing_campaign
        where existing_campaign.id = p_id
      ) then
        raise exception 'stale_campaign';
      end if;

      raise exception 'Campaign does not exist.';
    end if;
  end if;

  perform public.rawaj_insert_audit_log(
    case when p_id is null then 'campaign.created' else 'campaign.updated' end,
    'ad_campaigns',
    v_id::text,
    jsonb_build_object(
      'name', v_name,
      'status', p_status,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'target_pages', v_pages,
      'target_category_ids', v_categories
    )
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_owner_set_campaign_status(
  p_id uuid,
  p_status text,
  p_expected_version bigint,
  p_reason text
)
returns table (
  id uuid,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if p_status not in ('draft', 'active', 'paused', 'ended') then
    raise exception 'Unsupported campaign status.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  update public.ad_campaigns as campaign_row
  set
    status = p_status,
    version = campaign_row.version + 1,
    updated_by = v_actor,
    updated_at = now()
  where campaign_row.id = p_id
    and campaign_row.version = p_expected_version
  returning
    campaign_row.id,
    campaign_row.version,
    campaign_row.updated_at
  into
    v_id,
    v_version,
    v_updated_at;

  if v_id is null then
    if exists (
      select 1
      from public.ad_campaigns existing_campaign
      where existing_campaign.id = p_id
    ) then
      raise exception 'stale_campaign';
    end if;

    raise exception 'Campaign does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'campaign.status_changed',
    'ad_campaigns',
    v_id::text,
    jsonb_build_object('status', p_status, 'reason', v_reason)
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_owner_upsert_campaign_creative(
  p_id uuid,
  p_campaign_id uuid,
  p_name text,
  p_image_url text,
  p_destination_url text,
  p_weight integer,
  p_is_active boolean,
  p_expected_version bigint default null
)
returns table (
  id uuid,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_image_url text := btrim(coalesce(p_image_url, ''));
  v_destination_url text := btrim(coalesce(p_destination_url, ''));
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if not exists (
    select 1 from public.ad_campaigns campaign_row where campaign_row.id = p_campaign_id
  ) then
    raise exception 'Campaign does not exist.';
  end if;

  if char_length(v_name) < 2 or v_image_url = '' or v_destination_url = '' then
    raise exception 'Creative name, image, and destination are required.';
  end if;

  if p_weight is null or p_weight < 1 or p_weight > 1000 then
    raise exception 'Creative weight must be between 1 and 1000.';
  end if;

  if p_id is null then
    insert into public.ad_campaign_creatives (
      campaign_id,
      name,
      image_url,
      destination_url,
      weight,
      is_active,
      created_by,
      updated_by
    )
    values (
      p_campaign_id,
      v_name,
      v_image_url,
      v_destination_url,
      p_weight,
      p_is_active,
      v_actor,
      v_actor
    )
    returning
      ad_campaign_creatives.id,
      ad_campaign_creatives.version,
      ad_campaign_creatives.updated_at
    into
      v_id,
      v_version,
      v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for creative updates.';
    end if;

    update public.ad_campaign_creatives as creative_row
    set
      name = v_name,
      image_url = v_image_url,
      destination_url = v_destination_url,
      weight = p_weight,
      is_active = p_is_active,
      version = creative_row.version + 1,
      updated_by = v_actor,
      updated_at = now()
    where creative_row.id = p_id
      and creative_row.campaign_id = p_campaign_id
      and creative_row.version = p_expected_version
    returning
      creative_row.id,
      creative_row.version,
      creative_row.updated_at
    into
      v_id,
      v_version,
      v_updated_at;

    if v_id is null then
      if exists (
        select 1
        from public.ad_campaign_creatives existing_creative
        where existing_creative.id = p_id
      ) then
        raise exception 'stale_campaign_creative';
      end if;

      raise exception 'Campaign creative does not exist.';
    end if;
  end if;

  perform public.rawaj_insert_audit_log(
    case
      when p_id is null then 'campaign.creative_created'
      else 'campaign.creative_updated'
    end,
    'ad_campaign_creatives',
    v_id::text,
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'name', v_name,
      'weight', p_weight,
      'is_active', p_is_active
    )
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_safety_upsert_case(
  p_id uuid,
  p_source_type text,
  p_source_id text,
  p_subject_user_id uuid,
  p_title text,
  p_summary text,
  p_severity text,
  p_assigned_to uuid,
  p_expected_version bigint default null
)
returns table (
  id uuid,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_source_id text := nullif(btrim(coalesce(p_source_id, '')), '');
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if p_source_type not in ('manual', 'listing_report', 'message_report', 'account') then
    raise exception 'Unsupported safety case source.';
  end if;

  if p_severity not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Unsupported safety severity.';
  end if;

  if char_length(v_title) < 3 or char_length(v_title) > 180 then
    raise exception 'Safety case title must be between 3 and 180 characters.';
  end if;

  if char_length(v_summary) > 6000 then
    raise exception 'Safety case summary is too long.';
  end if;

  if p_assigned_to is not null
     and not exists (
       select 1
       from public.user_roles role_row
       where role_row.user_id = p_assigned_to
         and role_row.role in ('owner', 'admin', 'moderator')
     ) then
    raise exception 'Safety case assignee must be authorized staff.';
  end if;

  if p_id is null then
    insert into public.safety_cases (
      source_type,
      source_id,
      subject_user_id,
      title,
      summary,
      severity,
      assigned_to,
      created_by,
      updated_by
    )
    values (
      p_source_type,
      v_source_id,
      p_subject_user_id,
      v_title,
      v_summary,
      p_severity,
      p_assigned_to,
      v_actor,
      v_actor
    )
    returning
      safety_cases.id,
      safety_cases.version,
      safety_cases.updated_at
    into
      v_id,
      v_version,
      v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for safety case updates.';
    end if;

    update public.safety_cases as safety_row
    set
      source_type = p_source_type,
      source_id = v_source_id,
      subject_user_id = p_subject_user_id,
      title = v_title,
      summary = v_summary,
      severity = p_severity,
      assigned_to = p_assigned_to,
      version = safety_row.version + 1,
      updated_by = v_actor,
      updated_at = now()
    where safety_row.id = p_id
      and safety_row.version = p_expected_version
    returning
      safety_row.id,
      safety_row.version,
      safety_row.updated_at
    into
      v_id,
      v_version,
      v_updated_at;

    if v_id is null then
      if exists (
        select 1 from public.safety_cases existing_case where existing_case.id = p_id
      ) then
        raise exception 'stale_safety_case';
      end if;

      raise exception 'Safety case does not exist.';
    end if;
  end if;

  perform public.rawaj_insert_audit_log(
    case when p_id is null then 'safety_case.created' else 'safety_case.updated' end,
    'safety_cases',
    v_id::text,
    jsonb_build_object(
      'source_type', p_source_type,
      'source_id', v_source_id,
      'subject_user_id', p_subject_user_id,
      'severity', p_severity,
      'assigned_to', p_assigned_to
    )
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_safety_set_case_status(
  p_id uuid,
  p_status text,
  p_expected_version bigint,
  p_reason text,
  p_resolution_note text default null
)
returns table (
  id uuid,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_resolution_note text := nullif(btrim(coalesce(p_resolution_note, '')), '');
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if p_status not in ('open', 'investigating', 'mitigated', 'closed') then
    raise exception 'Unsupported safety case status.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear status-change reason is required.';
  end if;

  if p_status = 'closed'
     and (v_resolution_note is null or char_length(v_resolution_note) < 3) then
    raise exception 'A resolution note is required to close a safety case.';
  end if;

  update public.safety_cases as safety_row
  set
    status = p_status,
    resolution_note = case
      when p_status = 'closed' then v_resolution_note
      when v_resolution_note is not null then v_resolution_note
      else safety_row.resolution_note
    end,
    closed_at = case when p_status = 'closed' then now() else null end,
    version = safety_row.version + 1,
    updated_by = v_actor,
    updated_at = now()
  where safety_row.id = p_id
    and safety_row.version = p_expected_version
  returning
    safety_row.id,
    safety_row.version,
    safety_row.updated_at
  into
    v_id,
    v_version,
    v_updated_at;

  if v_id is null then
    if exists (
      select 1 from public.safety_cases existing_case where existing_case.id = p_id
    ) then
      raise exception 'stale_safety_case';
    end if;

    raise exception 'Safety case does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'safety_case.status_changed',
    'safety_cases',
    v_id::text,
    jsonb_build_object(
      'status', p_status,
      'reason', v_reason,
      'resolution_note', v_resolution_note
    )
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_safety_escalate_case(
  p_id uuid,
  p_expected_version bigint,
  p_reason text
)
returns table (
  id uuid,
  version bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Safety case permission required.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear escalation reason is required.';
  end if;

  update public.safety_cases as safety_row
  set
    escalated_to_owner = true,
    escalated_at = now(),
    version = safety_row.version + 1,
    updated_by = v_actor,
    updated_at = now()
  where safety_row.id = p_id
    and safety_row.version = p_expected_version
  returning
    safety_row.id,
    safety_row.version,
    safety_row.updated_at
  into
    v_id,
    v_version,
    v_updated_at;

  if v_id is null then
    if exists (
      select 1 from public.safety_cases existing_case where existing_case.id = p_id
    ) then
      raise exception 'stale_safety_case';
    end if;

    raise exception 'Safety case does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'safety_case.escalated_to_owner',
    'safety_cases',
    v_id::text,
    jsonb_build_object('reason', v_reason)
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

revoke all on function public.rawaj_owner_upsert_campaign(
  uuid, text, text, timestamptz, timestamptz, text[], text[], bigint
) from public, anon;
grant execute on function public.rawaj_owner_upsert_campaign(
  uuid, text, text, timestamptz, timestamptz, text[], text[], bigint
) to authenticated;

revoke all on function public.rawaj_owner_set_campaign_status(uuid, text, bigint, text)
  from public, anon;
grant execute on function public.rawaj_owner_set_campaign_status(uuid, text, bigint, text)
  to authenticated;

revoke all on function public.rawaj_owner_upsert_campaign_creative(
  uuid, uuid, text, text, text, integer, boolean, bigint
) from public, anon;
grant execute on function public.rawaj_owner_upsert_campaign_creative(
  uuid, uuid, text, text, text, integer, boolean, bigint
) to authenticated;

revoke all on function public.rawaj_safety_upsert_case(
  uuid, text, text, uuid, text, text, text, uuid, bigint
) from public, anon;
grant execute on function public.rawaj_safety_upsert_case(
  uuid, text, text, uuid, text, text, text, uuid, bigint
) to authenticated;

revoke all on function public.rawaj_safety_set_case_status(
  uuid, text, bigint, text, text
) from public, anon;
grant execute on function public.rawaj_safety_set_case_status(
  uuid, text, bigint, text, text
) to authenticated;

revoke all on function public.rawaj_safety_escalate_case(uuid, bigint, text)
  from public, anon;
grant execute on function public.rawaj_safety_escalate_case(uuid, bigint, text)
  to authenticated;

comment on function public.rawaj_owner_set_campaign_status(uuid, text, bigint, text) is
  'Owner campaign status mutation with qualified optimistic-concurrency version update.';
comment on function public.rawaj_safety_escalate_case(uuid, bigint, text) is
  'Admin safety escalation mutation with qualified optimistic-concurrency version update.';
