-- RAWAJ governed listing price-drop contract.
--
-- Real offers must come from an owner-authorized reduction of a currently public
-- listing price. Featured/promoted state is deliberately unrelated to this contract.

create table if not exists public.listing_price_changes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  old_price numeric(14, 2) not null,
  new_price numeric(14, 2) not null,
  currency text not null default 'SYP',
  created_at timestamptz not null default now(),
  constraint listing_price_changes_prices_valid check (
    old_price > 0
    and new_price > 0
    and new_price < old_price
  ),
  constraint listing_price_changes_currency_syp check (currency = 'SYP')
);

create index if not exists idx_listing_price_changes_listing_created
  on public.listing_price_changes (listing_id, created_at desc);

create index if not exists idx_listing_price_changes_owner_created
  on public.listing_price_changes (owner_id, created_at desc);

alter table public.listing_price_changes enable row level security;

drop policy if exists "listing_price_changes_owner_select" on public.listing_price_changes;
create policy "listing_price_changes_owner_select"
on public.listing_price_changes
for select
to authenticated
using (owner_id = auth.uid());

-- Keep direct client writes closed. Price changes are created only by the governed
-- owner RPC below.

create or replace function public.rawaj_protect_listing_moderation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('rawaj.owner_price_drop_write', true) = 'on' then
    if auth.uid() is null or old.owner_id <> auth.uid() then
      raise exception 'listing_price_drop_permission_denied';
    end if;

    if old.status <> 'approved' or new.status is distinct from old.status then
      raise exception 'listing_price_drop_requires_approved_listing';
    end if;

    if (to_jsonb(new) - array['price', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['price', 'updated_at'])
    then
      raise exception 'listing_price_drop_unsafe_update';
    end if;

    if old.price is null
       or new.price is null
       or old.price <= 0
       or new.price <= 0
       or new.price >= old.price
    then
      raise exception 'listing_price_drop_invalid_price';
    end if;

    return new;
  end if;

  if public.rawaj_current_user_can_review_listings()
     and (to_jsonb(new) - array[
           'status','reviewed_by','reviewed_at','rejection_reason',
           'published_at','archived_at','updated_at','status_changed_at',
           'expires_at'
         ])
         is not distinct from
         (to_jsonb(old) - array[
           'status','reviewed_by','reviewed_at','rejection_reason',
           'published_at','archived_at','updated_at','status_changed_at',
           'expires_at'
         ])
  then
    return new;
  end if;

  if old.owner_id = auth.uid()
     and old.status in ('draft', 'rejected')
     and new.status = 'pending_review'
     and new.owner_id is not distinct from old.owner_id
     and new.is_featured is not distinct from old.is_featured
     and new.featured_until is not distinct from old.featured_until
     and new.reviewed_by is null
     and new.reviewed_at is null
     and new.rejection_reason is null
     and new.published_at is null
     and new.archived_at is null
  then
    return new;
  end if;

  if old.owner_id = auth.uid()
     and old.status in ('draft', 'rejected')
  then
    if new.owner_id is distinct from old.owner_id
      or new.is_featured is distinct from old.is_featured
      or new.featured_until is distinct from old.featured_until
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.rejection_reason is distinct from old.rejection_reason
      or new.published_at is distinct from old.published_at
      or new.archived_at is distinct from old.archived_at
    then
      raise exception 'Listing owners cannot change moderation-controlled fields.';
    end if;
    return new;
  end if;

  if public.rawaj_current_user_can_review_listings() then
    raise exception 'Review staff can only change moderation-safe fields on listings.';
  end if;

  return new;
end;
$$;

create or replace function public.rawaj_owner_reduce_listing_price(
  p_listing_id uuid,
  p_new_price numeric
)
returns table (
  listing_id uuid,
  old_price numeric,
  new_price numeric,
  discount_percent numeric,
  dropped_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_drop public.listing_price_changes%rowtype;
begin
  if v_actor is null then
    raise exception 'listing_price_drop_auth_required';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'listing_price_drop_account_restricted';
  end if;

  if p_listing_id is null then
    raise exception 'listing_price_drop_invalid_listing';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
  for update;

  if not found then
    raise exception 'listing_price_drop_not_found';
  end if;

  if v_listing.status <> 'approved'
     or v_listing.archived_at is not null
     or (v_listing.expires_at is not null and v_listing.expires_at <= now())
  then
    raise exception 'listing_price_drop_requires_public_listing';
  end if;

  if v_listing.price_type::text not in ('fixed', 'negotiable')
     or v_listing.price is null
     or v_listing.price <= 0
  then
    raise exception 'listing_price_drop_requires_numeric_price';
  end if;

  if p_new_price is null
     or p_new_price <= 0
     or p_new_price >= v_listing.price
  then
    raise exception 'listing_price_drop_invalid_price';
  end if;

  -- Require at least a 1% real reduction so trivial rounding changes never become offers.
  if p_new_price > round(v_listing.price * 0.99, 2) then
    raise exception 'listing_price_drop_too_small';
  end if;

  perform set_config('rawaj.owner_price_drop_write', 'on', true);

  update public.listings l
  set price = p_new_price,
      updated_at = now()
  where l.id = p_listing_id;

  perform set_config('rawaj.owner_price_drop_write', 'off', true);

  insert into public.listing_price_changes (
    listing_id,
    owner_id,
    old_price,
    new_price,
    currency
  )
  values (
    p_listing_id,
    v_actor,
    v_listing.price,
    p_new_price,
    'SYP'
  )
  returning * into v_drop;

  begin
    perform public.rawaj_insert_audit_log(
      'listing.price_reduced',
      'listings',
      p_listing_id::text,
      jsonb_build_object(
        'old_price', v_listing.price,
        'new_price', p_new_price,
        'discount_percent', round(((v_listing.price - p_new_price) / v_listing.price) * 100, 1)
      )
    );
  exception when others then null;
  end;

  return query
  select
    p_listing_id,
    v_listing.price,
    p_new_price,
    round(((v_listing.price - p_new_price) / v_listing.price) * 100, 1),
    v_drop.created_at;
end;
$$;

revoke all on function public.rawaj_owner_reduce_listing_price(uuid, numeric) from public;
revoke all on function public.rawaj_owner_reduce_listing_price(uuid, numeric) from anon;
grant execute on function public.rawaj_owner_reduce_listing_price(uuid, numeric) to authenticated;

create or replace function public.rawaj_get_active_price_drop_offers(
  p_limit integer default 30
)
returns table (
  listing_id uuid,
  old_price numeric,
  new_price numeric,
  discount_percent numeric,
  dropped_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_drop as (
    select distinct on (c.listing_id)
      c.listing_id,
      c.old_price,
      c.new_price,
      c.created_at
    from public.listing_price_changes c
    order by c.listing_id, c.created_at desc, c.id desc
  )
  select
    l.id,
    d.old_price,
    d.new_price,
    round(((d.old_price - d.new_price) / d.old_price) * 100, 1),
    d.created_at
  from latest_drop d
  join public.listings l on l.id = d.listing_id
  where l.status = 'approved'
    and l.archived_at is null
    and (l.expires_at is null or l.expires_at > now())
    and l.price_type::text in ('fixed', 'negotiable')
    and l.price is not null
    and l.price = d.new_price
    and d.new_price > 0
    and d.old_price > d.new_price
    and d.created_at >= now() - interval '30 days'
    and round(((d.old_price - d.new_price) / d.old_price) * 100, 1) >= 1
  order by d.created_at desc, l.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke all on function public.rawaj_get_active_price_drop_offers(integer) from public;
grant execute on function public.rawaj_get_active_price_drop_offers(integer) to anon, authenticated;

comment on table public.listing_price_changes is
  'Immutable owner-authorized listing price reduction history. Direct client writes are unsupported.';

comment on function public.rawaj_owner_reduce_listing_price(uuid, numeric) is
  'Reduces an owned currently public numeric-price listing by at least 1%, records immutable history, and never depends on featured promotion state.';

comment on function public.rawaj_get_active_price_drop_offers(integer) is
  'Returns only recent real price drops whose latest recorded new price still equals the current public listing price.';
