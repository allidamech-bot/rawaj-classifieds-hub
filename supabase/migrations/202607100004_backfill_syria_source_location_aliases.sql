-- Backfill source-provided OCHA/HDX alternate names into the public search index.
-- Additive and idempotent: no location nodes, hierarchy links, or listing references are changed.
-- Existing alias rows always win, including any manually reviewed or rejected decisions.

insert into public.location_search_aliases (
  location_node_id,
  alias,
  normalized_alias,
  language_code,
  alias_type,
  source_name,
  source_url,
  source_note,
  confidence,
  review_status
)
select
  node.id,
  source_alias.alias,
  public.rawaj_normalize_location_alias(source_alias.alias),
  case when source_alias.alias ~ '[ء-ي]' then 'ar' else 'en' end,
  'alternate_name',
  'OCHA/HDX COD-AB Syria',
  coalesce(
    node.source_url,
    'https://data.humdata.org/dataset/syrian-arab-republic-populated-places'
  ),
  'Source-provided alternate name from location_nodes.search_aliases for ' || node.external_id,
  'high',
  'reviewed'
from public.location_nodes as node
cross join lateral unnest(node.search_aliases) as source_alias(alias)
where node.external_source = 'ocha-hdx-cod-ab-syr'
  and node.is_active = true
  and btrim(source_alias.alias) <> ''
  and public.rawaj_normalize_location_alias(source_alias.alias) <> ''
  and public.rawaj_normalize_location_alias(source_alias.alias)
      <> public.rawaj_normalize_location_alias(node.name_ar)
  and (
    node.name_en is null
    or public.rawaj_normalize_location_alias(source_alias.alias)
       <> public.rawaj_normalize_location_alias(node.name_en)
  )
on conflict (location_node_id, normalized_alias) do nothing;
