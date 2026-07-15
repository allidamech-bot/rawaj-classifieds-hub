-- RAWAJ saved-search alerts and push delivery V1.
--
-- Converts saved-search matching from a client-only scan into a server-side
-- approval event, adds cadence-aware aggregation, and introduces a private,
-- retryable Android push delivery queue.

begin;

create extension if not exists pgcrypto;

alter table public.notification_preferences
  add column if not exists push_enabled boolean not null default false;

alter table public.saved_searches
  add column if not exists last_match_at timestamptz,
  add column if not exists match_count integer not null default 0;

alter table public.saved_searches
  drop constraint if exists saved_searches_match_count_nonnegative;
alter table public.saved_searches
  add constraint saved_searches_match_count_nonnegative check (match_count >= 0);

alter table public.saved_search_alert_matches
  add column if not exists notified_at timestamptz,
  add column if not exists notification_id uuid references public.notifications(id) on delete set null;

-- Matches created by the legacy client scanner already produced notifications.
update public.saved_search_alert_matches
set notified_at = matched_at
where notified_at is null;

create index if not exists saved_search_alert_matches_pending_idx
  on public.saved_search_alert_matches (user_id, matched_at)
  where notified_at is null;

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  device_token text not null,
  platform text not null default 'android',
  permission_status text not null default 'granted',
  app_version text,
  locale text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_device_key_not_blank check (length(btrim(device_key)) between 8 and 200),
  constraint push_devices_token_not_blank check (length(btrim(device_token)) between 20 and 4096),
  constraint push_devices_platform_check check (platform in ('android', 'ios', 'web')),
  constraint push_devices_permission_check check (permission_status in ('granted', 'denied', 'prompt')),
  unique (user_id, device_key),
  unique (device_token)
);

create index if not exists push_devices_user_active_idx
  on public.push_devices (user_id, active, last_seen_at desc);

alter table public.push_devices enable row level security;
revoke all on table public.push_devices from anon, authenticated;

create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_push_deliveries_status_check
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed')),
  constraint notification_push_deliveries_attempt_count_nonnegative check (attempt_count >= 0),
  unique (notification_id, device_id)
);

create index if not exists notification_push_deliveries_claim_idx
  on public.notification_push_deliveries (status, next_attempt_at, created_at)
  where status in ('pending', 'retry', 'processing');

create index if not exists notification_push_deliveries_recipient_idx
  on public.notification_push_deliveries (recipient_id, created_at desc);

alter table public.notification_push_deliveries enable row level security;
revoke all on table public.notification_push_deliveries from anon, authenticated;

create or replace function public.rawaj_jsonb_first_text_v2(
  p_payload jsonb,
  p_keys text[]
)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(btrim(coalesce(p_payload, '{}'::jsonb) ->> candidate.key), '')
  from unnest(coalesce(p_keys, '{}'::text[])) as candidate(key)
  where coalesce(p_payload, '{}'::jsonb) ? candidate.key
    and nullif(btrim(coalesce(p_payload, '{}'::jsonb) ->> candidate.key), '') is not null
  limit 1;
$$;

create or replace function public.rawaj_jsonb_first_numeric_v2(
  p_payload jsonb,
  p_keys text[]
)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = public, pg_temp
as $$
declare
  v_value text;
begin
  v_value := public.rawaj_jsonb_first_text_v2(p_payload, p_keys);
  if v_value is null or v_value !~ '^-?[0-9]+([.][0-9]+)?$' then
    return null;
  end if;
  return v_value::numeric;
end;
$$;

create or replace function public.rawaj_listing_matches_saved_search_v2(
  p_listing public.listings,
  p_filters jsonb
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_value text;
  v_query text;
  v_number numeric;
  v_listing_number numeric;
  v_district text;
  v_location_root text;
  v_with_photos text;
begin
  if p_listing.status <> 'approved'
     or p_listing.archived_at is not null
     or (p_listing.expires_at is not null and p_listing.expires_at <= now()) then
    return false;
  end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['categoryId', 'category']);
  if v_value is not null and p_listing.category_id::text <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(
    p_filters,
    array['taxonomyLegacySubcategoryId', 'subcategoryId', 'subcategory']
  );
  if v_value is not null and coalesce(p_listing.subcategory_id::text, '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['governorateId', 'gov']);
  if v_value is not null and p_listing.governorate_id::text <> v_value then return false; end if;

  v_district := public.rawaj_jsonb_first_text_v2(p_filters, array['districtAr', 'district']);
  if v_district is not null then
    if left(v_district, 1) = '@' then
      v_location_root := substring(v_district from 2);
      if v_location_root !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or p_listing.location_node_id is null
         or not exists (
           select 1
           from public.rawaj_location_descendant_ids(v_location_root::uuid) descendant
           where descendant.id = p_listing.location_node_id
         ) then
        return false;
      end if;
    elsif coalesce(p_listing.district_ar, '') <> v_district then
      return false;
    end if;
  end if;

  v_number := public.rawaj_jsonb_first_numeric_v2(p_filters, array['priceMin', 'price_min']);
  if v_number is not null and (p_listing.price is null or p_listing.price < v_number) then return false; end if;

  v_number := public.rawaj_jsonb_first_numeric_v2(p_filters, array['priceMax', 'price_max']);
  if v_number is not null and (p_listing.price is null or p_listing.price > v_number) then return false; end if;

  v_number := public.rawaj_jsonb_first_numeric_v2(p_filters, array['yearFrom', 'year_from']);
  if v_number is not null then
    v_value := nullif(btrim(coalesce(p_listing.details ->> 'year', '')), '');
    if v_value is null or v_value !~ '^[0-9]+$' or v_value::numeric < v_number then return false; end if;
  end if;

  v_number := public.rawaj_jsonb_first_numeric_v2(p_filters, array['yearTo', 'year_to']);
  if v_number is not null then
    v_value := nullif(btrim(coalesce(p_listing.details ->> 'year', '')), '');
    if v_value is null or v_value !~ '^[0-9]+$' or v_value::numeric > v_number then return false; end if;
  end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['carMake', 'car_make']);
  if v_value is not null and coalesce(p_listing.details ->> 'car_make', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['carModel', 'car_model']);
  if v_value is not null and coalesce(p_listing.details ->> 'car_model', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['fuelType', 'fuel']);
  if v_value is not null and coalesce(p_listing.details ->> 'fuel_type', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['transmission']);
  if v_value is not null and coalesce(p_listing.details ->> 'transmission', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(
    p_filters,
    array['taxonomyPropertyPurpose', 'propertyPurpose', 'property_purpose']
  );
  if v_value is not null and coalesce(p_listing.details ->> 'listing_purpose', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(
    p_filters,
    array['taxonomyPropertyType', 'propertyType', 'property_type']
  );
  if v_value is not null and coalesce(p_listing.details ->> 'property_type', '') <> v_value then return false; end if;

  v_number := public.rawaj_jsonb_first_numeric_v2(p_filters, array['rooms']);
  if v_number is not null then
    v_value := nullif(btrim(coalesce(p_listing.details ->> 'rooms', '')), '');
    if v_value is null or v_value !~ '^[0-9]+([.][0-9]+)?$' then return false; end if;
    v_listing_number := v_value::numeric;
    if v_listing_number <> v_number then return false; end if;
  end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['rentalDuration', 'rental_duration']);
  if v_value is not null and coalesce(p_listing.details ->> 'rental_duration', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['electronicsBrand', 'electronics_brand']);
  if v_value is not null and coalesce(p_listing.details ->> 'electronics_brand', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['detailCondition', 'detail_condition']);
  if v_value is not null and coalesce(p_listing.details ->> 'condition', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['employmentType', 'employment_type']);
  if v_value is not null and coalesce(p_listing.details ->> 'employment_type', '') <> v_value then return false; end if;

  v_value := public.rawaj_jsonb_first_text_v2(p_filters, array['salaryType', 'salary_type']);
  if v_value is not null and coalesce(p_listing.details ->> 'salary_type', '') <> v_value then return false; end if;

  v_with_photos := lower(coalesce(public.rawaj_jsonb_first_text_v2(p_filters, array['withPhotos', 'with_photos']), ''));
  if v_with_photos in ('true', '1', 'yes')
     and not exists (select 1 from public.listing_images image where image.listing_id = p_listing.id) then
    return false;
  end if;

  v_query := public.rawaj_jsonb_first_text_v2(p_filters, array['query', 'q']);
  if v_query is not null
     and position(
       public.rawaj_normalize_arabic_search(v_query)
       in coalesce(p_listing.search_text_normalized, public.rawaj_normalize_arabic_search(p_listing.title || ' ' || p_listing.description))
     ) = 0 then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.rawaj_capture_saved_search_matches_v2()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_search record;
  v_match_inserted integer;
begin
  if new.status <> 'approved'
     or new.archived_at is not null
     or (new.expires_at is not null and new.expires_at <= now()) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'approved'
     and old.archived_at is not distinct from new.archived_at
     and old.expires_at is not distinct from new.expires_at
     and old.category_id is not distinct from new.category_id
     and old.subcategory_id is not distinct from new.subcategory_id
     and old.governorate_id is not distinct from new.governorate_id
     and old.district_ar is not distinct from new.district_ar
     and old.location_node_id is not distinct from new.location_node_id
     and old.price is not distinct from new.price
     and old.title is not distinct from new.title
     and old.description is not distinct from new.description
     and old.details is not distinct from new.details then
    return new;
  end if;

  for v_search in
    select search.id, search.user_id, search.filters
    from public.saved_searches search
    left join public.notification_preferences preference
      on preference.user_id = search.user_id
    where search.alert_frequency <> 'off'
      and search.user_id <> new.owner_id
      and coalesce(preference.saved_search_matches_enabled, true)
      and public.rawaj_listing_matches_saved_search_v2(new, search.filters)
  loop
    v_match_inserted := 0;
    insert into public.saved_search_alert_matches (
      saved_search_id,
      listing_id,
      user_id,
      matched_at,
      notified_at,
      notification_id
    ) values (
      v_search.id,
      new.id,
      v_search.user_id,
      now(),
      null,
      null
    )
    on conflict (saved_search_id, listing_id) do nothing;

    get diagnostics v_match_inserted = row_count;
    if v_match_inserted > 0 then
      update public.saved_searches
      set last_match_at = now(),
          match_count = match_count + 1,
          updated_at = now()
      where id = v_search.id;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists rawaj_capture_saved_search_matches_v2 on public.listings;
create trigger rawaj_capture_saved_search_matches_v2
after insert or update of status, archived_at, expires_at, category_id, subcategory_id,
  governorate_id, district_ar, location_node_id, price, title, description, details
on public.listings
for each row execute function public.rawaj_capture_saved_search_matches_v2();

create or replace function public.rawaj_flush_saved_search_alerts_for_user_v2(
  p_user_id uuid,
  p_force boolean default false
)
returns table (
  checked_searches integer,
  matched_listings integer,
  created_notifications integer,
  skipped_searches integer,
  checked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_search record;
  v_notification_id uuid;
  v_checked integer := 0;
  v_matched integer := 0;
  v_created integer := 0;
  v_skipped integer := 0;
  v_now timestamptz := now();
begin
  for v_search in
    select
      search.id,
      search.name_ar,
      search.alert_frequency,
      search.last_alert_checked_at,
      count(match.listing_id)::integer as pending_count,
      (array_agg(match.listing_id order by match.matched_at desc))[1] as latest_listing_id,
      (array_agg(match.listing_id order by match.matched_at desc))[1:20] as listing_ids
    from public.saved_searches search
    join public.saved_search_alert_matches match
      on match.saved_search_id = search.id
     and match.user_id = search.user_id
     and match.notified_at is null
    left join public.notification_preferences preference
      on preference.user_id = search.user_id
    where search.user_id = p_user_id
      and search.alert_frequency <> 'off'
      and coalesce(preference.saved_search_matches_enabled, true)
    group by search.id, search.name_ar, search.alert_frequency, search.last_alert_checked_at
    order by min(match.matched_at)
  loop
    if not p_force
       and v_search.last_alert_checked_at is not null
       and (
         (v_search.alert_frequency = 'daily' and v_search.last_alert_checked_at > v_now - interval '1 day')
         or (v_search.alert_frequency = 'weekly' and v_search.last_alert_checked_at > v_now - interval '7 days')
       ) then
      v_skipped := v_skipped + 1;
      continue;
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
      p_user_id,
      null,
      'saved_search_match',
      'نتائج جديدة لبحثك المحفوظ',
      v_search.pending_count::text || ' إعلانات جديدة تطابق «' || v_search.name_ar || '»',
      'saved_search',
      v_search.id::text,
      jsonb_build_object(
        'saved_search_id', v_search.id,
        'match_count', v_search.pending_count,
        'listing_ids', to_jsonb(v_search.listing_ids),
        'latest_listing_id', v_search.latest_listing_id
      )
    )
    returning id into v_notification_id;

    update public.saved_search_alert_matches
    set notified_at = v_now,
        notification_id = v_notification_id
    where saved_search_id = v_search.id
      and user_id = p_user_id
      and notified_at is null;

    update public.saved_searches
    set last_alert_checked_at = v_now,
        updated_at = v_now
    where id = v_search.id
      and user_id = p_user_id;

    v_checked := v_checked + 1;
    v_matched := v_matched + v_search.pending_count;
    v_created := v_created + 1;
  end loop;

  return query select v_checked, v_matched, v_created, v_skipped, v_now;
end;
$$;

create or replace function public.rawaj_flush_my_saved_search_alerts_v2(
  p_force boolean default false
)
returns table (
  checked_searches integer,
  matched_listings integer,
  created_notifications integer,
  skipped_searches integer,
  checked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  return query
  select *
  from public.rawaj_flush_saved_search_alerts_for_user_v2(v_user_id, coalesce(p_force, false));
end;
$$;

create or replace function public.rawaj_flush_due_saved_search_alerts_v2(
  p_user_limit integer default 100
)
returns table (
  checked_users integer,
  checked_searches integer,
  matched_listings integer,
  created_notifications integer,
  checked_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user record;
  v_summary record;
  v_users integer := 0;
  v_searches integer := 0;
  v_matches integer := 0;
  v_notifications integer := 0;
  v_now timestamptz := now();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  for v_user in
    select distinct match.user_id
    from public.saved_search_alert_matches match
    join public.saved_searches search on search.id = match.saved_search_id
    where match.notified_at is null
      and search.alert_frequency <> 'off'
    order by match.user_id
    limit least(greatest(coalesce(p_user_limit, 100), 1), 500)
  loop
    select * into v_summary
    from public.rawaj_flush_saved_search_alerts_for_user_v2(v_user.user_id, false);

    v_users := v_users + 1;
    v_searches := v_searches + coalesce(v_summary.checked_searches, 0);
    v_matches := v_matches + coalesce(v_summary.matched_listings, 0);
    v_notifications := v_notifications + coalesce(v_summary.created_notifications, 0);
  end loop;

  return query select v_users, v_searches, v_matches, v_notifications, v_now;
end;
$$;

create or replace function public.rawaj_record_saved_search_alert_match(
  p_saved_search_id uuid,
  p_listing_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_filters jsonb;
  v_listing public.listings;
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select search.filters into v_filters
  from public.saved_searches search
  left join public.notification_preferences preference on preference.user_id = search.user_id
  where search.id = p_saved_search_id
    and search.user_id = v_user_id
    and search.alert_frequency <> 'off'
    and coalesce(preference.saved_search_matches_enabled, true);

  if v_filters is null then return false; end if;

  select listing.* into v_listing
  from public.listings listing
  where listing.id = p_listing_id;

  if v_listing.id is null
     or not public.rawaj_listing_matches_saved_search_v2(v_listing, v_filters) then
    return false;
  end if;

  insert into public.saved_search_alert_matches (
    saved_search_id, listing_id, user_id, matched_at, notified_at, notification_id
  ) values (
    p_saved_search_id, p_listing_id, v_user_id, now(), null, null
  )
  on conflict (saved_search_id, listing_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.saved_searches
    set last_match_at = now(), match_count = match_count + 1, updated_at = now()
    where id = p_saved_search_id and user_id = v_user_id;
  end if;

  return v_inserted > 0;
end;
$$;

create or replace function public.rawaj_notification_push_allowed_v1(
  p_user_id uuid,
  p_notification_type text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(preference.push_enabled, false)
    and case
      when p_notification_type like 'message%' or p_notification_type in ('new_message', 'conversation_message')
        then coalesce(preference.messages_enabled, true)
      when p_notification_type in ('price_drop', 'price_change')
        then coalesce(preference.price_changes_enabled, true)
      when p_notification_type = 'saved_search_match'
        then coalesce(preference.saved_search_matches_enabled, true)
      when p_notification_type like 'listing_%' or p_notification_type in ('approved', 'rejected', 'expired')
        then coalesce(preference.listing_status_enabled, true)
      when p_notification_type like 'review_%' or p_notification_type in ('new_review', 'review_response')
        then coalesce(preference.reviews_enabled, true)
      when p_notification_type like 'promotion_%'
        then coalesce(preference.promotions_enabled, true)
      else true
    end
  from public.notification_preferences preference
  where preference.user_id = p_user_id;
$$;

create or replace function public.rawaj_queue_notification_push_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.rawaj_notification_push_allowed_v1(new.recipient_id, new.type), false) then
    return new;
  end if;

  insert into public.notification_push_deliveries (
    notification_id,
    device_id,
    recipient_id,
    status,
    attempt_count,
    next_attempt_at
  )
  select
    new.id,
    device.id,
    new.recipient_id,
    'pending',
    0,
    now()
  from public.push_devices device
  where device.user_id = new.recipient_id
    and device.active
    and device.permission_status = 'granted'
  on conflict (notification_id, device_id) do nothing;

  return new;
end;
$$;

drop trigger if exists rawaj_queue_notification_push_v1 on public.notifications;
create trigger rawaj_queue_notification_push_v1
after insert on public.notifications
for each row execute function public.rawaj_queue_notification_push_v1();

create or replace function public.rawaj_upsert_push_device_v1(
  p_device_key text,
  p_device_token text,
  p_platform text default 'android',
  p_permission_status text default 'granted',
  p_app_version text default null,
  p_locale text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_device_id uuid;
  v_device_key text := btrim(coalesce(p_device_key, ''));
  v_token text := btrim(coalesce(p_device_token, ''));
  v_platform text := lower(btrim(coalesce(p_platform, 'android')));
  v_permission text := lower(btrim(coalesce(p_permission_status, 'granted')));
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if length(v_device_key) < 8 or length(v_token) < 20 then
    raise exception 'Invalid push device registration.' using errcode = '22023';
  end if;
  if v_platform not in ('android', 'ios', 'web') then v_platform := 'android'; end if;
  if v_permission not in ('granted', 'denied', 'prompt') then v_permission := 'prompt'; end if;

  delete from public.push_devices
  where device_token = v_token
    and (user_id <> v_user_id or device_key <> v_device_key);

  insert into public.push_devices (
    user_id,
    device_key,
    device_token,
    platform,
    permission_status,
    app_version,
    locale,
    active,
    last_seen_at,
    updated_at
  ) values (
    v_user_id,
    v_device_key,
    v_token,
    v_platform,
    v_permission,
    nullif(btrim(coalesce(p_app_version, '')), ''),
    nullif(btrim(coalesce(p_locale, '')), ''),
    v_permission = 'granted',
    now(),
    now()
  )
  on conflict (user_id, device_key)
  do update set
    device_token = excluded.device_token,
    platform = excluded.platform,
    permission_status = excluded.permission_status,
    app_version = excluded.app_version,
    locale = excluded.locale,
    active = excluded.active,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_device_id;

  insert into public.notification_preferences (user_id, push_enabled)
  values (v_user_id, v_permission = 'granted')
  on conflict (user_id)
  do update set push_enabled = excluded.push_enabled, updated_at = now();

  return v_device_id;
end;
$$;

create or replace function public.rawaj_disable_push_device_v1(
  p_device_key text,
  p_disable_channel boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  update public.push_devices
  set active = false,
      permission_status = case when permission_status = 'denied' then 'denied' else 'prompt' end,
      updated_at = now()
  where user_id = v_user_id
    and device_key = btrim(coalesce(p_device_key, ''));
  get diagnostics v_updated = row_count;

  if coalesce(p_disable_channel, true) then
    insert into public.notification_preferences (user_id, push_enabled)
    values (v_user_id, false)
    on conflict (user_id)
    do update set push_enabled = false, updated_at = now();
  end if;

  return v_updated > 0;
end;
$$;

create or replace function public.rawaj_get_push_channel_status_v1(
  p_device_key text
)
returns table (
  push_enabled boolean,
  registered boolean,
  permission_status text,
  platform text,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(preference.push_enabled, false),
    coalesce(device.active, false),
    coalesce(device.permission_status, 'prompt'),
    coalesce(device.platform, 'android'),
    device.last_seen_at
  from (select auth.uid() as user_id) current_user
  left join public.notification_preferences preference
    on preference.user_id = current_user.user_id
  left join lateral (
    select registered_device.active,
           registered_device.permission_status,
           registered_device.platform,
           registered_device.last_seen_at
    from public.push_devices registered_device
    where registered_device.user_id = current_user.user_id
      and registered_device.device_key = btrim(coalesce(p_device_key, ''))
    limit 1
  ) device on true
  where current_user.user_id is not null;
$$;

create or replace function public.rawaj_claim_push_deliveries_v1(
  p_batch_size integer default 50
)
returns table (
  delivery_id uuid,
  notification_id uuid,
  device_id uuid,
  device_token text,
  title_ar text,
  body_ar text,
  target_type text,
  target_id text,
  metadata jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select delivery.id
    from public.notification_push_deliveries delivery
    join public.push_devices device on device.id = delivery.device_id
    where device.active
      and device.permission_status = 'granted'
      and (
        (delivery.status in ('pending', 'retry') and delivery.next_attempt_at <= now())
        or (delivery.status = 'processing' and delivery.locked_at < now() - interval '10 minutes')
      )
    order by delivery.created_at
    limit least(greatest(coalesce(p_batch_size, 50), 1), 200)
    for update of delivery skip locked
  ), claimed as (
    update public.notification_push_deliveries delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        locked_at = now(),
        updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.notification_id,
    claimed.device_id,
    device.device_token,
    notification.title_ar,
    coalesce(notification.body_ar, ''),
    notification.target_type,
    notification.target_id,
    notification.metadata,
    claimed.attempt_count
  from claimed
  join public.push_devices device on device.id = claimed.device_id
  join public.notifications notification on notification.id = claimed.notification_id;
end;
$$;

create or replace function public.rawaj_mark_push_delivery_v1(
  p_delivery_id uuid,
  p_success boolean,
  p_error text default null,
  p_disable_device boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery public.notification_push_deliveries;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  select * into v_delivery
  from public.notification_push_deliveries
  where id = p_delivery_id
  for update;

  if v_delivery.id is null then return false; end if;

  if coalesce(p_success, false) then
    update public.notification_push_deliveries
    set status = 'sent',
        sent_at = now(),
        locked_at = null,
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  else
    update public.notification_push_deliveries
    set status = case when attempt_count >= 5 then 'failed' else 'retry' end,
        next_attempt_at = now() + case
          when attempt_count <= 1 then interval '1 minute'
          when attempt_count = 2 then interval '5 minutes'
          when attempt_count = 3 then interval '15 minutes'
          else interval '1 hour'
        end,
        locked_at = null,
        last_error = left(coalesce(p_error, 'Unknown push delivery error'), 1000),
        updated_at = now()
    where id = p_delivery_id;
  end if;

  if coalesce(p_disable_device, false) then
    update public.push_devices
    set active = false,
        updated_at = now()
    where id = v_delivery.device_id;
  end if;

  return true;
end;
$$;

revoke all on function public.rawaj_jsonb_first_text_v2(jsonb, text[]) from public;
revoke all on function public.rawaj_jsonb_first_numeric_v2(jsonb, text[]) from public;
revoke all on function public.rawaj_listing_matches_saved_search_v2(public.listings, jsonb) from public;
revoke all on function public.rawaj_capture_saved_search_matches_v2() from public;
revoke all on function public.rawaj_flush_saved_search_alerts_for_user_v2(uuid, boolean) from public;
revoke all on function public.rawaj_flush_my_saved_search_alerts_v2(boolean) from public;
revoke all on function public.rawaj_flush_due_saved_search_alerts_v2(integer) from public;
revoke all on function public.rawaj_record_saved_search_alert_match(uuid, uuid) from public;
revoke all on function public.rawaj_notification_push_allowed_v1(uuid, text) from public;
revoke all on function public.rawaj_queue_notification_push_v1() from public;
revoke all on function public.rawaj_upsert_push_device_v1(text, text, text, text, text, text) from public;
revoke all on function public.rawaj_disable_push_device_v1(text, boolean) from public;
revoke all on function public.rawaj_get_push_channel_status_v1(text) from public;
revoke all on function public.rawaj_claim_push_deliveries_v1(integer) from public;
revoke all on function public.rawaj_mark_push_delivery_v1(uuid, boolean, text, boolean) from public;

grant execute on function public.rawaj_flush_my_saved_search_alerts_v2(boolean) to authenticated;
grant execute on function public.rawaj_record_saved_search_alert_match(uuid, uuid) to authenticated;
grant execute on function public.rawaj_upsert_push_device_v1(text, text, text, text, text, text) to authenticated;
grant execute on function public.rawaj_disable_push_device_v1(text, boolean) to authenticated;
grant execute on function public.rawaj_get_push_channel_status_v1(text) to authenticated;
grant execute on function public.rawaj_flush_due_saved_search_alerts_v2(integer) to service_role;
grant execute on function public.rawaj_claim_push_deliveries_v1(integer) to service_role;
grant execute on function public.rawaj_mark_push_delivery_v1(uuid, boolean, text, boolean) to service_role;

comment on column public.notification_preferences.push_enabled is
  'Global opt-in for native push delivery. Category preferences remain authoritative.';
comment on table public.push_devices is
  'Private native push tokens registered to an authenticated RAWAJ account.';
comment on table public.notification_push_deliveries is
  'Retryable service-role-only push delivery queue generated from in-app notifications.';
comment on function public.rawaj_capture_saved_search_matches_v2() is
  'Captures deduplicated saved-search matches when a listing becomes or remains publicly discoverable.';
comment on function public.rawaj_flush_my_saved_search_alerts_v2(boolean) is
  'Creates cadence-aware aggregated in-app notifications for the authenticated user pending saved-search matches.';

commit;
