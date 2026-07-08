-- RAWAJ Saved Search Alerts foundation.
-- Adds real persisted alert frequency, last scan state, dedupe, and safe notification recording.

alter table public.saved_searches
  add column if not exists alert_frequency text not null default 'weekly',
  add column if not exists last_alert_checked_at timestamptz;

alter table public.saved_searches
  drop constraint if exists saved_searches_alert_frequency_check;

alter table public.saved_searches
  add constraint saved_searches_alert_frequency_check
  check (alert_frequency in ('daily', 'weekly', 'off'));

create table if not exists public.saved_search_alert_matches (
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  matched_at timestamptz not null default now(),
  primary key (saved_search_id, listing_id)
);

create index if not exists saved_search_alert_matches_user_idx
  on public.saved_search_alert_matches (user_id, matched_at desc);

alter table public.saved_search_alert_matches enable row level security;

drop policy if exists "saved_search_alert_matches_select_own" on public.saved_search_alert_matches;
create policy "saved_search_alert_matches_select_own"
on public.saved_search_alert_matches
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.rawaj_record_saved_search_alert_match(
  p_saved_search_id uuid,
  p_listing_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_search_name text;
  v_listing_title text;
  v_inserted_rows integer := 0;
  v_preference_enabled boolean := true;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.name_ar
    into v_search_name
  from public.saved_searches s
  where s.id = p_saved_search_id
    and s.user_id = v_user_id
    and s.alert_frequency <> 'off';

  if v_search_name is null then
    return false;
  end if;

  select l.title
    into v_listing_title
  from public.listings l
  where l.id = p_listing_id
    and l.status = 'approved'
    and (l.expires_at is null or l.expires_at > now());

  if v_listing_title is null then
    return false;
  end if;

  select p.saved_search_matches_enabled
    into v_preference_enabled
  from public.notification_preferences p
  where p.user_id = v_user_id;

  if coalesce(v_preference_enabled, true) is not true then
    return false;
  end if;

  insert into public.saved_search_alert_matches (saved_search_id, listing_id, user_id)
  values (p_saved_search_id, p_listing_id, v_user_id)
  on conflict (saved_search_id, listing_id) do nothing;

  get diagnostics v_inserted_rows = row_count;

  if v_inserted_rows = 0 then
    return false;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title_ar,
    body_ar,
    target_type,
    target_id,
    metadata
  ) values (
    v_user_id,
    null,
    'saved_search_match',
    'إعلان جديد يطابق بحثك',
    v_listing_title || ' · ' || v_search_name,
    'listing',
    p_listing_id,
    jsonb_build_object('saved_search_id', p_saved_search_id)
  );

  return true;
end;
$$;

revoke all on function public.rawaj_record_saved_search_alert_match(uuid, uuid) from public;
grant execute on function public.rawaj_record_saved_search_alert_match(uuid, uuid) to authenticated;

create or replace function public.rawaj_touch_saved_search_alert_checked(
  p_saved_search_id uuid,
  p_checked_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.saved_searches
  set last_alert_checked_at = p_checked_at,
      updated_at = now()
  where id = p_saved_search_id
    and user_id = v_user_id;

  return found;
end;
$$;

revoke all on function public.rawaj_touch_saved_search_alert_checked(uuid, timestamptz) from public;
grant execute on function public.rawaj_touch_saved_search_alert_checked(uuid, timestamptz) to authenticated;

comment on column public.saved_searches.alert_frequency is
  'In-app alert cadence: daily, weekly, or off.';
comment on column public.saved_searches.last_alert_checked_at is
  'Last successful bounded alert scan timestamp.';
