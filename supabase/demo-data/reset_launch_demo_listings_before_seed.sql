-- RAWAJ trigger-safe reset for launch-catalog-v1.
-- Run this once before re-running seed_launch_demo_listings.sql when deterministic
-- demo IDs already exist and the moderation trigger blocks ON CONFLICT updates.
-- This removes only listings carrying the complete removable demo marker.

begin;

do $$
declare
  v_batch constant text := 'launch-catalog-v1';
  v_kind constant text := 'launch_demo';
  v_count integer;
begin
  select count(*)
    into v_count
  from public.listings
  where details #>> '{_rawaj_seed,batch}' = v_batch
    and details #>> '{_rawaj_seed,kind}' = v_kind
    and coalesce((details #>> '{_rawaj_seed,removable}')::boolean, false) = true
    and id::text like 'da100001-%';

  raise notice 'RAWAJ demo reset will remove % tagged listings from batch %', v_count, v_batch;

  delete from public.listings
  where details #>> '{_rawaj_seed,batch}' = v_batch
    and details #>> '{_rawaj_seed,kind}' = v_kind
    and coalesce((details #>> '{_rawaj_seed,removable}')::boolean, false) = true
    and id::text like 'da100001-%';

  if exists (
    select 1
    from public.listings
    where details #>> '{_rawaj_seed,batch}' = v_batch
      and details #>> '{_rawaj_seed,kind}' = v_kind
      and coalesce((details #>> '{_rawaj_seed,removable}')::boolean, false) = true
      and id::text like 'da100001-%'
  ) then
    raise exception 'RAWAJ demo reset incomplete: tagged demo rows remain';
  end if;
end $$;

commit;

select count(*) as remaining_tagged_launch_demo_listings
from public.listings
where details #>> '{_rawaj_seed,batch}' = 'launch-catalog-v1'
  and details #>> '{_rawaj_seed,kind}' = 'launch_demo'
  and coalesce((details #>> '{_rawaj_seed,removable}')::boolean, false) = true
  and id::text like 'da100001-%';
