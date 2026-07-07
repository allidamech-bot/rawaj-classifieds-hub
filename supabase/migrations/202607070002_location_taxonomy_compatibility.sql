-- RAWAJ location taxonomy compatibility helpers.
-- Manual-only migration. Requires 202607070001_location_taxonomy_foundation.sql.

create or replace function public.rawaj_inherit_location_legacy_governorate()
returns trigger
language plpgsql
as $$
declare
  inherited_governorate text;
begin
  if new.legacy_governorate_id is not null or new.parent_id is null then
    return new;
  end if;

  select legacy_governorate_id
  into inherited_governorate
  from public.location_nodes
  where id = new.parent_id;

  if inherited_governorate is not null then
    new.legacy_governorate_id = inherited_governorate;
  end if;

  return new;
end;
$$;

drop trigger if exists rawaj_inherit_location_legacy_governorate on public.location_nodes;
create trigger rawaj_inherit_location_legacy_governorate
before insert or update of parent_id, legacy_governorate_id on public.location_nodes
for each row execute function public.rawaj_inherit_location_legacy_governorate();

with recursive mapped as (
  select id, parent_id, legacy_governorate_id
  from public.location_nodes
  where legacy_governorate_id is not null
  union all
  select child.id, child.parent_id, mapped.legacy_governorate_id
  from public.location_nodes child
  join mapped on child.parent_id = mapped.id
  where child.legacy_governorate_id is null
)
update public.location_nodes target
set legacy_governorate_id = mapped.legacy_governorate_id
from mapped
where target.id = mapped.id
  and target.legacy_governorate_id is null;

create or replace function public.rawaj_location_option_paths(country text default 'SY')
returns table(
  id uuid,
  legacy_governorate_id text,
  label_ar text,
  node_type text,
  depth integer,
  is_leaf boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select
      n.id,
      n.parent_id,
      n.legacy_governorate_id,
      n.name_ar,
      n.node_type,
      n.depth,
      array[n.name_ar]::text[] as path_names,
      array[n.node_type]::text[] as path_types
    from public.location_nodes n
    where n.country_code = country
      and n.is_active = true
      and n.parent_id is null

    union all

    select
      child.id,
      child.parent_id,
      coalesce(child.legacy_governorate_id, tree.legacy_governorate_id),
      child.name_ar,
      child.node_type,
      child.depth,
      tree.path_names || child.name_ar,
      tree.path_types || child.node_type
    from public.location_nodes child
    join tree on child.parent_id = tree.id
    where child.is_active = true
      and child.country_code = country
  )
  select
    tree.id,
    tree.legacy_governorate_id,
    array_to_string(
      array(
        select path_name
        from unnest(tree.path_names, tree.path_types) as p(path_name, path_type)
        where p.path_type not in ('country', 'governorate')
      ),
      ' › '
    ) as label_ar,
    tree.node_type,
    tree.depth,
    not exists (
      select 1 from public.location_nodes child
      where child.parent_id = tree.id and child.is_active = true
    ) as is_leaf
  from tree
  where tree.legacy_governorate_id is not null
    and tree.node_type not in ('country', 'governorate')
  order by tree.legacy_governorate_id, tree.depth, tree.path_names;
$$;

revoke all on function public.rawaj_location_option_paths(text) from public;
grant execute on function public.rawaj_location_option_paths(text) to anon, authenticated;

create or replace function public.rawaj_resolve_location_option(
  legacy_governorate text,
  option_label text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select option_paths.id
  from public.rawaj_location_option_paths('SY') option_paths
  where option_paths.legacy_governorate_id = legacy_governorate
    and option_paths.label_ar = btrim(option_label)
  limit 1;
$$;

revoke all on function public.rawaj_resolve_location_option(text, text) from public;
grant execute on function public.rawaj_resolve_location_option(text, text) to anon, authenticated;

create or replace function public.rawaj_sync_listing_location_node()
returns trigger
language plpgsql
as $$
declare
  resolved_id uuid;
begin
  if new.location_node_id is not null then
    return new;
  end if;

  if new.governorate_id is null or new.district_ar is null or btrim(new.district_ar) = '' then
    return new;
  end if;

  resolved_id := public.rawaj_resolve_location_option(new.governorate_id, new.district_ar);
  if resolved_id is not null then
    new.location_node_id = resolved_id;
  end if;

  return new;
end;
$$;

drop trigger if exists rawaj_sync_listing_location_node on public.listings;
create trigger rawaj_sync_listing_location_node
before insert or update of governorate_id, district_ar, location_node_id on public.listings
for each row execute function public.rawaj_sync_listing_location_node();
