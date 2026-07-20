-- RAWAJ admin runtime capability gate.
-- Prevents clients from invoking backend modules before their complete schema cutover exists.

create or replace function public.rawaj_admin_runtime_capabilities_v1()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'dataQualityReady',
    to_regclass('public.listing_data_quality_issues') is not null
    and to_regclass('public.field_definitions') is not null
    and to_regclass('public.taxonomy_field_rules') is not null
    and to_regclass('public.listing_attribute_values') is not null
    and to_regprocedure('public.rawaj_admin_fetch_data_quality_context_v1()') is not null
    and to_regprocedure(
      'public.rawaj_admin_fetch_listing_data_quality_v1(text,text,text,text,integer,integer)'
    ) is not null
    and to_regprocedure(
      'public.rawaj_owner_refresh_listing_data_quality_v1(uuid,integer,integer)'
    ) is not null
    and to_regprocedure(
      'public.rawaj_admin_review_listing_data_quality_v1(uuid,text,text,timestamp with time zone)'
    ) is not null
  );
$$;

revoke all on function public.rawaj_admin_runtime_capabilities_v1()
  from public, anon;
grant execute on function public.rawaj_admin_runtime_capabilities_v1()
  to authenticated;

comment on function public.rawaj_admin_runtime_capabilities_v1() is
  'Returns authenticated admin runtime readiness so clients avoid unavailable backend modules.';
