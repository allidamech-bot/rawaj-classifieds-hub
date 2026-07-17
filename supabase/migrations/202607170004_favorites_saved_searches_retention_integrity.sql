-- Repository-only, forward-only migration for Phase 15.
-- Do not apply automatically. Apply manually to Supabase Production after merge and review.

create or replace function public.rawaj_set_favorite_v1(
  p_listing_id uuid,
  p_favorited boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_listing record;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_listing_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('favorite:' || v_actor::text || ':' || p_listing_id::text, 0));

  if p_favorited then
    select l.id, l.title, l.price, l.status
      into v_listing
    from public.listings l
    where l.id = p_listing_id
      and l.status = 'approved'
      and (l.expires_at is null or l.expires_at > now())
    limit 1;

    if not found then
      return false;
    end if;

    insert into public.favorites (user_id, listing_id)
    values (v_actor, p_listing_id)
    on conflict (user_id, listing_id) do nothing;

    insert into public.favorite_listing_snapshots (
      user_id,
      listing_id,
      title_snapshot,
      price_snapshot,
      currency_snapshot,
      status_snapshot,
      updated_at
    )
    values (
      v_actor,
      p_listing_id,
      v_listing.title,
      v_listing.price,
      'SYP',
      v_listing.status,
      now()
    )
    on conflict (user_id, listing_id) do update
      set title_snapshot = excluded.title_snapshot,
          price_snapshot = excluded.price_snapshot,
          currency_snapshot = excluded.currency_snapshot,
          status_snapshot = excluded.status_snapshot,
          updated_at = excluded.updated_at;

    return true;
  end if;

  delete from public.favorite_listing_snapshots
  where user_id = v_actor and listing_id = p_listing_id;

  delete from public.favorites
  where user_id = v_actor and listing_id = p_listing_id;

  return true;
end;
$$;

create or replace function public.rawaj_create_my_saved_search_v2(
  p_name_ar text,
  p_filters jsonb,
  p_alert_frequency text default 'weekly'
)
returns public.saved_searches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name_ar, '')), 120);
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_frequency text := lower(trim(coalesce(p_alert_frequency, 'weekly')));
  v_existing public.saved_searches;
  v_created public.saved_searches;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_name = '' then
    raise exception using errcode = '22023', message = 'saved_search_name_required';
  end if;
  if jsonb_typeof(v_filters) <> 'object' then
    raise exception using errcode = '22023', message = 'saved_search_filters_invalid';
  end if;
  if v_frequency not in ('off', 'daily', 'weekly') then
    raise exception using errcode = '22023', message = 'saved_search_frequency_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('saved-search:' || v_actor::text || ':' || md5(v_filters::text), 0));

  select s.* into v_existing
  from public.saved_searches s
  where s.user_id = v_actor and s.filters = v_filters
  order by s.created_at asc, s.id asc
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into public.saved_searches (user_id, name_ar, filters, alert_frequency)
  values (v_actor, v_name, v_filters, v_frequency)
  returning * into v_created;

  return v_created;
end;
$$;

create or replace function public.rawaj_update_my_saved_search_frequency_v2(
  p_saved_search_id uuid,
  p_alert_frequency text
)
returns public.saved_searches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_frequency text := lower(trim(coalesce(p_alert_frequency, '')));
  v_updated public.saved_searches;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_saved_search_id is null then
    raise exception using errcode = '22023', message = 'saved_search_id_required';
  end if;
  if v_frequency not in ('off', 'daily', 'weekly') then
    raise exception using errcode = '22023', message = 'saved_search_frequency_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('saved-search-update:' || v_actor::text || ':' || p_saved_search_id::text, 0));

  update public.saved_searches
  set alert_frequency = v_frequency, updated_at = now()
  where id = p_saved_search_id and user_id = v_actor
  returning * into v_updated;

  if v_updated.id is null then
    raise exception using errcode = 'P0002', message = 'saved_search_not_found';
  end if;

  return v_updated;
end;
$$;

create or replace function public.rawaj_delete_my_saved_search_v2(
  p_saved_search_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_deleted uuid;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_saved_search_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('saved-search-delete:' || v_actor::text || ':' || p_saved_search_id::text, 0));

  delete from public.saved_searches
  where id = p_saved_search_id and user_id = v_actor
  returning id into v_deleted;

  return v_deleted is not null;
end;
$$;

revoke all on function public.rawaj_set_favorite_v1(uuid, boolean) from public;
revoke all on function public.rawaj_create_my_saved_search_v2(text, jsonb, text) from public;
revoke all on function public.rawaj_update_my_saved_search_frequency_v2(uuid, text) from public;
revoke all on function public.rawaj_delete_my_saved_search_v2(uuid) from public;

grant execute on function public.rawaj_set_favorite_v1(uuid, boolean) to authenticated;
grant execute on function public.rawaj_create_my_saved_search_v2(text, jsonb, text) to authenticated;
grant execute on function public.rawaj_update_my_saved_search_frequency_v2(uuid, text) to authenticated;
grant execute on function public.rawaj_delete_my_saved_search_v2(uuid) to authenticated;

create index if not exists favorites_user_created_id_idx
  on public.favorites (user_id, created_at desc, listing_id);

create index if not exists saved_searches_user_created_id_idx
  on public.saved_searches (user_id, created_at desc, id);

create index if not exists saved_search_alert_matches_search_created_idx
  on public.saved_search_alert_matches (saved_search_id, created_at desc, listing_id);