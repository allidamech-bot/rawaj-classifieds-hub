-- RAWAJ campaign manager.
-- Owner authority, multiple creatives, scheduling, targeting, immediate pause, and real event-derived metrics.

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  target_pages text[] not null default array[]::text[],
  target_category_ids text[] not null default array[]::text[],
  version bigint not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(name)) between 2 and 160),
  check (status in ('draft', 'active', 'paused', 'ended')),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.ad_campaign_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  name text not null,
  image_url text not null,
  destination_url text not null,
  weight integer not null default 100,
  is_active boolean not null default true,
  version bigint not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(name)) between 2 and 160),
  check (weight between 1 and 1000)
);

create table if not exists public.ad_campaign_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  creative_id uuid not null references public.ad_campaign_creatives(id) on delete cascade,
  event_type text not null,
  page text not null,
  device text not null,
  occurred_at timestamptz not null default now(),
  check (event_type in ('impression', 'click')),
  check (page in ('home', 'search_results', 'listing_detail', 'categories', 'offers')),
  check (device in ('mobile', 'desktop'))
);

create index if not exists ad_campaigns_status_schedule_idx
  on public.ad_campaigns (status, starts_at, ends_at, updated_at desc);
create index if not exists ad_campaign_creatives_campaign_idx
  on public.ad_campaign_creatives (campaign_id, is_active, weight desc);
create index if not exists ad_campaign_events_campaign_type_idx
  on public.ad_campaign_events (campaign_id, event_type, occurred_at desc);
create index if not exists ad_campaign_events_creative_type_idx
  on public.ad_campaign_events (creative_id, event_type, occurred_at desc);

alter table public.ad_campaigns enable row level security;
alter table public.ad_campaign_creatives enable row level security;
alter table public.ad_campaign_events enable row level security;

-- Direct management reads are owner-only. Operational public access is RPC-scoped.
drop policy if exists "ad_campaigns_owner_read" on public.ad_campaigns;
create policy "ad_campaigns_owner_read"
on public.ad_campaigns
for select
to authenticated
using (public.current_user_has_role('owner'));

drop policy if exists "ad_campaign_creatives_owner_read" on public.ad_campaign_creatives;
create policy "ad_campaign_creatives_owner_read"
on public.ad_campaign_creatives
for select
to authenticated
using (public.current_user_has_role('owner'));

drop policy if exists "ad_campaign_events_owner_read" on public.ad_campaign_events;
create policy "ad_campaign_events_owner_read"
on public.ad_campaign_events
for select
to authenticated
using (public.current_user_has_role('owner'));

create or replace function public.rawaj_owner_list_campaigns()
returns table (
  id uuid,
  name text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  target_pages text[],
  target_category_ids text[],
  version bigint,
  created_at timestamptz,
  updated_at timestamptz,
  creative_count bigint,
  impressions bigint,
  clicks bigint,
  ctr numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.status,
    c.starts_at,
    c.ends_at,
    c.target_pages,
    c.target_category_ids,
    c.version,
    c.created_at,
    c.updated_at,
    (select count(*) from public.ad_campaign_creatives cr where cr.campaign_id = c.id),
    (select count(*) from public.ad_campaign_events e where e.campaign_id = c.id and e.event_type = 'impression'),
    (select count(*) from public.ad_campaign_events e where e.campaign_id = c.id and e.event_type = 'click'),
    case
      when (select count(*) from public.ad_campaign_events e where e.campaign_id = c.id and e.event_type = 'impression') = 0 then 0::numeric
      else round(
        100::numeric
        * (select count(*) from public.ad_campaign_events e where e.campaign_id = c.id and e.event_type = 'click')::numeric
        / (select count(*) from public.ad_campaign_events e where e.campaign_id = c.id and e.event_type = 'impression')::numeric,
        2
      )
    end
  from public.ad_campaigns c
  where public.current_user_has_role('owner')
  order by c.updated_at desc;
$$;

create or replace function public.rawaj_owner_list_campaign_creatives(p_campaign_id uuid)
returns table (
  id uuid,
  campaign_id uuid,
  name text,
  image_url text,
  destination_url text,
  weight integer,
  is_active boolean,
  version bigint,
  created_at timestamptz,
  updated_at timestamptz,
  impressions bigint,
  clicks bigint,
  ctr numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cr.id,
    cr.campaign_id,
    cr.name,
    cr.image_url,
    cr.destination_url,
    cr.weight,
    cr.is_active,
    cr.version,
    cr.created_at,
    cr.updated_at,
    (select count(*) from public.ad_campaign_events e where e.creative_id = cr.id and e.event_type = 'impression'),
    (select count(*) from public.ad_campaign_events e where e.creative_id = cr.id and e.event_type = 'click'),
    case
      when (select count(*) from public.ad_campaign_events e where e.creative_id = cr.id and e.event_type = 'impression') = 0 then 0::numeric
      else round(
        100::numeric
        * (select count(*) from public.ad_campaign_events e where e.creative_id = cr.id and e.event_type = 'click')::numeric
        / (select count(*) from public.ad_campaign_events e where e.creative_id = cr.id and e.event_type = 'impression')::numeric,
        2
      )
    end
  from public.ad_campaign_creatives cr
  where cr.campaign_id = p_campaign_id
    and public.current_user_has_role('owner')
  order by cr.updated_at desc;
$$;

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
returns table (id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
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
    select 1 from unnest(v_pages) page
    where page not in ('home', 'search_results', 'listing_detail', 'categories', 'offers')
  ) then
    raise exception 'Unsupported campaign target page.';
  end if;

  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'End time must be after start time.';
  end if;

  if p_id is null then
    insert into public.ad_campaigns (
      name, status, starts_at, ends_at, target_pages, target_category_ids, created_by, updated_by
    ) values (
      v_name, p_status, p_starts_at, p_ends_at, v_pages, v_categories, v_actor, v_actor
    )
    returning ad_campaigns.id, ad_campaigns.version, ad_campaigns.updated_at
      into v_id, v_version, v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for updates.';
    end if;

    update public.ad_campaigns
    set
      name = v_name,
      status = p_status,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      target_pages = v_pages,
      target_category_ids = v_categories,
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
    where ad_campaigns.id = p_id
      and ad_campaigns.version = p_expected_version
    returning ad_campaigns.id, ad_campaigns.version, ad_campaigns.updated_at
      into v_id, v_version, v_updated_at;

    if v_id is null then
      if exists (select 1 from public.ad_campaigns c where c.id = p_id) then
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

  if p_status not in ('draft', 'active', 'paused', 'ended') then
    raise exception 'Unsupported campaign status.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear reason is required.';
  end if;

  update public.ad_campaigns
  set
    status = p_status,
    version = version + 1,
    updated_by = v_actor,
    updated_at = now()
  where ad_campaigns.id = p_id
    and ad_campaigns.version = p_expected_version
  returning ad_campaigns.id, ad_campaigns.version, ad_campaigns.updated_at
    into v_id, v_version, v_updated_at;

  if v_id is null then
    if exists (select 1 from public.ad_campaigns c where c.id = p_id) then
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
returns table (id uuid, version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
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

  if not exists (select 1 from public.ad_campaigns c where c.id = p_campaign_id) then
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
      campaign_id, name, image_url, destination_url, weight, is_active, created_by, updated_by
    ) values (
      p_campaign_id, v_name, v_image_url, v_destination_url, p_weight, p_is_active, v_actor, v_actor
    )
    returning ad_campaign_creatives.id, ad_campaign_creatives.version, ad_campaign_creatives.updated_at
      into v_id, v_version, v_updated_at;
  else
    if p_expected_version is null then
      raise exception 'Expected version is required for creative updates.';
    end if;

    update public.ad_campaign_creatives
    set
      name = v_name,
      image_url = v_image_url,
      destination_url = v_destination_url,
      weight = p_weight,
      is_active = p_is_active,
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
    where ad_campaign_creatives.id = p_id
      and ad_campaign_creatives.campaign_id = p_campaign_id
      and ad_campaign_creatives.version = p_expected_version
    returning ad_campaign_creatives.id, ad_campaign_creatives.version, ad_campaign_creatives.updated_at
      into v_id, v_version, v_updated_at;

    if v_id is null then
      if exists (select 1 from public.ad_campaign_creatives cr where cr.id = p_id) then
        raise exception 'stale_campaign_creative';
      end if;
      raise exception 'Campaign creative does not exist.';
    end if;
  end if;

  perform public.rawaj_insert_audit_log(
    case when p_id is null then 'campaign.creative_created' else 'campaign.creative_updated' end,
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

-- Safe public selector: only live campaigns, active creatives, matching page/category.
create or replace function public.rawaj_fetch_active_campaign_creatives(
  p_page text,
  p_category_id text default null
)
returns table (
  campaign_id uuid,
  creative_id uuid,
  image_url text,
  destination_url text,
  weight integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, cr.id, cr.image_url, cr.destination_url, cr.weight
  from public.ad_campaigns c
  join public.ad_campaign_creatives cr on cr.campaign_id = c.id
  where c.status = 'active'
    and cr.is_active
    and (c.starts_at is null or c.starts_at <= now())
    and (c.ends_at is null or c.ends_at > now())
    and (cardinality(c.target_pages) = 0 or p_page = any(c.target_pages))
    and (
      cardinality(c.target_category_ids) = 0
      or (p_category_id is not null and p_category_id = any(c.target_category_ids))
    )
  order by cr.weight desc, cr.updated_at desc;
$$;

-- Metrics are derived only from rows inserted by this validated real-event endpoint.
create or replace function public.rawaj_record_campaign_event(
  p_campaign_id uuid,
  p_creative_id uuid,
  p_event_type text,
  p_page text,
  p_device text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in ('impression', 'click') then
    raise exception 'Unsupported campaign event.';
  end if;

  if p_page not in ('home', 'search_results', 'listing_detail', 'categories', 'offers') then
    raise exception 'Unsupported campaign event page.';
  end if;

  if p_device not in ('mobile', 'desktop') then
    raise exception 'Unsupported campaign event device.';
  end if;

  if not exists (
    select 1
    from public.ad_campaigns c
    join public.ad_campaign_creatives cr on cr.campaign_id = c.id
    where c.id = p_campaign_id
      and cr.id = p_creative_id
      and c.status = 'active'
      and cr.is_active
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at > now())
      and (cardinality(c.target_pages) = 0 or p_page = any(c.target_pages))
  ) then
    raise exception 'Campaign event target is not currently active.';
  end if;

  insert into public.ad_campaign_events (campaign_id, creative_id, event_type, page, device)
  values (p_campaign_id, p_creative_id, p_event_type, p_page, p_device);
end;
$$;

revoke all on function public.rawaj_owner_list_campaigns() from public;
revoke all on function public.rawaj_owner_list_campaigns() from anon;
grant execute on function public.rawaj_owner_list_campaigns() to authenticated;

revoke all on function public.rawaj_owner_list_campaign_creatives(uuid) from public;
revoke all on function public.rawaj_owner_list_campaign_creatives(uuid) from anon;
grant execute on function public.rawaj_owner_list_campaign_creatives(uuid) to authenticated;

revoke all on function public.rawaj_owner_upsert_campaign(uuid, text, text, timestamptz, timestamptz, text[], text[], bigint) from public;
revoke all on function public.rawaj_owner_upsert_campaign(uuid, text, text, timestamptz, timestamptz, text[], text[], bigint) from anon;
grant execute on function public.rawaj_owner_upsert_campaign(uuid, text, text, timestamptz, timestamptz, text[], text[], bigint) to authenticated;

revoke all on function public.rawaj_owner_set_campaign_status(uuid, text, bigint, text) from public;
revoke all on function public.rawaj_owner_set_campaign_status(uuid, text, bigint, text) from anon;
grant execute on function public.rawaj_owner_set_campaign_status(uuid, text, bigint, text) to authenticated;

revoke all on function public.rawaj_owner_upsert_campaign_creative(uuid, uuid, text, text, text, integer, boolean, bigint) from public;
revoke all on function public.rawaj_owner_upsert_campaign_creative(uuid, uuid, text, text, text, integer, boolean, bigint) from anon;
grant execute on function public.rawaj_owner_upsert_campaign_creative(uuid, uuid, text, text, text, integer, boolean, bigint) to authenticated;

revoke all on function public.rawaj_fetch_active_campaign_creatives(text, text) from public;
grant execute on function public.rawaj_fetch_active_campaign_creatives(text, text) to anon, authenticated;

revoke all on function public.rawaj_record_campaign_event(uuid, uuid, text, text, text) from public;
grant execute on function public.rawaj_record_campaign_event(uuid, uuid, text, text, text) to anon, authenticated;

comment on table public.ad_campaign_events is
  'Append-only measured campaign events. Campaign metrics and CTR are derived from these real event rows only.';
