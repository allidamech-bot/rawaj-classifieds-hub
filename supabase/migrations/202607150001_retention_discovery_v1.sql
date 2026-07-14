-- RAWAJ retention and discovery V1.
--
-- Adds private recently-viewed history and privacy-preserving seller follows.
-- Viewer identities and follower identities are never exposed publicly.

begin;

create table if not exists public.recent_listing_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key (user_id, listing_id)
);

create index if not exists recent_listing_views_user_viewed_idx
  on public.recent_listing_views (user_id, viewed_at desc);

alter table public.recent_listing_views enable row level security;

drop policy if exists recent_listing_views_select_own on public.recent_listing_views;
create policy recent_listing_views_select_own
  on public.recent_listing_views
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists recent_listing_views_insert_own on public.recent_listing_views;
create policy recent_listing_views_insert_own
  on public.recent_listing_views
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists recent_listing_views_update_own on public.recent_listing_views;
create policy recent_listing_views_update_own
  on public.recent_listing_views
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists recent_listing_views_delete_own on public.recent_listing_views;
create policy recent_listing_views_delete_own
  on public.recent_listing_views
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.recent_listing_views from anon;
grant select, insert, update, delete on table public.recent_listing_views to authenticated;

create table if not exists public.seller_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, seller_user_id),
  constraint seller_follows_not_self check (follower_user_id <> seller_user_id)
);

create index if not exists seller_follows_seller_count_idx
  on public.seller_follows (seller_user_id, created_at desc);

create index if not exists seller_follows_follower_recent_idx
  on public.seller_follows (follower_user_id, created_at desc);

alter table public.seller_follows enable row level security;

drop policy if exists seller_follows_select_own on public.seller_follows;
create policy seller_follows_select_own
  on public.seller_follows
  for select
  to authenticated
  using (auth.uid() = follower_user_id);

drop policy if exists seller_follows_insert_own on public.seller_follows;
create policy seller_follows_insert_own
  on public.seller_follows
  for insert
  to authenticated
  with check (auth.uid() = follower_user_id and follower_user_id <> seller_user_id);

drop policy if exists seller_follows_delete_own on public.seller_follows;
create policy seller_follows_delete_own
  on public.seller_follows
  for delete
  to authenticated
  using (auth.uid() = follower_user_id);

revoke all on table public.seller_follows from anon;
grant select, insert, delete on table public.seller_follows to authenticated;

create or replace function public.rawaj_record_recent_listing_view_v1(p_listing_id uuid)
returns boolean
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

  if not exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and l.status = 'approved'
      and l.archived_at is null
      and (l.expires_at is null or l.expires_at > now())
  ) then
    return false;
  end if;

  insert into public.recent_listing_views as existing (
    user_id,
    listing_id,
    first_viewed_at,
    viewed_at,
    view_count
  )
  values (v_user_id, p_listing_id, now(), now(), 1)
  on conflict (user_id, listing_id)
  do update set
    viewed_at = excluded.viewed_at,
    view_count = least(existing.view_count + 1, 2147483647);

  return true;
end;
$$;

create or replace function public.rawaj_remove_recent_listing_view_v1(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  delete from public.recent_listing_views
  where user_id = v_user_id
    and listing_id = p_listing_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

create or replace function public.rawaj_clear_recent_listing_views_v1()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  delete from public.recent_listing_views
  where user_id = v_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.rawaj_set_seller_follow_v1(
  p_seller_user_id uuid,
  p_following boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_follower_user_id uuid := auth.uid();
begin
  if v_follower_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_seller_user_id is null or p_seller_user_id = v_follower_user_id then
    return false;
  end if;

  if coalesce(p_following, false) then
    if not exists (
      select 1
      from public.listings l
      where l.owner_id = p_seller_user_id
        and l.status = 'approved'
        and l.archived_at is null
        and (l.expires_at is null or l.expires_at > now())
    ) then
      return false;
    end if;

    insert into public.seller_follows (follower_user_id, seller_user_id)
    values (v_follower_user_id, p_seller_user_id)
    on conflict (follower_user_id, seller_user_id) do nothing;
  else
    delete from public.seller_follows
    where follower_user_id = v_follower_user_id
      and seller_user_id = p_seller_user_id;
  end if;

  return true;
end;
$$;

create or replace function public.rawaj_get_seller_follow_summary_v1(p_seller_user_id uuid)
returns table (
  follower_count bigint,
  is_following boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with public_seller as (
    select 1
    from public.listings l
    where l.owner_id = p_seller_user_id
      and l.status = 'approved'
      and l.archived_at is null
      and (l.expires_at is null or l.expires_at > now())
    limit 1
  )
  select
    count(follows.seller_user_id)::bigint as follower_count,
    exists (select 1 from public_seller)
      and exists (
        select 1
        from public.seller_follows own_follow
        where own_follow.seller_user_id = p_seller_user_id
          and own_follow.follower_user_id = auth.uid()
      ) as is_following
  from public.seller_follows follows
  where follows.seller_user_id = p_seller_user_id
    and exists (select 1 from public_seller);
$$;

create or replace function public.rawaj_list_followed_sellers_v1(p_limit integer default 12)
returns table (
  id uuid,
  display_name text,
  first_name text,
  last_name text,
  business_name text,
  governorate text,
  bio text,
  avatar_path text,
  avatar_url text,
  approved_listing_count integer,
  followed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with followed as (
    select sf.seller_user_id, sf.created_at
    from public.seller_follows sf
    where sf.follower_user_id = auth.uid()
    order by sf.created_at desc
    limit least(greatest(coalesce(p_limit, 12), 1), 30)
  ), public_listing_counts as (
    select l.owner_id, count(*)::integer as approved_listing_count
    from public.listings l
    join followed f on f.seller_user_id = l.owner_id
    where l.status = 'approved'
      and l.archived_at is null
      and (l.expires_at is null or l.expires_at > now())
    group by l.owner_id
  )
  select
    p.id,
    p.display_name,
    p.first_name,
    p.last_name,
    p.business_name,
    p.governorate,
    p.bio,
    p.avatar_path,
    p.avatar_url,
    plc.approved_listing_count,
    f.created_at as followed_at
  from followed f
  join public.profiles p on p.id = f.seller_user_id
  join public_listing_counts plc on plc.owner_id = p.id
  order by f.created_at desc;
$$;

revoke all on function public.rawaj_record_recent_listing_view_v1(uuid) from public;
revoke all on function public.rawaj_remove_recent_listing_view_v1(uuid) from public;
revoke all on function public.rawaj_clear_recent_listing_views_v1() from public;
revoke all on function public.rawaj_set_seller_follow_v1(uuid, boolean) from public;
revoke all on function public.rawaj_get_seller_follow_summary_v1(uuid) from public;
revoke all on function public.rawaj_list_followed_sellers_v1(integer) from public;

grant execute on function public.rawaj_record_recent_listing_view_v1(uuid) to authenticated;
grant execute on function public.rawaj_remove_recent_listing_view_v1(uuid) to authenticated;
grant execute on function public.rawaj_clear_recent_listing_views_v1() to authenticated;
grant execute on function public.rawaj_set_seller_follow_v1(uuid, boolean) to authenticated;
grant execute on function public.rawaj_get_seller_follow_summary_v1(uuid) to anon, authenticated;
grant execute on function public.rawaj_list_followed_sellers_v1(integer) to authenticated;

comment on table public.recent_listing_views is
  'Private per-user listing history. Only the owning user can read or mutate rows.';
comment on table public.seller_follows is
  'Private follower-to-seller edges. Public surfaces receive counts only through a controlled RPC.';
comment on function public.rawaj_get_seller_follow_summary_v1(uuid) is
  'Returns a follower count and current-user follow state only for sellers with public live listings; follower identities remain private.';

commit;
