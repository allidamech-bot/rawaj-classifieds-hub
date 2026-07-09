-- RAWAJ Production Location Coverage Audit
-- READ ONLY: this file performs SELECT statements only.
-- Purpose: diagnose parallel Syria roots, source-tree drift, unreachable nodes,
-- inactive locality gaps, and likely duplicates without changing Production data.

-- 1) Active Syria country roots and the number of active descendants under each root.
with recursive roots as (
  select
    id,
    name_ar,
    name_en,
    slug,
    external_source,
    external_id,
    official_code
  from public.location_nodes
  where country_code = 'SY'
    and parent_id is null
    and node_type = 'country'
    and is_active = true
), tree as (
  select r.id as root_id, r.id as node_id
  from roots r
  union all
  select t.root_id, child.id
  from tree t
  join public.location_nodes child on child.parent_id = t.node_id
  where child.is_active = true
)
select
  r.id as root_id,
  r.name_ar,
  r.name_en,
  r.slug,
  r.external_source,
  r.external_id,
  r.official_code,
  count(t.node_id) - 1 as active_descendant_count
from roots r
left join tree t on t.root_id = r.id
group by
  r.id,
  r.name_ar,
  r.name_en,
  r.slug,
  r.external_source,
  r.external_id,
  r.official_code
order by active_descendant_count desc, r.external_source nulls last, r.slug;

-- 2) Active node coverage by source and semantic type.
select
  coalesce(external_source, '(null)') as external_source,
  node_type,
  count(*) as active_node_count
from public.location_nodes
where country_code = 'SY'
  and is_active = true
group by coalesce(external_source, '(null)'), node_type
order by external_source, node_type;

-- 3) Nodes unreachable from the preferred selector root.
-- Preference mirrors the application contract:
-- OCHA/HDX -> ISO -> deterministic fallback.
with recursive preferred_root as (
  select id
  from public.location_nodes
  where country_code = 'SY'
    and parent_id is null
    and node_type = 'country'
    and is_active = true
  order by
    case external_source
      when 'ocha-hdx-cod-ab-syr' then 0
      when 'iso3166' then 1
      else 2
    end,
    name_ar,
    id
  limit 1
), reachable as (
  select id
  from preferred_root
  union all
  select child.id
  from reachable parent
  join public.location_nodes child on child.parent_id = parent.id
  where child.is_active = true
)
select
  coalesce(n.external_source, '(null)') as external_source,
  n.node_type,
  count(*) as unreachable_active_count
from public.location_nodes n
where n.country_code = 'SY'
  and n.is_active = true
  and not exists (select 1 from reachable r where r.id = n.id)
group by coalesce(n.external_source, '(null)'), n.node_type
order by unreachable_active_count desc, external_source, node_type;

-- 4) Detailed active roots that remain outside the preferred tree.
with preferred_root as (
  select id
  from public.location_nodes
  where country_code = 'SY'
    and parent_id is null
    and node_type = 'country'
    and is_active = true
  order by
    case external_source
      when 'ocha-hdx-cod-ab-syr' then 0
      when 'iso3166' then 1
      else 2
    end,
    name_ar,
    id
  limit 1
)
select
  n.id,
  n.name_ar,
  n.name_en,
  n.slug,
  n.external_source,
  n.external_id,
  n.official_code,
  n.created_at,
  n.updated_at
from public.location_nodes n
where n.country_code = 'SY'
  and n.parent_id is null
  and n.node_type = 'country'
  and n.is_active = true
  and n.id <> (select id from preferred_root)
order by n.external_source nulls last, n.slug;

-- 5) Inactive populated-place coverage by source and type.
select
  coalesce(external_source, '(null)') as external_source,
  node_type,
  count(*) as inactive_node_count
from public.location_nodes
where country_code = 'SY'
  and is_active = false
  and node_type in ('city', 'town', 'village', 'locality', 'neighborhood')
group by coalesce(external_source, '(null)'), node_type
order by inactive_node_count desc, external_source, node_type;

-- 6) Likely duplicate active siblings by normalized visible name.
-- This intentionally does not merge anything; it only surfaces candidates.
select
  parent_id,
  lower(btrim(name_ar)) as normalized_name_ar,
  count(*) as duplicate_count,
  array_agg(id order by id) as node_ids,
  array_agg(coalesce(external_source, '(null)') order by id) as sources,
  array_agg(node_type order by id) as node_types
from public.location_nodes
where country_code = 'SY'
  and is_active = true
group by parent_id, lower(btrim(name_ar))
having count(*) > 1
order by duplicate_count desc, normalized_name_ar;

-- 7) Same Arabic name appearing across multiple source systems.
-- Useful for spotting parallel OCHA/GeoNames/legacy records.
select
  lower(btrim(name_ar)) as normalized_name_ar,
  count(*) as active_node_count,
  count(distinct coalesce(external_source, '(null)')) as source_count,
  array_agg(distinct coalesce(external_source, '(null)')) as sources,
  array_agg(distinct node_type) as node_types
from public.location_nodes
where country_code = 'SY'
  and is_active = true
  and node_type in ('governorate', 'district', 'subdistrict', 'city', 'town', 'village', 'locality')
group by lower(btrim(name_ar))
having count(distinct coalesce(external_source, '(null)')) > 1
order by source_count desc, active_node_count desc, normalized_name_ar;

-- 8) Source-level totals for active populated places only.
select
  coalesce(external_source, '(null)') as external_source,
  count(*) filter (where node_type = 'city') as cities,
  count(*) filter (where node_type = 'town') as towns,
  count(*) filter (where node_type = 'village') as villages,
  count(*) filter (where node_type = 'locality') as localities,
  count(*) filter (where node_type = 'neighborhood') as neighborhoods,
  count(*) as total_populated_place_nodes
from public.location_nodes
where country_code = 'SY'
  and is_active = true
  and node_type in ('city', 'town', 'village', 'locality', 'neighborhood')
group by coalesce(external_source, '(null)')
order by total_populated_place_nodes desc, external_source;
