-- RAWAJ Taxonomy, Data & Search Foundation V1: canonical dynamic listing search page.
-- Returns only visible listing IDs, an exact total, and a stable cursor. Listing fields
-- continue to be hydrated through the existing public field allowlist in the client.

create or replace function public.rawaj_public_listing_search_page_v1(
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
  v_version_id uuid;
  v_filters jsonb := coalesce(p_attribute_filters, '{}'::jsonb);
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'latest');
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 30), 50));
  v_total_count bigint := 0;
  v_listing_ids jsonb := '[]'::jsonb;
  v_has_more boolean := false;
  v_last jsonb;
  v_next_cursor jsonb := null;
begin
  if jsonb_typeof(v_filters) <> 'object' then
    raise exception 'listing_search_filters_object_required' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_object_keys(v_filters)) > 50 then
    raise exception 'listing_search_filter_limit_exceeded' using errcode = '54000';
  end if;

  if v_sort not in ('latest', 'cheapest', 'expensive', 'featured') then
    raise exception 'listing_search_sort_invalid' using errcode = '22023';
  end if;

  if p_cursor is not null and jsonb_typeof(p_cursor) <> 'object' then
    raise exception 'listing_search_cursor_object_required' using errcode = '22023';
  end if;

  if p_price_min is not null and p_price_min < 0 then
    raise exception 'listing_search_price_min_invalid' using errcode = '22023';
  end if;

  if p_price_max is not null and p_price_max < 0 then
    raise exception 'listing_search_price_max_invalid' using errcode = '22023';
  end if;

  if p_price_min is not null and p_price_max is not null and p_price_min > p_price_max then
    raise exception 'listing_search_price_range_invalid' using errcode = '22023';
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
      'listingIds', '[]'::jsonb,
      'nextCursor', null
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
    raise exception 'listing_search_field_not_allowed' using errcode = '22023';
  end if;

  with candidate_listings as (
    select
      listing_row.id,
      listing_row.price,
      listing_row.is_featured,
      listing_row.created_at
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
      and (
        p_location_node_ids is null
        or cardinality(p_location_node_ids) = 0
        or listing_row.location_node_id = any(p_location_node_ids)
        or (
          listing_row.location_node_id is null
          and p_governorate_id is not null
          and listing_row.governorate_id = p_governorate_id
        )
      )
      and (
        (p_location_node_ids is not null and cardinality(p_location_node_ids) > 0)
        or p_governorate_id is null
        or listing_row.governorate_id = p_governorate_id
      )
      and (p_price_min is null or listing_row.price >= p_price_min)
      and (p_price_max is null or listing_row.price <= p_price_max)
      and (p_price_type is null or listing_row.price_type::text = p_price_type)
      and (p_condition is null or listing_row.listing_condition::text = p_condition)
      and (
        v_query is null
        or coalesce(
          listing_row.search_document @@ websearch_to_tsquery(
            'simple',
            public.rawaj_normalize_arabic_search(v_query)
          ),
          false
        )
        or listing_row.title ilike '%' || v_query || '%'
        or listing_row.description ilike '%' || v_query || '%'
      )
      and (
        not coalesce(p_with_photos, false)
        or exists (
          select 1
          from public.listing_images image_row
          where image_row.listing_id = listing_row.id
        )
      )
      and not exists (
        select 1
        from jsonb_each(v_filters) filter_row(field_key, filter_value)
        where not exists (
          select 1
          from public.listing_attribute_values attribute_row
          where attribute_row.listing_id = listing_row.id
            and attribute_row.field_key = filter_row.field_key
            and case
              when jsonb_typeof(filter_row.filter_value) = 'array' then
                (
                  attribute_row.value_key is not null
                  and filter_row.filter_value ? attribute_row.value_key
                )
                or (
                  attribute_row.value_json is not null
                  and jsonb_typeof(attribute_row.value_json) = 'array'
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
                  attribute_row.value_date::text,
                  attribute_row.value_boolean::text
                ) = filter_row.filter_value #>> '{}'
            end
        )
      )
  ),
  cursor_filtered as (
    select candidate_row.*
    from candidate_listings candidate_row
    where p_cursor is null
      or case v_sort
        when 'latest' then
          candidate_row.created_at < (p_cursor ->> 'created_at')::timestamptz
          or (
            candidate_row.created_at = (p_cursor ->> 'created_at')::timestamptz
            and candidate_row.id < (p_cursor ->> 'id')::uuid
          )
        when 'featured' then
          case when coalesce((p_cursor ->> 'is_featured')::boolean, false) then
            not candidate_row.is_featured
            or (
              candidate_row.is_featured
              and candidate_row.created_at < (p_cursor ->> 'created_at')::timestamptz
            )
            or (
              candidate_row.is_featured
              and candidate_row.created_at = (p_cursor ->> 'created_at')::timestamptz
              and candidate_row.id < (p_cursor ->> 'id')::uuid
            )
          else
            not candidate_row.is_featured
            and (
              candidate_row.created_at < (p_cursor ->> 'created_at')::timestamptz
              or (
                candidate_row.created_at = (p_cursor ->> 'created_at')::timestamptz
                and candidate_row.id < (p_cursor ->> 'id')::uuid
              )
            )
          end
        when 'cheapest' then
          case when p_cursor ->> 'price' is null then
            candidate_row.price is null
            and candidate_row.id > (p_cursor ->> 'id')::uuid
          else
            candidate_row.price > (p_cursor ->> 'price')::numeric
            or candidate_row.price is null
            or (
              candidate_row.price = (p_cursor ->> 'price')::numeric
              and candidate_row.id > (p_cursor ->> 'id')::uuid
            )
          end
        when 'expensive' then
          case when p_cursor ->> 'price' is null then
            candidate_row.price is null
            and candidate_row.id > (p_cursor ->> 'id')::uuid
          else
            candidate_row.price < (p_cursor ->> 'price')::numeric
            or candidate_row.price is null
            or (
              candidate_row.price = (p_cursor ->> 'price')::numeric
              and candidate_row.id > (p_cursor ->> 'id')::uuid
            )
          end
      end
  ),
  ordered_rows as (
    select
      cursor_row.*,
      row_number() over (
        order by
          case when v_sort = 'featured' then cursor_row.is_featured end desc,
          case when v_sort in ('latest', 'featured') then cursor_row.created_at end desc,
          case when v_sort = 'cheapest' then cursor_row.price end asc nulls last,
          case when v_sort = 'expensive' then cursor_row.price end desc nulls last,
          case when v_sort in ('cheapest', 'expensive') then cursor_row.id end asc,
          case when v_sort in ('latest', 'featured') then cursor_row.id end desc
      ) as ordinal
    from cursor_filtered cursor_row
  ),
  page_rows as (
    select ordered_row.*
    from ordered_rows ordered_row
    where ordered_row.ordinal <= v_page_size + 1
  ),
  visible_rows as (
    select page_row.*
    from page_rows page_row
    where page_row.ordinal <= v_page_size
  )
  select
    (select count(*) from candidate_listings),
    coalesce(
      (select jsonb_agg(visible_row.id order by visible_row.ordinal) from visible_rows visible_row),
      '[]'::jsonb
    ),
    exists (select 1 from page_rows page_row where page_row.ordinal = v_page_size + 1),
    (
      select to_jsonb(visible_row)
      from visible_rows visible_row
      order by visible_row.ordinal desc
      limit 1
    )
    into v_total_count, v_listing_ids, v_has_more, v_last;

  if v_has_more and v_last is not null then
    v_next_cursor := case v_sort
      when 'latest' then jsonb_build_object(
        'type', 'latest',
        'created_at', v_last ->> 'created_at',
        'id', v_last ->> 'id'
      )
      when 'featured' then jsonb_build_object(
        'type', 'featured',
        'is_featured', (v_last ->> 'is_featured')::boolean,
        'created_at', v_last ->> 'created_at',
        'id', v_last ->> 'id'
      )
      when 'cheapest' then jsonb_build_object(
        'type', 'cheapest',
        'price', v_last -> 'price',
        'id', v_last ->> 'id'
      )
      when 'expensive' then jsonb_build_object(
        'type', 'expensive',
        'price', v_last -> 'price',
        'id', v_last ->> 'id'
      )
    end;
  end if;

  return jsonb_build_object(
    'taxonomyVersionId', v_version_id,
    'totalCount', coalesce(v_total_count, 0),
    'listingIds', v_listing_ids,
    'nextCursor', v_next_cursor
  );
end;
$$;

revoke all on function public.rawaj_public_listing_search_page_v1(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) from public;

grant execute on function public.rawaj_public_listing_search_page_v1(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) to anon, authenticated;

comment on function public.rawaj_public_listing_search_page_v1(
  text[], jsonb, uuid, uuid[], numeric, numeric, text, text, text, boolean, text, jsonb, integer
) is
  'Returns a stable paginated page of visible listing IDs using canonical taxonomy and dynamic field filters for every marketplace category.';
