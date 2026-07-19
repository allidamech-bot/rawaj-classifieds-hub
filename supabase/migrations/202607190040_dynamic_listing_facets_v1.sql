-- RAWAJ Taxonomy, Data & Search Foundation V1: dynamic public facets.
-- Additive only. The RPC reads the published taxonomy and visible listings; it does not mutate data.

create or replace function public.rawaj_public_listing_facets_v1(
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
  v_version_id uuid;
  v_filters jsonb := coalesce(p_attribute_filters, '{}'::jsonb);
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_total_count bigint := 0;
  v_facets jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v_filters) <> 'object' then
    raise exception 'listing_facet_filters_object_required' using errcode = '22023';
  end if;

  if jsonb_object_length(v_filters) > 50 then
    raise exception 'listing_facet_filter_limit_exceeded' using errcode = '54000';
  end if;

  if p_price_min is not null and p_price_min < 0 then
    raise exception 'listing_facet_price_min_invalid' using errcode = '22023';
  end if;

  if p_price_max is not null and p_price_max < 0 then
    raise exception 'listing_facet_price_max_invalid' using errcode = '22023';
  end if;

  if p_price_min is not null and p_price_max is not null and p_price_min > p_price_max then
    raise exception 'listing_facet_price_range_invalid' using errcode = '22023';
  end if;

  select version_row.id
    into v_version_id
  from public.taxonomy_versions version_row
  where version_row.status = 'published'
  order by version_row.version_number desc
  limit 1;

  if v_version_id is null then
    return jsonb_build_object(
      'taxonomyVersionId', null,
      'totalCount', 0,
      'facets', '[]'::jsonb
    );
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_filters) input_key(field_key)
    where not exists (
      select 1
      from public.field_definitions field_row
      join public.taxonomy_field_rules rule_row
        on rule_row.field_key = field_row.key
       and rule_row.version_id = v_version_id
      where field_row.key = input_key.field_key
        and field_row.is_active
        and not field_row.is_sensitive
        and field_row.is_filterable
        and (
          p_taxonomy_node_ids is null
          or cardinality(p_taxonomy_node_ids) = 0
          or rule_row.taxonomy_node_id = any(p_taxonomy_node_ids)
        )
    )
  ) then
    raise exception 'listing_facet_field_not_allowed' using errcode = '22023';
  end if;

  with candidate_listings as (
    select listing_row.id
    from public.listings listing_row
    join public.listing_taxonomy_assignments assignment_row
      on assignment_row.listing_id = listing_row.id
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = v_version_id
     and node_row.node_id = assignment_row.taxonomy_node_id
    where listing_row.status = 'approved'
      and listing_row.archived_at is null
      and (listing_row.expires_at is null or listing_row.expires_at > now())
      and node_row.is_active
      and node_row.is_leaf
      and (
        p_taxonomy_node_ids is null
        or cardinality(p_taxonomy_node_ids) = 0
        or assignment_row.taxonomy_node_id = any(p_taxonomy_node_ids)
      )
      and (p_governorate_id is null or listing_row.governorate_id = p_governorate_id)
      and (p_price_min is null or listing_row.price >= p_price_min)
      and (p_price_max is null or listing_row.price <= p_price_max)
      and (
        v_query is null
        or listing_row.search_document @@ websearch_to_tsquery('simple', public.rawaj_normalize_arabic_search(v_query))
      )
      and not exists (
        select 1
        from jsonb_each(v_filters) filter_row(field_key, filter_value)
        where not exists (
          select 1
          from public.listing_attribute_values attribute_row
          join public.field_definitions field_row
            on field_row.key = attribute_row.field_key
          where attribute_row.listing_id = listing_row.id
            and attribute_row.field_key = filter_row.field_key
            and field_row.is_active
            and not field_row.is_sensitive
            and field_row.is_filterable
            and case
              when jsonb_typeof(filter_row.filter_value) = 'array' then
                (
                  attribute_row.value_key is not null
                  and filter_row.filter_value ? attribute_row.value_key
                )
                or (
                  attribute_row.value_json is not null
                  and exists (
                    select 1
                    from jsonb_array_elements_text(attribute_row.value_json) selected_value(value)
                    where filter_row.filter_value ? selected_value.value
                  )
                )
              when jsonb_typeof(filter_row.filter_value) = 'object'
                and filter_row.filter_value ? 'min'
                or jsonb_typeof(filter_row.filter_value) = 'object'
                and filter_row.filter_value ? 'max' then
                attribute_row.value_numeric is not null
                and (
                  not (filter_row.filter_value ? 'min')
                  or attribute_row.value_numeric >= (filter_row.filter_value ->> 'min')::numeric
                )
                and (
                  not (filter_row.filter_value ? 'max')
                  or attribute_row.value_numeric <= (filter_row.filter_value ->> 'max')::numeric
                )
              when jsonb_typeof(filter_row.filter_value) = 'boolean' then
                attribute_row.value_boolean = (filter_row.filter_value #>> '{}')::boolean
              else
                coalesce(
                  attribute_row.value_key,
                  attribute_row.value_text,
                  attribute_row.value_numeric::text,
                  attribute_row.value_date::text
                ) = filter_row.filter_value #>> '{}'
            end
        )
      )
  )
  select count(*) into v_total_count from candidate_listings;

  with available_rules as (
    select distinct on (rule_row.field_key)
      rule_row.field_key,
      rule_row.sort_order,
      rule_row.group_key,
      field_row.label_ar,
      field_row.label_en,
      field_row.field_type,
      field_row.option_set_key
    from public.taxonomy_field_rules rule_row
    join public.field_definitions field_row
      on field_row.key = rule_row.field_key
    where rule_row.version_id = v_version_id
      and field_row.is_active
      and not field_row.is_sensitive
      and field_row.is_filterable
      and (
        p_taxonomy_node_ids is null
        or cardinality(p_taxonomy_node_ids) = 0
        or rule_row.taxonomy_node_id = any(p_taxonomy_node_ids)
      )
    order by rule_row.field_key, rule_row.sort_order
  ),
  candidate_listings as (
    select listing_row.id
    from public.listings listing_row
    join public.listing_taxonomy_assignments assignment_row
      on assignment_row.listing_id = listing_row.id
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = v_version_id
     and node_row.node_id = assignment_row.taxonomy_node_id
    where listing_row.status = 'approved'
      and listing_row.archived_at is null
      and (listing_row.expires_at is null or listing_row.expires_at > now())
      and node_row.is_active
      and node_row.is_leaf
      and (
        p_taxonomy_node_ids is null
        or cardinality(p_taxonomy_node_ids) = 0
        or assignment_row.taxonomy_node_id = any(p_taxonomy_node_ids)
      )
      and (p_governorate_id is null or listing_row.governorate_id = p_governorate_id)
      and (p_price_min is null or listing_row.price >= p_price_min)
      and (p_price_max is null or listing_row.price <= p_price_max)
      and (
        v_query is null
        or listing_row.search_document @@ websearch_to_tsquery('simple', public.rawaj_normalize_arabic_search(v_query))
      )
      and not exists (
        select 1
        from jsonb_each(v_filters) filter_row(field_key, filter_value)
        where filter_row.field_key <> available_rules.field_key
          and not exists (
            select 1
            from public.listing_attribute_values attribute_row
            where attribute_row.listing_id = listing_row.id
              and attribute_row.field_key = filter_row.field_key
              and case
                when jsonb_typeof(filter_row.filter_value) = 'array' then
                  (attribute_row.value_key is not null and filter_row.filter_value ? attribute_row.value_key)
                  or (
                    attribute_row.value_json is not null
                    and exists (
                      select 1
                      from jsonb_array_elements_text(attribute_row.value_json) selected_value(value)
                      where filter_row.filter_value ? selected_value.value
                    )
                  )
                when jsonb_typeof(filter_row.filter_value) = 'object'
                  and (filter_row.filter_value ? 'min' or filter_row.filter_value ? 'max') then
                  attribute_row.value_numeric is not null
                  and (
                    not (filter_row.filter_value ? 'min')
                    or attribute_row.value_numeric >= (filter_row.filter_value ->> 'min')::numeric
                  )
                  and (
                    not (filter_row.filter_value ? 'max')
                    or attribute_row.value_numeric <= (filter_row.filter_value ->> 'max')::numeric
                  )
                when jsonb_typeof(filter_row.filter_value) = 'boolean' then
                  attribute_row.value_boolean = (filter_row.filter_value #>> '{}')::boolean
                else
                  coalesce(
                    attribute_row.value_key,
                    attribute_row.value_text,
                    attribute_row.value_numeric::text,
                    attribute_row.value_date::text
                  ) = filter_row.filter_value #>> '{}'
              end
          )
      )
  ),
  option_counts as (
    select
      rule_row.field_key,
      coalesce(attribute_row.value_key, selected_value.value) as value_key,
      count(distinct candidate_row.id) as result_count
    from available_rules rule_row
    join candidate_listings candidate_row on true
    join public.listing_attribute_values attribute_row
      on attribute_row.listing_id = candidate_row.id
     and attribute_row.field_key = rule_row.field_key
    left join lateral jsonb_array_elements_text(
      case
        when attribute_row.value_json is not null and jsonb_typeof(attribute_row.value_json) = 'array'
          then attribute_row.value_json
        else '[]'::jsonb
      end
    ) selected_value(value) on true
    where rule_row.field_type in ('single_select', 'multi_select', 'reference', 'location', 'boolean')
      and coalesce(attribute_row.value_key, selected_value.value) is not null
    group by rule_row.field_key, coalesce(attribute_row.value_key, selected_value.value)
  ),
  numeric_ranges as (
    select
      rule_row.field_key,
      min(attribute_row.value_numeric) as minimum,
      max(attribute_row.value_numeric) as maximum
    from available_rules rule_row
    join candidate_listings candidate_row on true
    join public.listing_attribute_values attribute_row
      on attribute_row.listing_id = candidate_row.id
     and attribute_row.field_key = rule_row.field_key
    where rule_row.field_type in ('integer', 'numeric', 'year')
      and attribute_row.value_numeric is not null
    group by rule_row.field_key
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fieldKey', rule_row.field_key,
        'labelAr', rule_row.label_ar,
        'labelEn', rule_row.label_en,
        'fieldType', rule_row.field_type,
        'groupKey', rule_row.group_key,
        'sortOrder', rule_row.sort_order,
        'options', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'valueKey', count_row.value_key,
                'labelAr', coalesce(option_row.label_ar, count_row.value_key),
                'labelEn', option_row.label_en,
                'count', count_row.result_count
              )
              order by option_row.sort_order nulls last, count_row.value_key
            )
            from option_counts count_row
            left join public.option_values option_row
              on option_row.option_set_key = rule_row.option_set_key
             and option_row.value_key = count_row.value_key
            where count_row.field_key = rule_row.field_key
          ),
          '[]'::jsonb
        ),
        'minimum', range_row.minimum,
        'maximum', range_row.maximum
      )
      order by rule_row.sort_order, rule_row.field_key
    ),
    '[]'::jsonb
  )
    into v_facets
  from available_rules rule_row
  left join numeric_ranges range_row
    on range_row.field_key = rule_row.field_key;

  return jsonb_build_object(
    'taxonomyVersionId', v_version_id,
    'totalCount', v_total_count,
    'facets', v_facets
  );
end;
$$;

revoke all on function public.rawaj_public_listing_facets_v1(text[], jsonb, uuid, numeric, numeric, text)
  from public;
grant execute on function public.rawaj_public_listing_facets_v1(text[], jsonb, uuid, numeric, numeric, text)
  to anon, authenticated;

comment on function public.rawaj_public_listing_facets_v1(text[], jsonb, uuid, numeric, numeric, text) is
  'Returns exact visible-listing totals and dynamic filter facets from the published taxonomy field rules for every marketplace category.';
