-- RAWAJ hierarchical Syria location taxonomy foundation.
-- Manual-only migration: review before applying to live Supabase.
-- Non-destructive: legacy governorates/district_ar remain supported.

create extension if not exists pgcrypto;

create table if not exists public.location_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.location_nodes(id) on delete restrict,
  country_code text not null default 'SY' check (char_length(country_code) = 2),
  node_type text not null check (
    node_type in ('country','governorate','district','subdistrict','city','town','village','neighborhood','locality')
  ),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 200),
  name_en text,
  slug text not null,
  official_code text,
  external_source text,
  external_id text,
  latitude double precision,
  longitude double precision,
  sort_order integer not null default 0,
  depth integer not null default 0 check (depth >= 0),
  is_active boolean not null default true,
  search_aliases text[] not null default '{}',
  legacy_governorate_id text references public.governorates(id) on delete set null,
  legacy_district_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_nodes_not_self_parent check (parent_id is null or parent_id <> id),
  constraint location_nodes_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint location_nodes_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint location_nodes_name_en_length check (name_en is null or char_length(name_en) <= 200)
);

create unique index if not exists location_nodes_country_parent_slug_uidx
  on public.location_nodes(country_code, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

create unique index if not exists location_nodes_source_external_uidx
  on public.location_nodes(external_source, external_id)
  where external_source is not null and external_id is not null;

create index if not exists location_nodes_parent_idx on public.location_nodes(parent_id);
create index if not exists location_nodes_country_active_sort_idx
  on public.location_nodes(country_code, is_active, sort_order, name_ar);
create index if not exists location_nodes_legacy_governorate_idx on public.location_nodes(legacy_governorate_id);
create index if not exists location_nodes_legacy_district_idx on public.location_nodes(legacy_district_ar);
create index if not exists location_nodes_official_code_idx on public.location_nodes(official_code);
create index if not exists location_nodes_aliases_gin_idx on public.location_nodes using gin(search_aliases);

create or replace function public.rawaj_touch_location_node_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rawaj_touch_location_nodes_updated_at on public.location_nodes;
create trigger rawaj_touch_location_nodes_updated_at
before update on public.location_nodes
for each row execute function public.rawaj_touch_location_node_updated_at();

create or replace function public.rawaj_set_location_node_depth()
returns trigger
language plpgsql
as $$
declare
  parent_depth integer;
begin
  if new.parent_id is null then
    new.depth = 0;
    return new;
  end if;

  select depth into parent_depth from public.location_nodes where id = new.parent_id;
  if parent_depth is null then
    raise exception 'Location parent does not exist.';
  end if;
  new.depth = parent_depth + 1;
  return new;
end;
$$;

drop trigger if exists rawaj_set_location_node_depth on public.location_nodes;
create trigger rawaj_set_location_node_depth
before insert or update of parent_id on public.location_nodes
for each row execute function public.rawaj_set_location_node_depth();

create or replace function public.rawaj_prevent_location_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if exists (
    with recursive descendants as (
      select id from public.location_nodes where parent_id = new.id
      union all
      select child.id
      from public.location_nodes child
      join descendants d on child.parent_id = d.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'Location hierarchy cycle is not allowed.';
  end if;

  return new;
end;
$$;

drop trigger if exists rawaj_prevent_location_cycle on public.location_nodes;
create trigger rawaj_prevent_location_cycle
before update of parent_id on public.location_nodes
for each row execute function public.rawaj_prevent_location_cycle();

alter table public.listings
  add column if not exists location_node_id uuid references public.location_nodes(id) on delete set null;

create index if not exists listings_location_node_id_idx on public.listings(location_node_id);

create or replace function public.rawaj_location_descendant_ids(root_id uuid)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select n.id
    from public.location_nodes n
    where n.id = root_id and n.is_active = true
    union all
    select child.id
    from public.location_nodes child
    join tree parent on child.parent_id = parent.id
    where child.is_active = true
  )
  select tree.id from tree;
$$;

create or replace function public.rawaj_location_path(node_id uuid)
returns table(
  id uuid,
  parent_id uuid,
  node_type text,
  name_ar text,
  name_en text,
  slug text,
  depth integer
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive ancestors as (
    select n.id, n.parent_id, n.node_type, n.name_ar, n.name_en, n.slug, n.depth
    from public.location_nodes n
    where n.id = node_id and n.is_active = true
    union all
    select p.id, p.parent_id, p.node_type, p.name_ar, p.name_en, p.slug, p.depth
    from public.location_nodes p
    join ancestors a on a.parent_id = p.id
    where p.is_active = true
  )
  select * from ancestors order by depth asc;
$$;

revoke all on function public.rawaj_location_descendant_ids(uuid) from public;
revoke all on function public.rawaj_location_path(uuid) from public;
grant execute on function public.rawaj_location_descendant_ids(uuid) to anon, authenticated;
grant execute on function public.rawaj_location_path(uuid) to anon, authenticated;

alter table public.location_nodes enable row level security;

drop policy if exists location_nodes_public_read_active on public.location_nodes;
create policy location_nodes_public_read_active
on public.location_nodes
for select
to anon, authenticated
using (is_active = true);

drop policy if exists location_nodes_admin_insert on public.location_nodes;
create policy location_nodes_admin_insert
on public.location_nodes
for insert
to authenticated
with check (public.rawaj_is_owner_or_admin());

drop policy if exists location_nodes_admin_update on public.location_nodes;
create policy location_nodes_admin_update
on public.location_nodes
for update
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

drop policy if exists location_nodes_admin_delete on public.location_nodes;
create policy location_nodes_admin_delete
on public.location_nodes
for delete
to authenticated
using (public.rawaj_is_owner_or_admin());

insert into public.location_nodes (
  country_code, node_type, name_ar, name_en, slug, official_code, sort_order, depth, external_source, external_id
)
values ('SY','country','سوريا','Syria','syria','SY',0,0,'iso3166','SY')
on conflict (external_source, external_id) where external_source is not null and external_id is not null do nothing;

with country as (
  select id from public.location_nodes where external_source = 'iso3166' and external_id = 'SY' limit 1
)
insert into public.location_nodes (
  parent_id, country_code, node_type, name_ar, name_en, slug, sort_order,
  legacy_governorate_id, external_source, external_id
)
select
  country.id,
  'SY',
  'governorate',
  g.name_ar,
  null,
  g.slug,
  g.sort_order,
  g.id,
  'rawaj-legacy-governorate',
  g.id::text
from public.governorates g
cross join country
where g.is_active = true
on conflict (external_source, external_id) where external_source is not null and external_id is not null do update
set
  name_ar = excluded.name_ar,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  legacy_governorate_id = excluded.legacy_governorate_id,
  is_active = true;
