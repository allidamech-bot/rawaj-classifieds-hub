-- Keep favorites and their private listing snapshots transactionally consistent.
-- The function remains SECURITY INVOKER so existing RLS policies stay authoritative.

create or replace function public.rawaj_set_favorite_v1(
  p_listing_id uuid,
  p_favorited boolean
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing record;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_listing_id is null then
    return false;
  end if;

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
    values (v_user_id, p_listing_id)
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
      v_user_id,
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
  where user_id = v_user_id
    and listing_id = p_listing_id;

  delete from public.favorites
  where user_id = v_user_id
    and listing_id = p_listing_id;

  return true;
end;
$$;

revoke all on function public.rawaj_set_favorite_v1(uuid, boolean) from public;
grant execute on function public.rawaj_set_favorite_v1(uuid, boolean) to authenticated;
