-- RAWAJ canonical Syria location bridge.
-- Does not alter taxonomy structure. It only backfills compatibility metadata used by listing writes.

with recursive ancestry as (
  select
    n.id as origin_id,
    n.id as current_id,
    n.parent_id,
    n.node_type,
    n.name_ar,
    n.name_en,
    n.slug,
    0 as depth
  from public.location_nodes n
  where n.country_code = 'SY'

  union all

  select
    a.origin_id,
    p.id,
    p.parent_id,
    p.node_type,
    p.name_ar,
    p.name_en,
    p.slug,
    a.depth + 1
  from ancestry a
  join public.location_nodes p on p.id = a.parent_id
  where a.depth < 16
), governorate_ancestor as (
  select distinct on (origin_id)
    origin_id,
    name_ar,
    name_en,
    slug
  from ancestry
  where node_type = 'governorate'
  order by origin_id, depth asc
), mapped as (
  select
    ga.origin_id,
    coalesce(
      g_exact.id,
      case
        when ga.name_ar = 'دمشق' then 'damascus'
        when ga.name_ar in ('ريف دمشق', 'ريف-دمشق') then 'rif-dimashq'
        when ga.name_ar = 'حلب' then 'aleppo'
        when ga.name_ar = 'حمص' then 'homs'
        when ga.name_ar in ('حماة', 'حماه') then 'hama'
        when ga.name_ar in ('اللاذقية', 'اللاذقيه') then 'latakia'
        when ga.name_ar = 'طرطوس' then 'tartus'
        when ga.name_ar in ('إدلب', 'ادلب') then 'idlib'
        when ga.name_ar = 'دير الزور' then 'deir-ez-zor'
        when ga.name_ar in ('الرقة', 'الرقه') then 'raqqa'
        when ga.name_ar in ('الحسكة', 'الحسكه') then 'hasakah'
        when ga.name_ar in ('درعا', 'درعا') then 'daraa'
        when ga.name_ar in ('السويداء', 'سويداء') then 'suwayda'
        when ga.name_ar in ('القنيطرة', 'القنيطره') then 'quneitra'
        else null
      end
    ) as governorate_id
  from governorate_ancestor ga
  left join lateral (
    select g.id
    from public.governorates g
    where g.is_active = true
      and (
        lower(g.slug) = lower(coalesce(ga.slug, ''))
        or g.name_ar = ga.name_ar
        or lower(coalesce(g.name_en, '')) = lower(coalesce(ga.name_en, ''))
      )
    limit 1
  ) g_exact on true
)
update public.location_nodes n
set legacy_governorate_id = m.governorate_id
from mapped m
where n.id = m.origin_id
  and m.governorate_id is not null
  and n.legacy_governorate_id is distinct from m.governorate_id;

-- Keep a human-readable fallback label for canonical nodes that previously had no legacy district label.
update public.location_nodes n
set legacy_district_ar = n.name_ar
where n.country_code = 'SY'
  and n.node_type not in ('country', 'governorate')
  and n.legacy_district_ar is null
  and nullif(btrim(n.name_ar), '') is not null;

comment on column public.location_nodes.legacy_governorate_id is
  'Compatibility bridge from canonical location nodes to marketplace governorates; taxonomy structure remains canonical.';
