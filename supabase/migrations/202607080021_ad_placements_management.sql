-- RAWAJ owner-managed ad placements.
-- Provides real scheduled placement inventory without fake analytics.

create table if not exists public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  placement_page text not null,
  image_url text not null,
  destination_url text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft',
  priority integer not null default 0,
  target_mobile boolean not null default true,
  target_desktop boolean not null default true,
  version bigint not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(name)) between 2 and 120),
  check (placement_page in ('home', 'search_results', 'listing_detail', 'categories', 'offers')),
  check (status in ('draft', 'active', 'paused')),
  check (priority between 0 and 1000),
  check (target_mobile or target_desktop),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists ad_placements_active_lookup_idx
  on public.ad_placements (placement_page, status, priority desc, starts_at, ends_at);

alter table public.ad_placements enable row level security;

-- Management rows are owner-only. Public rendering uses the dedicated safe RPC below.
drop policy if exists "ad_placements_owner_read" on public.ad_placements;
create policy "ad_placements_owner_read"
on public.ad_placements
for select
to authenticated
using (public.current_user_has_role('owner'));

create or replace function public.rawaj_owner_list_ad_placements()
returns table (
  id uuid,
  name text,
  placement_page text,
  image_url text,
  destination_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  priority integer,
  target_mobile boolean,
  target_desktop boolean,
  version bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.name,
    a.placement_page,
    a.image_url,
    a.destination_url,
    a.starts_at,
    a.ends_at,
    a.status,
    a.priority,
    a.target_mobile,
    a.target_desktop,
    a.version,
    a.created_at,
    a.updated_at
  from public.ad_placements a
  where public.current_user_has_role('owner')
  order by a.priority desc, a.updated_at desc;
$$;

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
returns table (id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
  v_name text := btrim(coalesce(p_name, ''));
  v_image_url text := btrim(coalesce(p_image_url, ''));
  v_destination_url text := btrim(coalesce(p_destination_url, ''));
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

  if p_status not in ('draft', 'active', 'paused') then
    raise exception 'Unsupported placement status.';
  end if;

  if p_priority is null or p_priority < 0 or p_priority > 1000 then
    raise exception 'Priority must be between 0 and 1000.';
  end if;

  if not coalesce(p_target_mobile, false) and not coalesce(p_target_desktop, false) then
    raise exception 'At least one device target is required.';
  end if;

  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
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
    ) values (
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
    returning ad_placements.id, ad_placements.version, ad_placements.updated_at
      into v_id, v_version, v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for updates.';
    end if;

    update public.ad_placements
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
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
    where ad_placements.id = p_id
      and ad_placements.version = p_expected_version
    returning ad_placements.id, ad_placements.version, ad_placements.updated_at
      into v_id, v_version, v_updated_at;

    if v_id is null then
      if exists (select 1 from public.ad_placements a where a.id = p_id) then
        raise exception 'stale_ad_placement';
      end if;
      raise exception 'Ad placement does not exist.';
    end if;
  end if;

  perform public.rawaj_insert_audit_log(
    case when p_id is null then 'ad_placement.created' else 'ad_placement.updated' end,
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

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_owner_set_ad_placement_status(
  p_id uuid,
  p_status text,
  p_expected_version bigint,
  p_reason text
)
returns table (id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
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

  if p_status not in ('draft', 'active', 'paused') then
    raise exception 'Unsupported placement status.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  update public.ad_placements
  set
    status = p_status,
    version = version + 1,
    updated_by = v_actor,
    updated_at = now()
  where ad_placements.id = p_id
    and ad_placements.version = p_expected_version
  returning ad_placements.id, ad_placements.version, ad_placements.updated_at
    into v_id, v_version, v_updated_at;

  if v_id is null then
    if exists (select 1 from public.ad_placements a where a.id = p_id) then
      raise exception 'stale_ad_placement';
    end if;
    raise exception 'Ad placement does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'ad_placement.status_changed',
    'ad_placements',
    v_id::text,
    jsonb_build_object('status', p_status, 'reason', v_reason)
  );

  return query select v_id, v_version, v_updated_at;
end;
$$;

create or replace function public.rawaj_fetch_active_ad_placements(
  p_placement_page text,
  p_device text
)
returns table (
  id uuid,
  image_url text,
  destination_url text,
  priority integer
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.image_url, a.destination_url, a.priority
  from public.ad_placements a
  where a.status = 'active'
    and a.placement_page = p_placement_page
    and (a.starts_at is null or a.starts_at <= now())
    and (a.ends_at is null or a.ends_at > now())
    and (
      (p_device = 'mobile' and a.target_mobile)
      or (p_device = 'desktop' and a.target_desktop)
    )
  order by a.priority desc, a.updated_at desc;
$$;

revoke all on function public.rawaj_owner_list_ad_placements() from public;
revoke all on function public.rawaj_owner_list_ad_placements() from anon;
grant execute on function public.rawaj_owner_list_ad_placements() to authenticated;

revoke all on function public.rawaj_owner_upsert_ad_placement(uuid, text, text, text, text, timestamptz, timestamptz, text, integer, boolean, boolean, bigint) from public;
revoke all on function public.rawaj_owner_upsert_ad_placement(uuid, text, text, text, text, timestamptz, timestamptz, text, integer, boolean, boolean, bigint) from anon;
grant execute on function public.rawaj_owner_upsert_ad_placement(uuid, text, text, text, text, timestamptz, timestamptz, text, integer, boolean, boolean, bigint) to authenticated;

revoke all on function public.rawaj_owner_set_ad_placement_status(uuid, text, bigint, text) from public;
revoke all on function public.rawaj_owner_set_ad_placement_status(uuid, text, bigint, text) from anon;
grant execute on function public.rawaj_owner_set_ad_placement_status(uuid, text, bigint, text) to authenticated;

revoke all on function public.rawaj_fetch_active_ad_placements(text, text) from public;
grant execute on function public.rawaj_fetch_active_ad_placements(text, text) to anon, authenticated;

comment on table public.ad_placements is
  'Owner-managed RAWAJ placement inventory with scheduling, device targeting, priority, and stale-safe versioning.';
