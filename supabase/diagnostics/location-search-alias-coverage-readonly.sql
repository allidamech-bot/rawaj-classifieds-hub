-- READ ONLY: audit OCHA/HDX source aliases and their searchable reviewed coverage.
-- This file performs no inserts, updates, deletes, DDL, or function calls that write data.

with source_aliases as (
  select
    node.id as location_node_id,
    node.external_id,
    node.node_type,
    node.name_ar,
    source_alias.alias,
    public.rawaj_normalize_location_alias(source_alias.alias) as normalized_alias
  from public.location_nodes as node
  cross join lateral unnest(node.search_aliases) as source_alias(alias)
  where node.external_source = 'ocha-hdx-cod-ab-syr'
    and node.is_active = true
    and btrim(source_alias.alias) <> ''
),
distinct_source_aliases as (
  select distinct
    location_node_id,
    external_id,
    node_type,
    name_ar,
    alias,
    normalized_alias
  from source_aliases
  where normalized_alias <> ''
),
coverage as (
  select
    source.location_node_id,
    source.external_id,
    source.node_type,
    source.name_ar,
    source.alias,
    source.normalized_alias,
    indexed.id is not null as is_indexed,
    indexed.review_status
  from distinct_source_aliases as source
  left join public.location_search_aliases as indexed
    on indexed.location_node_id = source.location_node_id
   and indexed.normalized_alias = source.normalized_alias
)
select
  count(*) as total_distinct_source_aliases,
  count(*) filter (where is_indexed) as indexed_aliases,
  count(*) filter (where review_status = 'reviewed') as publicly_searchable_aliases,
  count(*) filter (where not is_indexed) as missing_aliases,
  count(distinct location_node_id) as nodes_with_source_aliases
from coverage;

with source_aliases as (
  select
    node.id as location_node_id,
    node.external_id,
    node.node_type,
    node.name_ar,
    source_alias.alias,
    public.rawaj_normalize_location_alias(source_alias.alias) as normalized_alias
  from public.location_nodes as node
  cross join lateral unnest(node.search_aliases) as source_alias(alias)
  where node.external_source = 'ocha-hdx-cod-ab-syr'
    and node.is_active = true
    and btrim(source_alias.alias) <> ''
)
select
  source.external_id,
  source.node_type,
  source.name_ar,
  source.alias as missing_alias
from source_aliases as source
left join public.location_search_aliases as indexed
  on indexed.location_node_id = source.location_node_id
 and indexed.normalized_alias = source.normalized_alias
where source.normalized_alias <> ''
  and indexed.id is null
order by source.node_type, source.name_ar, source.alias
limit 100;
