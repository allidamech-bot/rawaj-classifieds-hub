begin transaction read only;

-- Schema inventory: monetary columns that must be classified before cutover.
select table_schema,
       table_name,
       column_name,
       data_type,
       is_nullable,
       column_default
from information_schema.columns
where table_schema = 'public'
  and (
    column_name ilike '%currency%'
    or column_name ilike '%price%'
    or column_name ilike '%amount%'
    or column_name ilike '%salary%'
  )
order by table_name, ordinal_position;

-- Current listing price distribution without exposing titles, owners, or contact data.
select currency,
       price_type,
       status,
       count(*) as listing_count,
       count(*) filter (where price is null) as null_price_count,
       min(price) filter (where price is not null) as minimum_price,
       max(price) filter (where price is not null) as maximum_price,
       percentile_cont(0.5) within group (order by price)
         filter (where price is not null) as median_price
from public.listings
group by currency, price_type, status
order by currency, price_type, status;

-- Buckets used to estimate manual classification effort. A bucket is never proof
-- of denomination and must not be used as an automatic conversion rule.
select status,
       count(*) as listing_count,
       count(*) filter (where price is null) as no_price,
       count(*) filter (where price > 0 and price < 1000) as under_1000,
       count(*) filter (where price >= 1000 and price < 100000) as from_1k_to_100k,
       count(*) filter (where price >= 100000 and price < 1000000) as from_100k_to_1m,
       count(*) filter (where price >= 1000000 and price < 10000000) as from_1m_to_10m,
       count(*) filter (where price >= 10000000) as at_least_10m
from public.listings
group by status
order by status;

-- Dependent historical and filter data that must be included in a future migration.
select (select count(*) from public.favorite_listing_snapshots) as favorite_snapshot_rows,
       (select count(*) from public.listing_price_changes) as price_change_rows,
       (
         select count(*)
         from public.saved_searches
         where filters::text ilike '%price%'
       ) as saved_searches_with_price_filters;

-- Constraints and governed functions whose contracts include prices or currencies.
select constraint_row.conrelid::regclass::text as table_name,
       constraint_row.conname,
       pg_get_constraintdef(constraint_row.oid) as definition
from pg_constraint constraint_row
where constraint_row.connamespace = 'public'::regnamespace
  and (
    pg_get_constraintdef(constraint_row.oid) ilike '%currency%'
    or pg_get_constraintdef(constraint_row.oid) ilike '%price%'
  )
order by table_name, constraint_row.conname;

select namespace_row.nspname as schema_name,
       procedure_row.proname as function_name,
       pg_get_function_identity_arguments(procedure_row.oid) as arguments
from pg_proc procedure_row
join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
where namespace_row.nspname = 'public'
  and procedure_row.prokind in ('f', 'p')
  and pg_get_functiondef(procedure_row.oid) ~*
    '(currency|price_snapshot|old_price|new_price|price_type)'
order by procedure_row.proname, arguments;

rollback;
