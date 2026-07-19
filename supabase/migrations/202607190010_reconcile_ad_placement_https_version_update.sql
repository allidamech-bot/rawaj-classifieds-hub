-- Reconcile the ad-placement write RPCs after HTTPS hardening reintroduced
-- an ambiguous PL/pgSQL output-column reference in UPDATE statements.
--
-- Both RPCs return an output column named `version`. Therefore the table
-- column on the right-hand side of the increment must be explicitly qualified.
-- This migration preserves the HTTPS validation added by the later hardening.

create or replace function public.rawaj_owner_upsert_ad_placement(
  p_id uuid,
  p_name text,
  p_placement_page text,
  p_image_url text,
  p_destination_url text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status text,
  p_priority integer,
  p_target_mobile boolean,
  p_target_desktop boolean,
  p_expected_version bigint default null
)
returns table(id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
  v_name text := btrim(coalesce(p_name, ''));
  v_image_url text := btrim(coalesce(p_image_url, ''));
  v_destination_url text := btrim(coalesce(p_destination_url, ''));
  v_safe_https_pattern constant text := '^https://[^/?#[:space:]]+([/?#][^[:space:]]*)?$';
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Placement name must be between 2 and 120 characters.';
  end if;

  if p_placement_page not in ('home', 'search_results', 'listing_detail', 'categories', 'offers') then
    raise exception 'Unsupported placement page.';
  end if;

  if v_image_url = '' or v_destination_url = '' then
    raise exception 'Image and destination URLs are required.';
  end if;

  if v_image_url !~* v_safe_https_pattern
     or v_destination_url !~* v_safe_https_pattern then
    raise exception 'Image and destination URLs must use valid HTTPS URLs.';
  end if;

  if p_status not in ('draft', 'active', 'paused') then
    raise exception 'Unsupported placement status.';
  end if;

  if p_priority is null or p_priority < 0 or p_priority > 1000 then
    raise exception 'Priority must be between 0 and 1000.';
  end if;

  if not coalesce(p_target_mobile, false)
     and not coalesce(p_target_desktop, false) then
    raise exception 'At least one device target is required.';
  end if;

  if p_starts_at is not null
     and p_ends_at is not null
     and p_ends_at <= p_starts_at then
    raise exception 'End time must be after start time.';
  end if;

  if p_id is null then
    insert into public.ad_placements (
      name,
      placement_page,
      image_url,
      destination_url,
      starts_at,
      ends_at,
      status,
      priority,
      target_mobile,
      target_desktop,
      created_by,
      updated_by
    )
    values (
      v_name,
      p_placement_page,
      v_image_url,
      v_destination_url,
      p_starts_at,
      p_ends_at,
      p_status,
      p_priority,
      p_target_mobile,
      p_target_desktop,
      v_actor,
      v_actor
    )
    returning
      ad_placements.id,
      ad_placements.version,
      ad_placements.updated_at
    into
      v_id,
      v_version,
      v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for updates.';
    end if;

    update public.ad_placements as a
    set
      name = v_name,
      placement_page = p_placement_page,
      image_url = v_image_url,
      destination_url = v_destination_url,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      status = p_status,
      priority = p_priority,
      target_mobile = p_target_mobile,
      target_desktop = p_target_desktop,
      version = a.version + 1,
      updated_by = v_actor,
      updated_at = now()
    where a.id = p_id
      and a.version = p_expected_version
    returning
      a.id,
      a.version,
      a.updated_at
    into
      v_id,
      v_version,
      v_updated_at;

    if v_id is null then
      if exists (
        select 1
        from public.ad_placements a
        where a.id = p_id
      ) then
        raise exception 'stale_ad_placement';
      end if;

      raise exception 'Ad placement does not exist.';
    end if;
  end if;

  perform public.rawaj_insert_audit_log(
    case
      when p_id is null then 'ad_placement.created'
      else 'ad_placement.updated'
    end,
    'ad_placements',
    v_id::text,
    jsonb_build_object(
      'name', v_name,
      'placement_page', p_placement_page,
      'status', p_status,
      'priority', p_priority,
      'target_mobile', p_target_mobile,
      'target_desktop', p_target_desktop,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at
    )
  );

  return query
  select
    v_id,
    v_version,
    v_updated_at;
end;
$function$;

create or replace function public.rawaj_owner_set_ad_placement_status(
  p_id uuid,
  p_status text,
  p_expected_version bigint,
  p_reason text
)
returns table(id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
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

  if p_status not in ('draft', 'active', 'paused') then
    raise exception 'Unsupported placement status.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  update public.ad_placements as a
  set
    status = p_status,
    version = a.version + 1,
    updated_by = v_actor,
    updated_at = now()
  where a.id = p_id
    and a.version = p_expected_version
  returning
    a.id,
    a.version,
    a.updated_at
  into
    v_id,
    v_version,
    v_updated_at;

  if v_id is null then
    if exists (
      select 1
      from public.ad_placements a
      where a.id = p_id
    ) then
      raise exception 'stale_ad_placement';
    end if;

    raise exception 'Ad placement does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'ad_placement.status_changed',
    'ad_placements',
    v_id::text,
    jsonb_build_object(
      'status', p_status,
      'reason', v_reason
    )
  );

  return query
  select
    v_id,
    v_version,
    v_updated_at;
end;
$function$;

revoke all on function public.rawaj_owner_upsert_ad_placement(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  integer,
  boolean,
  boolean,
  bigint
) from public;
revoke all on function public.rawaj_owner_upsert_ad_placement(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  integer,
  boolean,
  boolean,
  bigint
) from anon;
grant execute on function public.rawaj_owner_upsert_ad_placement(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  integer,
  boolean,
  boolean,
  bigint
) to authenticated;

revoke all on function public.rawaj_owner_set_ad_placement_status(uuid, text, bigint, text)
from public;
revoke all on function public.rawaj_owner_set_ad_placement_status(uuid, text, bigint, text)
from anon;
grant execute on function public.rawaj_owner_set_ad_placement_status(uuid, text, bigint, text)
to authenticated;

comment on function public.rawaj_owner_upsert_ad_placement(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  integer,
  boolean,
  boolean,
  bigint
) is 'Owner-only ad placement upsert with optimistic concurrency, server-side HTTPS validation, and qualified version updates.';

comment on function public.rawaj_owner_set_ad_placement_status(uuid, text, bigint, text)
is 'Owner-only ad placement status update with optimistic concurrency and qualified version updates.';
