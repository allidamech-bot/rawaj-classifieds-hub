-- Remove only RAWAJ launch demo listings from launch-catalog-v1.
-- Related listing_images, favorites, reports and other dependent rows are removed by FK cascades.

begin;

do $$
declare
  v_batch constant text := 'launch-catalog-v1';
  v_count integer;
begin
  select count(*)
    into v_count
  from public.listings
  where details #>> '{_rawaj_seed,batch}' = v_batch
    and details #>> '{_rawaj_seed,kind}' = 'launch_demo'
    and coalesce((details #>> '{_rawaj_seed,removable}')::boolean, false) = true;

  raise notice 'RAWAJ demo cleanup will remove % listings from batch %', v_count, v_batch;

  delete from public.listings
  where details #>> '{_rawaj_seed,batch}' = v_batch
    and details #>> '{_rawaj_seed,kind}' = 'launch_demo'
    and coalesce((details #>> '{_rawaj_seed,removable}')::boolean, false) = true;

  if exists (
    select 1 from public.listings
    where details #>> '{_rawaj_seed,batch}' = v_batch
  ) then
    raise exception 'RAWAJ demo cleanup incomplete: tagged rows remain';
  end if;
end $$;

commit;

select count(*) as remaining_launch_demo_listings
from public.listings
where details #>> '{_rawaj_seed,batch}' = 'launch-catalog-v1';
