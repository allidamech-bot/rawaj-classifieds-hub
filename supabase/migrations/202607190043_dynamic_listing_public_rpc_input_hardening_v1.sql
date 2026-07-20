-- RAWAJ Taxonomy, Data & Search Foundation V1: bound public dynamic search inputs.
-- Forward-only hardening. Existing implementations are retained behind non-public names.

alter function public.rawaj_public_listing_facets_v1(
  text[], jsonb, uuid, numeric, numeric, text
) rename to rawaj_public_listing_facets_v1_impl;

revoke all on function public.rawaj_public_listing_facets_v1_impl(
  text[], jsonb, uuid, numeric, numeric, text
) from public, anon, authenticated;

create function public.rawaj_public_listing_facets_v1(
  p_taxonomy_node_ids text[] default null,
  p_attribute_filters jsonb default '{}'::jsonb,
  p_governorate_id uuid default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_query text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if p_taxonomy_node_ids is not null and cardinality(p_taxonomy_node_ids) > 250 then
    raise exception 'listing_facet_taxonomy_node_limit_exceeded' using errcode = '54000';
  end if;

  if length(v_query) > 160 then
    raise exception 'listing_facet_query_too_long' using errcode = '22023';
  end if;

  return public.rawaj_public_listing_facets_v1_impl(
    p_taxonomy_node_ids,
    p_attribute_filters,
    p_governorate_id,
    p_price_min,
    p_price_max,
    v_query
  );
end;
$$;

revoke all on function public.rawaj_public_listing_facets_v1(
  text[], jsonb, uuid, numeric, numeric, text
) from public;

grant execute on function public.rawaj_public_listing_facets_v1(
  text[], jsonb, uuid, numeric, numeric, text
) to anon, authenticated;

alter function public.rawaj_public_listing_search_page_v1(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) rename to rawaj_public_listing_search_page_v1_impl;

revoke all on function public.rawaj_public_listing_search_page_v1_impl(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) from public, anon, authenticated;

create function public.rawaj_public_listing_search_page_v1(
  p_taxonomy_node_ids text[] default null,
  p_attribute_filters jsonb default '{}'::jsonb,
  p_governorate_id uuid default null,
  p_location_node_ids uuid[] default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_price_type text default null,
  p_condition text default null,
  p_query text default null,
  p_with_photos boolean default false,
  p_sort text default 'latest',
  p_cursor jsonb default null,
  p_page_size integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if p_taxonomy_node_ids is not null and cardinality(p_taxonomy_node_ids) > 250 then
    raise exception 'listing_search_taxonomy_node_limit_exceeded' using errcode = '54000';
  end if;

  if p_location_node_ids is not null and cardinality(p_location_node_ids) > 250 then
    raise exception 'listing_search_location_node_limit_exceeded' using errcode = '54000';
  end if;

  if length(v_query) > 160 then
    raise exception 'listing_search_query_too_long' using errcode = '22023';
  end if;

  return public.rawaj_public_listing_search_page_v1_impl(
    p_taxonomy_node_ids,
    p_attribute_filters,
    p_governorate_id,
    p_location_node_ids,
    p_price_min,
    p_price_max,
    p_price_type,
    p_condition,
    v_query,
    p_with_photos,
    p_sort,
    p_cursor,
    p_page_size
  );
end;
$$;

revoke all on function public.rawaj_public_listing_search_page_v1(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) from public;

grant execute on function public.rawaj_public_listing_search_page_v1(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) to anon, authenticated;

comment on function public.rawaj_public_listing_facets_v1(
  text[], jsonb, uuid, numeric, numeric, text
) is 'Bounded public wrapper for dynamic listing facets. The implementation function is not executable by public application roles.';

comment on function public.rawaj_public_listing_search_page_v1(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) is 'Bounded public wrapper for dynamic listing search. The implementation function is not executable by public application roles.';
