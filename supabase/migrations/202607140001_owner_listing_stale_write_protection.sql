-- RAWAJ owner listing stale-write protection.
--
-- An owner edit must be based on the exact listing version that the client
-- previously read or created. The row lock and expected updated_at comparison
-- prevent an older browser tab or device from overwriting a newer draft edit.

create or replace function public.rawaj_owner_update_listing_v3(
  p_listing_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_expected_updated_at timestamptz default null
)
returns setof public.listings
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_current_updated_at timestamptz;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'stale_owner_update';
  end if;

  select l.updated_at
    into v_current_updated_at
  from public.listings l
  where l.id = p_listing_id
    and l.owner_id = v_actor
    and l.status in ('draft', 'rejected')
  for update;

  if not found then
    raise exception 'Editable owned listing not found.';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_owner_update';
  end if;

  return query
  select *
  from public.rawaj_owner_update_listing(
    p_listing_id,
    coalesce(p_patch, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.rawaj_owner_update_listing_v3(uuid, jsonb, timestamptz) from public;
revoke all on function public.rawaj_owner_update_listing_v3(uuid, jsonb, timestamptz) from anon;
grant execute on function public.rawaj_owner_update_listing_v3(uuid, jsonb, timestamptz) to authenticated;

comment on function public.rawaj_owner_update_listing_v3(uuid, jsonb, timestamptz) is
  'Stale-safe owner draft/rejected edit boundary; rejects writes unless updated_at matches the version previously read by the client.';

notify pgrst, 'reload schema';
