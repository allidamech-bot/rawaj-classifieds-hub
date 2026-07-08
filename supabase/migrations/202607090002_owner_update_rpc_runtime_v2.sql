-- RAWAJ live owner-update RPC route repair.
--
-- Production catalog inspection confirmed public.rawaj_owner_update_listing(uuid, jsonb)
-- exists with postgres ownership and authenticated EXECUTE, while PostgREST still returns
-- 404 for the route. Publish a versioned PostgREST identity that delegates to the canonical
-- database boundary. The client still sends both named arguments, including an explicit
-- empty JSON object when no editable fields changed.

create or replace function public.rawaj_owner_update_listing_v2(
  p_listing_id uuid,
  p_patch jsonb default '{}'::jsonb
)
returns setof public.listings
language sql
volatile
security definer
set search_path = public
as $$
  select *
  from public.rawaj_owner_update_listing(
    p_listing_id,
    coalesce(p_patch, '{}'::jsonb)
  );
$$;

revoke all on function public.rawaj_owner_update_listing_v2(uuid, jsonb) from public;
revoke all on function public.rawaj_owner_update_listing_v2(uuid, jsonb) from anon;
grant execute on function public.rawaj_owner_update_listing_v2(uuid, jsonb) to authenticated;

comment on function public.rawaj_owner_update_listing_v2(uuid, jsonb) is
  'Versioned PostgREST owner draft/rejected edit route; always normalizes p_patch to a JSON object.';

notify pgrst, 'reload schema';
