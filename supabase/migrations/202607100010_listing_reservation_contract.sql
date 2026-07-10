-- RAWAJ governed listing reservation contract.
--
-- Reservation is intentionally orthogonal to moderation status. A reserved listing
-- remains approved/public so existing public visibility, links, filters, and prior
-- conversations do not break. Owners manage reservation only through the RPC below.

alter table public.listings
  add column if not exists reserved_at timestamptz null;

create index if not exists idx_listings_public_reserved
  on public.listings (reserved_at desc, updated_at desc)
  where status = 'approved' and reserved_at is not null and archived_at is null;

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

  if current_setting('rawaj.owner_reservation_write', true) = 'on' then
    if auth.uid() is null or old.owner_id <> auth.uid() then
      raise exception 'listing_reservation_permission_denied';
    end if;

    if old.status <> 'approved' or new.status is distinct from old.status then
      raise exception 'listing_reservation_requires_approved_listing';
    end if;

    if (to_jsonb(new) - array['reserved_at', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['reserved_at', 'updated_at'])
    then
      raise exception 'listing_reservation_unsafe_update';
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

create or replace function public.rawaj_owner_set_listing_reserved(
  p_listing_id uuid,
  p_reserved boolean
)
returns table (
  listing_id uuid,
  reserved_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_reserved_at timestamptz;
  v_updated_at timestamptz;
begin
  if v_actor is null then
    raise exception 'listing_reservation_auth_required';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.account_status in ('frozen', 'disabled')
  ) then
    raise exception 'listing_reservation_account_restricted';
  end if;

  if p_listing_id is null or p_reserved is null then
    raise exception 'listing_reservation_invalid_request';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
  for update;

  if not found then
    raise exception 'listing_reservation_not_found';
  end if;

  if v_listing.status <> 'approved'
     or v_listing.archived_at is not null
     or (v_listing.expires_at is not null and v_listing.expires_at <= now())
  then
    raise exception 'listing_reservation_requires_public_listing';
  end if;

  perform set_config('rawaj.owner_reservation_write', 'on', true);

  update public.listings l
  set reserved_at = case
        when p_reserved then coalesce(l.reserved_at, now())
        else null
      end,
      updated_at = now()
  where l.id = p_listing_id
  returning l.reserved_at, l.updated_at
  into v_reserved_at, v_updated_at;

  perform set_config('rawaj.owner_reservation_write', 'off', true);

  begin
    perform public.rawaj_insert_audit_log(
      case when p_reserved then 'listing.reserved' else 'listing.reservation_cleared' end,
      'listings',
      p_listing_id::text,
      jsonb_build_object('reserved', p_reserved)
    );
  exception when others then null;
  end;

  return query
  select p_listing_id, v_reserved_at, v_updated_at;
end;
$$;

revoke all on function public.rawaj_owner_set_listing_reserved(uuid, boolean) from public;
revoke all on function public.rawaj_owner_set_listing_reserved(uuid, boolean) from anon;
grant execute on function public.rawaj_owner_set_listing_reserved(uuid, boolean) to authenticated;

-- Reserved inventory is still publicly visible, but it should not be presented as
-- an active price-drop offer while the owner has it on hold.
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
    and l.reserved_at is null
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

comment on column public.listings.reserved_at is
  'Owner-controlled reservation marker. Reserved listings remain approved/public and keep stable URLs.';

comment on function public.rawaj_owner_set_listing_reserved(uuid, boolean) is
  'Allows only the authenticated owner of a currently public listing to set or clear reservation through a trigger-whitelisted write path.';
