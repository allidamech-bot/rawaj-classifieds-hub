-- Complete all non-real-estate taxonomy branches from the canonical legacy subcategory catalog.
-- Real estate keeps its purpose/type hierarchy introduced by the canonical taxonomy migration.

insert into public.taxonomy_nodes (
  id,
  parent_id,
  slug,
  name_ar,
  name_en,
  description_ar,
  description_en,
  icon_key,
  sort_order,
  depth,
  is_active,
  is_leaf,
  filter_schema_key,
  classification_key,
  classification_value,
  legacy_category_id,
  legacy_subcategory_id,
  updated_at
)
select
  subcategory.id,
  subcategory.category_id,
  subcategory.id,
  subcategory.name_ar,
  subcategory.name_en,
  null,
  null,
  root.icon_key,
  subcategory.sort_order,
  1,
  true,
  true,
  root.filter_schema_key,
  null,
  null,
  subcategory.category_id,
  subcategory.id,
  now()
from public.subcategories subcategory
join public.taxonomy_nodes root
  on root.id = subcategory.category_id
 and root.parent_id is null
where subcategory.category_id <> 'realestate'
on conflict (id) do update
set
  parent_id = excluded.parent_id,
  slug = excluded.slug,
  name_ar = excluded.name_ar,
  name_en = coalesce(excluded.name_en, public.taxonomy_nodes.name_en),
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  depth = 1,
  is_active = true,
  is_leaf = true,
  filter_schema_key = excluded.filter_schema_key,
  classification_key = null,
  classification_value = null,
  legacy_category_id = excluded.legacy_category_id,
  legacy_subcategory_id = excluded.legacy_subcategory_id,
  updated_at = now();

update public.taxonomy_nodes root
set
  is_active = true,
  is_leaf = false,
  depth = 0,
  updated_at = now()
where root.parent_id is null
  and exists (
    select 1
    from public.taxonomy_nodes child
    where child.parent_id = root.id
      and child.is_active = true
  );

do $$
declare
  broken_root record;
begin
  select root.id, root.name_ar
  into broken_root
  from public.taxonomy_nodes root
  where root.parent_id is null
    and root.is_active = true
    and not exists (
      with recursive descendants as (
        select child.id, child.parent_id, child.is_active, child.is_leaf
        from public.taxonomy_nodes child
        where child.parent_id = root.id

        union all

        select child.id, child.parent_id, child.is_active, child.is_leaf
        from public.taxonomy_nodes child
        join descendants parent on child.parent_id = parent.id
      )
      select 1
      from descendants
      where is_active = true
        and is_leaf = true
    )
  order by root.sort_order
  limit 1;

  if broken_root.id is not null then
    raise exception 'Active taxonomy root % (%) has no active leaf descendant',
      broken_root.id,
      broken_root.name_ar;
  end if;
end $$;
