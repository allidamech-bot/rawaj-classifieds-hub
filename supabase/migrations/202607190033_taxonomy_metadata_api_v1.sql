-- RAWAJ Taxonomy, Data & Search Foundation V1: stable public metadata APIs.
-- Read-only and additive. Draft taxonomy versions remain invisible to clients.

create or replace function public.rawaj_fetch_published_taxonomy_v1()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with published_version as (
    select version_row.id, version_row.version_number, version_row.published_at
    from public.taxonomy_versions version_row
    where version_row.status = 'published'
    order by version_row.version_number desc
    limit 1
  ), active_nodes as (
    select node_row.*
    from public.taxonomy_version_nodes node_row
    join published_version version_row
      on version_row.id = node_row.version_id
    where node_row.is_active
  )
  select jsonb_build_object(
    'version', (
      select jsonb_build_object(
        'id', version_row.id,
        'number', version_row.version_number,
        'publishedAt', version_row.published_at
      )
      from published_version version_row
    ),
    'nodes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', node_row.node_id,
            'parentId', node_row.parent_node_id,
            'slug', node_row.slug,
            'nameAr', node_row.name_ar,
            'nameEn', node_row.name_en,
            'descriptionAr', node_row.description_ar,
            'descriptionEn', node_row.description_en,
            'iconKey', node_row.icon_key,
            'sortOrder', node_row.sort_order,
            'depth', node_row.depth,
            'isLeaf', node_row.is_leaf,
            'filterSchemaKey', node_row.filter_schema_key,
            'displaySchemaKey', node_row.display_schema_key,
            'classificationKey', node_row.classification_key,
            'classificationValue', node_row.classification_value,
            'legacyCategoryId', node_row.legacy_category_id,
            'legacySubcategoryId', node_row.legacy_subcategory_id,
            'seoTitleAr', node_row.seo_title_ar,
            'seoTitleEn', node_row.seo_title_en,
            'seoDescriptionAr', node_row.seo_description_ar,
            'seoDescriptionEn', node_row.seo_description_en
          )
          order by node_row.depth, node_row.sort_order, node_row.node_id
        )
        from active_nodes node_row
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.rawaj_fetch_published_leaf_schema_v1(
  p_taxonomy_node_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with published_version as (
    select version_row.id, version_row.version_number, version_row.published_at
    from public.taxonomy_versions version_row
    where version_row.status = 'published'
    order by version_row.version_number desc
    limit 1
  ), selected_leaf as (
    select node_row.*
    from public.taxonomy_version_nodes node_row
    join published_version version_row
      on version_row.id = node_row.version_id
    where node_row.node_id = nullif(btrim(p_taxonomy_node_id), '')
      and node_row.is_active
      and node_row.is_leaf
    limit 1
  ), leaf_fields as (
    select
      rule_row.version_id,
      rule_row.taxonomy_node_id,
      rule_row.field_key,
      rule_row.group_key,
      rule_row.sort_order,
      rule_row.is_required,
      rule_row.is_searchable,
      rule_row.is_filterable,
      rule_row.is_displayable,
      rule_row.display_surfaces,
      rule_row.validation_override,
      rule_row.default_value,
      field_row.label_ar,
      field_row.label_en,
      field_row.description_ar,
      field_row.description_en,
      field_row.placeholder_ar,
      field_row.placeholder_en,
      field_row.field_type,
      field_row.unit_key,
      field_row.option_set_key,
      field_row.data_provider_key,
      field_row.validation_schema,
      field_row.is_sensitive
    from public.taxonomy_field_rules rule_row
    join selected_leaf leaf_row
      on leaf_row.version_id = rule_row.version_id
     and leaf_row.node_id = rule_row.taxonomy_node_id
    join public.field_definitions field_row
      on field_row.key = rule_row.field_key
     and field_row.is_active
  ), conditional_rules as (
    select condition_row.*
    from public.field_conditional_rules condition_row
    join selected_leaf leaf_row
      on leaf_row.version_id = condition_row.version_id
     and leaf_row.node_id = condition_row.taxonomy_node_id
    where condition_row.is_active
  )
  select jsonb_build_object(
    'found', exists (select 1 from selected_leaf),
    'version', (
      select jsonb_build_object(
        'id', version_row.id,
        'number', version_row.version_number,
        'publishedAt', version_row.published_at
      )
      from published_version version_row
    ),
    'leaf', (
      select jsonb_build_object(
        'id', leaf_row.node_id,
        'parentId', leaf_row.parent_node_id,
        'slug', leaf_row.slug,
        'nameAr', leaf_row.name_ar,
        'nameEn', leaf_row.name_en,
        'descriptionAr', leaf_row.description_ar,
        'descriptionEn', leaf_row.description_en,
        'iconKey', leaf_row.icon_key,
        'filterSchemaKey', leaf_row.filter_schema_key,
        'displaySchemaKey', leaf_row.display_schema_key,
        'classificationKey', leaf_row.classification_key,
        'classificationValue', leaf_row.classification_value
      )
      from selected_leaf leaf_row
    ),
    'fields', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', field_row.field_key,
            'groupKey', field_row.group_key,
            'sortOrder', field_row.sort_order,
            'required', field_row.is_required,
            'searchable', field_row.is_searchable,
            'filterable', field_row.is_filterable,
            'displayable', field_row.is_displayable,
            'displaySurfaces', field_row.display_surfaces,
            'labelAr', field_row.label_ar,
            'labelEn', field_row.label_en,
            'descriptionAr', field_row.description_ar,
            'descriptionEn', field_row.description_en,
            'placeholderAr', field_row.placeholder_ar,
            'placeholderEn', field_row.placeholder_en,
            'fieldType', field_row.field_type,
            'unitKey', field_row.unit_key,
            'optionSetKey', field_row.option_set_key,
            'dataProviderKey', field_row.data_provider_key,
            'validation', field_row.validation_schema || field_row.validation_override,
            'defaultValue', field_row.default_value,
            'sensitive', field_row.is_sensitive,
            'options', case
              when field_row.option_set_key is null then '[]'::jsonb
              else coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'key', option_row.value_key,
                      'labelAr', option_row.label_ar,
                      'labelEn', option_row.label_en,
                      'aliases', option_row.aliases,
                      'sortOrder', option_row.sort_order,
                      'metadata', option_row.metadata
                    )
                    order by option_row.sort_order, option_row.value_key
                  )
                  from public.option_values option_row
                  where option_row.option_set_key = field_row.option_set_key
                    and option_row.is_active
                ),
                '[]'::jsonb
              )
            end
          )
          order by field_row.sort_order, field_row.field_key
        )
        from leaf_fields field_row
      ),
      '[]'::jsonb
    ),
    'conditionalRules', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', condition_row.id,
            'triggerFieldKey', condition_row.trigger_field_key,
            'operator', condition_row.operator,
            'triggerValue', condition_row.trigger_value,
            'targetFieldKey', condition_row.target_field_key,
            'effect', condition_row.effect,
            'priority', condition_row.priority
          )
          order by condition_row.priority, condition_row.id
        )
        from conditional_rules condition_row
      ),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.rawaj_fetch_vehicle_makes_v1(
  p_query text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with input as (
    select
      lower(btrim(coalesce(p_query, ''))) as query_text,
      greatest(1, least(coalesce(p_limit, 100), 200)) as result_limit
  ), matched as (
    select make_row.*
    from public.vehicle_makes make_row
    cross join input input_row
    where make_row.is_active
      and (
        input_row.query_text = ''
        or lower(make_row.name_ar) like '%' || input_row.query_text || '%'
        or lower(make_row.name_en) like '%' || input_row.query_text || '%'
        or exists (
          select 1
          from unnest(make_row.aliases) alias_row(alias_value)
          where lower(alias_row.alias_value) like '%' || input_row.query_text || '%'
        )
      )
    order by make_row.sort_order, make_row.name_en, make_row.id
    limit (select result_limit from input)
  )
  select jsonb_build_object(
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', make_row.id,
          'slug', make_row.slug,
          'nameAr', make_row.name_ar,
          'nameEn', make_row.name_en,
          'aliases', make_row.aliases,
          'countryCode', make_row.country_code,
          'sortOrder', make_row.sort_order
        )
        order by make_row.sort_order, make_row.name_en, make_row.id
      ),
      '[]'::jsonb
    )
  )
  from matched make_row;
$$;

create or replace function public.rawaj_fetch_vehicle_models_v1(
  p_make_id text,
  p_query text default null,
  p_year integer default null,
  p_limit integer default 200
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with input as (
    select
      nullif(btrim(p_make_id), '') as make_id,
      lower(btrim(coalesce(p_query, ''))) as query_text,
      p_year as model_year,
      greatest(1, least(coalesce(p_limit, 200), 300)) as result_limit
  ), matched as (
    select model_row.*
    from public.vehicle_models model_row
    join public.vehicle_makes make_row
      on make_row.id = model_row.make_id
     and make_row.is_active
    cross join input input_row
    where model_row.is_active
      and model_row.make_id = input_row.make_id
      and (
        input_row.model_year is null
        or (
          (model_row.start_year is null or model_row.start_year <= input_row.model_year)
          and (model_row.end_year is null or model_row.end_year >= input_row.model_year)
        )
      )
      and (
        input_row.query_text = ''
        or lower(model_row.name_ar) like '%' || input_row.query_text || '%'
        or lower(model_row.name_en) like '%' || input_row.query_text || '%'
        or exists (
          select 1
          from unnest(model_row.aliases) alias_row(alias_value)
          where lower(alias_row.alias_value) like '%' || input_row.query_text || '%'
        )
      )
    order by model_row.sort_order, model_row.name_en, model_row.id
    limit (select result_limit from input)
  )
  select jsonb_build_object(
    'makeId', nullif(btrim(p_make_id), ''),
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', model_row.id,
          'makeId', model_row.make_id,
          'slug', model_row.slug,
          'nameAr', model_row.name_ar,
          'nameEn', model_row.name_en,
          'aliases', model_row.aliases,
          'vehicleType', model_row.vehicle_type,
          'startYear', model_row.start_year,
          'endYear', model_row.end_year,
          'sortOrder', model_row.sort_order
        )
        order by model_row.sort_order, model_row.name_en, model_row.id
      ),
      '[]'::jsonb
    )
  )
  from matched model_row;
$$;

create or replace function public.rawaj_fetch_vehicle_model_children_v1(
  p_model_id text,
  p_year integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with selected_model as (
    select model_row.id, model_row.make_id, model_row.name_ar, model_row.name_en
    from public.vehicle_models model_row
    join public.vehicle_makes make_row
      on make_row.id = model_row.make_id
     and make_row.is_active
    where model_row.id = nullif(btrim(p_model_id), '')
      and model_row.is_active
    limit 1
  )
  select jsonb_build_object(
    'found', exists (select 1 from selected_model),
    'model', (
      select jsonb_build_object(
        'id', model_row.id,
        'makeId', model_row.make_id,
        'nameAr', model_row.name_ar,
        'nameEn', model_row.name_en
      )
      from selected_model model_row
    ),
    'generations', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', generation_row.id,
            'modelId', generation_row.model_id,
            'nameAr', generation_row.name_ar,
            'nameEn', generation_row.name_en,
            'startYear', generation_row.start_year,
            'endYear', generation_row.end_year,
            'sortOrder', generation_row.sort_order
          )
          order by generation_row.sort_order, generation_row.start_year, generation_row.id
        )
        from public.vehicle_generations generation_row
        join selected_model model_row
          on model_row.id = generation_row.model_id
        where generation_row.is_active
          and (
            p_year is null
            or (
              (generation_row.start_year is null or generation_row.start_year <= p_year)
              and (generation_row.end_year is null or generation_row.end_year >= p_year)
            )
          )
      ),
      '[]'::jsonb
    ),
    'trims', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', trim_row.id,
            'modelId', trim_row.model_id,
            'generationId', trim_row.generation_id,
            'nameAr', trim_row.name_ar,
            'nameEn', trim_row.name_en,
            'startYear', trim_row.start_year,
            'endYear', trim_row.end_year,
            'sortOrder', trim_row.sort_order
          )
          order by trim_row.sort_order, trim_row.start_year, trim_row.id
        )
        from public.vehicle_trims trim_row
        join selected_model model_row
          on model_row.id = trim_row.model_id
        where trim_row.is_active
          and (
            p_year is null
            or (
              (trim_row.start_year is null or trim_row.start_year <= p_year)
              and (trim_row.end_year is null or trim_row.end_year >= p_year)
            )
          )
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.rawaj_fetch_published_taxonomy_v1()
  from public;
revoke all on function public.rawaj_fetch_published_leaf_schema_v1(text)
  from public;
revoke all on function public.rawaj_fetch_vehicle_makes_v1(text, integer)
  from public;
revoke all on function public.rawaj_fetch_vehicle_models_v1(text, text, integer, integer)
  from public;
revoke all on function public.rawaj_fetch_vehicle_model_children_v1(text, integer)
  from public;

grant execute on function public.rawaj_fetch_published_taxonomy_v1()
  to anon, authenticated;
grant execute on function public.rawaj_fetch_published_leaf_schema_v1(text)
  to anon, authenticated;
grant execute on function public.rawaj_fetch_vehicle_makes_v1(text, integer)
  to anon, authenticated;
grant execute on function public.rawaj_fetch_vehicle_models_v1(text, text, integer, integer)
  to anon, authenticated;
grant execute on function public.rawaj_fetch_vehicle_model_children_v1(text, integer)
  to anon, authenticated;

comment on function public.rawaj_fetch_published_taxonomy_v1() is
  'Stable public DTO for the single published active RAWAJ taxonomy tree; draft versions are never returned.';
comment on function public.rawaj_fetch_published_leaf_schema_v1(text) is
  'Stable public DTO for an active Leaf field schema, options, validation, and conditional rules in the published taxonomy.';
comment on function public.rawaj_fetch_vehicle_makes_v1(text, integer) is
  'Bounded public vehicle make lookup with Arabic, English, and alias matching.';
comment on function public.rawaj_fetch_vehicle_models_v1(text, text, integer, integer) is
  'Bounded public dependent vehicle model lookup filtered by active make, optional query, and optional model year.';
comment on function public.rawaj_fetch_vehicle_model_children_v1(text, integer) is
  'Public active generation and trim metadata for a controlled vehicle model and optional model year.';

notify pgrst, 'reload schema';
