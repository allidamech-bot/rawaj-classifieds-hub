-- RAWAJ unified Syria location taxonomy installer.
-- Idempotent recovery/install script for partial or fresh environments.
-- Run this file alone instead of 001..006 when SQL Editor state is uncertain.

begin;

create extension if not exists pgcrypto;

-- Core table.
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
  legacy_governorate_id text,
  legacy_district_ar text,
  source_url text,
  source_date date,
  confidence text,
  review_status text not null default 'unreviewed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_nodes_not_self_parent check (parent_id is null or parent_id <> id),
  constraint location_nodes_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint location_nodes_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint location_nodes_name_en_length check (name_en is null or char_length(name_en) <= 200)
);

-- Recover a partially-created schema that used uuid for legacy governorate ids.
do $$
declare
  actual_type text;
  fk_name text;
begin
  if to_regclass('public.location_nodes') is not null then
    select data_type into actual_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'location_nodes'
      and column_name = 'legacy_governorate_id';

    if actual_type = 'uuid' then
      for fk_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'location_nodes'
          and c.contype = 'f'
      loop
        if fk_name like '%legacy_governorate_id%' then
          execute format('alter table public.location_nodes drop constraint if exists %I', fk_name);
        end if;
      end loop;

      alter table public.location_nodes
        alter column legacy_governorate_id type text
        using legacy_governorate_id::text;
    end if;
  end if;
end;
$$;

-- Add columns if an older partial table exists.
alter table public.location_nodes
  add column if not exists source_url text,
  add column if not exists source_date date,
  add column if not exists confidence text,
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists notes text;

-- Ensure legacy governorate FK matches RAWAJ text ids.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'location_nodes'
      and c.conname = 'location_nodes_legacy_governorate_id_fkey'
  ) then
    alter table public.location_nodes
      add constraint location_nodes_legacy_governorate_id_fkey
      foreign key (legacy_governorate_id)
      references public.governorates(id)
      on delete set null;
  end if;
end;
$$;

alter table public.location_nodes
  drop constraint if exists location_nodes_confidence_check;
alter table public.location_nodes
  add constraint location_nodes_confidence_check
  check (confidence is null or confidence in ('low','medium','high'));

alter table public.location_nodes
  drop constraint if exists location_nodes_review_status_check;
alter table public.location_nodes
  add constraint location_nodes_review_status_check
  check (review_status in ('unreviewed','needs_review','reviewed','rejected'));

create unique index if not exists location_nodes_country_parent_slug_uidx
  on public.location_nodes(country_code, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

drop index if exists public.location_nodes_source_external_uidx;
create unique index location_nodes_source_external_uidx
  on public.location_nodes(external_source, external_id);

create index if not exists location_nodes_parent_idx on public.location_nodes(parent_id);
create index if not exists location_nodes_country_active_sort_idx
  on public.location_nodes(country_code, is_active, sort_order, name_ar);
create index if not exists location_nodes_legacy_governorate_idx
  on public.location_nodes(legacy_governorate_id);
create index if not exists location_nodes_legacy_district_idx
  on public.location_nodes(legacy_district_ar);
create index if not exists location_nodes_official_code_idx
  on public.location_nodes(official_code);
create index if not exists location_nodes_aliases_gin_idx
  on public.location_nodes using gin(search_aliases);
create index if not exists location_nodes_review_status_idx
  on public.location_nodes(review_status, is_active);

-- Listings compatibility.
alter table public.listings
  add column if not exists location_node_id uuid references public.location_nodes(id) on delete set null;
create index if not exists listings_location_node_id_idx on public.listings(location_node_id);

-- Core triggers/functions.
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
  if new.parent_id is null then return new; end if;
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

create or replace function public.rawaj_refresh_location_subtree_depths()
returns trigger
language plpgsql
as $$
begin
  if old.parent_id is not distinct from new.parent_id then return new; end if;
  with recursive subtree as (
    select child.id, new.depth + 1 as calculated_depth
    from public.location_nodes child
    where child.parent_id = new.id
    union all
    select child.id, subtree.calculated_depth + 1
    from public.location_nodes child
    join subtree on child.parent_id = subtree.id
  )
  update public.location_nodes target
  set depth = subtree.calculated_depth
  from subtree
  where target.id = subtree.id
    and target.depth is distinct from subtree.calculated_depth;
  return new;
end;
$$;

drop trigger if exists rawaj_refresh_location_subtree_depths on public.location_nodes;
create trigger rawaj_refresh_location_subtree_depths
after update of parent_id on public.location_nodes
for each row execute function public.rawaj_refresh_location_subtree_depths();

create or replace function public.rawaj_inherit_location_legacy_governorate()
returns trigger
language plpgsql
as $$
declare
  inherited_governorate text;
begin
  if new.parent_id is null then return new; end if;
  if tg_op = 'UPDATE'
     and new.legacy_governorate_id is distinct from old.legacy_governorate_id then
    return new;
  end if;
  select legacy_governorate_id into inherited_governorate
  from public.location_nodes where id = new.parent_id;
  new.legacy_governorate_id = inherited_governorate;
  return new;
end;
$$;

drop trigger if exists rawaj_inherit_location_legacy_governorate on public.location_nodes;
create trigger rawaj_inherit_location_legacy_governorate
before insert or update of parent_id, legacy_governorate_id on public.location_nodes
for each row execute function public.rawaj_inherit_location_legacy_governorate();

-- Public hierarchy RPCs.
create or replace function public.rawaj_location_descendant_ids(root_id uuid)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select n.id from public.location_nodes n
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
returns table(id uuid, parent_id uuid, node_type text, name_ar text, name_en text, slug text, depth integer)
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

create or replace function public.rawaj_location_option_paths(country text default 'SY')
returns table(id uuid, legacy_governorate_id text, label_ar text, node_type text, depth integer, is_leaf boolean)
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select n.id, n.parent_id, n.legacy_governorate_id, n.name_ar, n.node_type, n.depth,
           array[n.name_ar]::text[] as path_names,
           array[n.node_type]::text[] as path_types
    from public.location_nodes n
    where n.country_code = country and n.is_active = true and n.parent_id is null
    union all
    select child.id, child.parent_id,
           coalesce(child.legacy_governorate_id, tree.legacy_governorate_id),
           child.name_ar, child.node_type, child.depth,
           tree.path_names || child.name_ar,
           tree.path_types || child.node_type
    from public.location_nodes child
    join tree on child.parent_id = tree.id
    where child.is_active = true and child.country_code = country
  )
  select tree.id,
         tree.legacy_governorate_id,
         array_to_string(array(
           select path_name
           from unnest(tree.path_names, tree.path_types) as p(path_name, path_type)
           where p.path_type not in ('country','governorate')
         ), ' › ') as label_ar,
         tree.node_type,
         tree.depth,
         not exists (
           select 1 from public.location_nodes child
           where child.parent_id = tree.id and child.is_active = true
         ) as is_leaf
  from tree
  where tree.legacy_governorate_id is not null
    and tree.node_type not in ('country','governorate')
  order by tree.legacy_governorate_id, tree.depth, tree.path_names;
$$;

-- Remove obsolete uuid signature if a previous partial attempt created it.
drop function if exists public.rawaj_resolve_location_option(uuid, text);

create or replace function public.rawaj_resolve_location_option(
  legacy_governorate text,
  option_label text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_label text := btrim(option_label);
  resolved_id uuid;
  candidate_count integer;
begin
  if legacy_governorate is null or normalized_label = '' then return null; end if;

  select option_paths.id into resolved_id
  from public.rawaj_location_option_paths('SY') option_paths
  where option_paths.legacy_governorate_id = legacy_governorate
    and option_paths.label_ar = normalized_label
  limit 1;

  if resolved_id is not null then return resolved_id; end if;

  select count(*), min(n.id)
  into candidate_count, resolved_id
  from public.location_nodes n
  where n.is_active = true
    and n.legacy_governorate_id = legacy_governorate
    and btrim(n.name_ar) = normalized_label
    and n.node_type not in ('country','governorate');

  if candidate_count = 1 then return resolved_id; end if;
  return null;
end;
$$;

create or replace function public.rawaj_sync_listing_location_node()
returns trigger
language plpgsql
as $$
declare
  resolved_id uuid;
begin
  if tg_op = 'INSERT' and new.location_node_id is not null then return new; end if;
  if tg_op = 'UPDATE'
     and new.location_node_id is distinct from old.location_node_id then return new; end if;
  if new.governorate_id is null or new.district_ar is null or btrim(new.district_ar) = '' then
    new.location_node_id = null;
    return new;
  end if;
  resolved_id := public.rawaj_resolve_location_option(new.governorate_id, new.district_ar);
  new.location_node_id = resolved_id;
  return new;
end;
$$;

drop trigger if exists rawaj_sync_listing_location_node on public.listings;
create trigger rawaj_sync_listing_location_node
before insert or update of governorate_id, district_ar, location_node_id on public.listings
for each row execute function public.rawaj_sync_listing_location_node();

create or replace function public.rawaj_backfill_listing_location_nodes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.rawaj_is_owner_or_admin() then
    raise exception 'Owner or admin role required.';
  end if;
  update public.listings l
  set location_node_id = public.rawaj_resolve_location_option(l.governorate_id, l.district_ar)
  where l.location_node_id is null
    and l.governorate_id is not null
    and l.district_ar is not null
    and btrim(l.district_ar) <> ''
    and public.rawaj_resolve_location_option(l.governorate_id, l.district_ar) is not null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Search aliases and non-administrative regions.
create table if not exists public.location_search_aliases (
  id uuid primary key default gen_random_uuid(),
  location_node_id uuid not null references public.location_nodes(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language_code text,
  alias_type text not null default 'alternate_name'
    check (alias_type in ('alternate_name','spelling','transliteration','local_name','historic_name')),
  source_name text,
  source_url text,
  source_note text,
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high')),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','needs_review','reviewed','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.location_regions (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'SY',
  slug text not null,
  name_ar text not null,
  name_en text,
  region_type text not null default 'vernacular'
    check (region_type in ('vernacular','marketplace','historic','geographic')),
  is_complete boolean not null default false,
  is_active boolean not null default true,
  source_name text,
  source_url text,
  source_note text,
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high')),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','needs_review','reviewed','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country_code, slug)
);

create table if not exists public.location_region_members (
  region_id uuid not null references public.location_regions(id) on delete cascade,
  location_node_id uuid not null references public.location_nodes(id) on delete cascade,
  relation_type text not null default 'member'
    check (relation_type in ('member','associated','core','partial')),
  source_name text,
  source_url text,
  source_note text,
  confidence text not null default 'medium'
    check (confidence in ('low','medium','high')),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','needs_review','reviewed','rejected')),
  created_at timestamptz not null default now(),
  primary key(region_id, location_node_id)
);

create unique index if not exists location_search_aliases_node_normalized_uidx
  on public.location_search_aliases(location_node_id, normalized_alias);
create index if not exists location_search_aliases_normalized_idx
  on public.location_search_aliases(normalized_alias);
create index if not exists location_search_aliases_review_idx
  on public.location_search_aliases(review_status, confidence);
create index if not exists location_region_members_node_idx
  on public.location_region_members(location_node_id);
create index if not exists location_regions_active_idx
  on public.location_regions(country_code, is_active, review_status);

create or replace function public.rawaj_normalize_location_alias(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(lower(btrim(coalesce(value, ''))), 'أإآىة', 'ااايه'),
    '[[:space:]]+', ' ', 'g'
  );
$$;

create or replace function public.rawaj_set_location_alias_normalized()
returns trigger
language plpgsql
as $$
begin
  new.normalized_alias = public.rawaj_normalize_location_alias(new.alias);
  return new;
end;
$$;

drop trigger if exists rawaj_set_location_alias_normalized on public.location_search_aliases;
create trigger rawaj_set_location_alias_normalized
before insert or update of alias on public.location_search_aliases
for each row execute function public.rawaj_set_location_alias_normalized();

create or replace function public.rawaj_resolve_location_alias(alias_value text)
returns table(location_node_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct a.location_node_id
  from public.location_search_aliases a
  join public.location_nodes n on n.id = a.location_node_id
  where a.review_status = 'reviewed'
    and n.is_active = true
    and a.normalized_alias = public.rawaj_normalize_location_alias(alias_value);
$$;

create or replace function public.rawaj_region_member_location_ids(region_slug text)
returns table(location_node_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select rm.location_node_id
  from public.location_regions r
  join public.location_region_members rm on rm.region_id = r.id
  where r.slug = region_slug
    and r.is_active = true
    and r.is_complete = true
    and r.review_status = 'reviewed'
    and rm.review_status = 'reviewed';
$$;

-- RLS.
alter table public.location_nodes enable row level security;
alter table public.location_search_aliases enable row level security;
alter table public.location_regions enable row level security;
alter table public.location_region_members enable row level security;

drop policy if exists location_nodes_public_read_active on public.location_nodes;
create policy location_nodes_public_read_active
on public.location_nodes for select to anon, authenticated
using (is_active = true);

drop policy if exists location_nodes_admin_insert on public.location_nodes;
create policy location_nodes_admin_insert
on public.location_nodes for insert to authenticated
with check (public.rawaj_is_owner_or_admin());

drop policy if exists location_nodes_admin_update on public.location_nodes;
create policy location_nodes_admin_update
on public.location_nodes for update to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

drop policy if exists location_nodes_admin_delete on public.location_nodes;
create policy location_nodes_admin_delete
on public.location_nodes for delete to authenticated
using (public.rawaj_is_owner_or_admin());

drop policy if exists location_search_aliases_public_read_reviewed on public.location_search_aliases;
create policy location_search_aliases_public_read_reviewed
on public.location_search_aliases for select to anon, authenticated
using (review_status = 'reviewed');

drop policy if exists location_search_aliases_admin_all on public.location_search_aliases;
create policy location_search_aliases_admin_all
on public.location_search_aliases for all to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

drop policy if exists location_regions_public_read_reviewed on public.location_regions;
create policy location_regions_public_read_reviewed
on public.location_regions for select to anon, authenticated
using (is_active = true and review_status = 'reviewed');

drop policy if exists location_regions_admin_all on public.location_regions;
create policy location_regions_admin_all
on public.location_regions for all to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

drop policy if exists location_region_members_public_read_reviewed on public.location_region_members;
create policy location_region_members_public_read_reviewed
on public.location_region_members for select to anon, authenticated
using (review_status = 'reviewed');

drop policy if exists location_region_members_admin_all on public.location_region_members;
create policy location_region_members_admin_all
on public.location_region_members for all to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

-- Execute grants only after every function exists.
revoke all on function public.rawaj_location_descendant_ids(uuid) from public;
revoke all on function public.rawaj_location_path(uuid) from public;
revoke all on function public.rawaj_location_option_paths(text) from public;
revoke all on function public.rawaj_resolve_location_option(text, text) from public;
revoke all on function public.rawaj_resolve_location_alias(text) from public;
revoke all on function public.rawaj_region_member_location_ids(text) from public;
revoke all on function public.rawaj_backfill_listing_location_nodes() from public;

grant execute on function public.rawaj_location_descendant_ids(uuid) to anon, authenticated;
grant execute on function public.rawaj_location_path(uuid) to anon, authenticated;
grant execute on function public.rawaj_location_option_paths(text) to anon, authenticated;
grant execute on function public.rawaj_resolve_location_option(text, text) to anon, authenticated;
grant execute on function public.rawaj_resolve_location_alias(text) to anon, authenticated;
grant execute on function public.rawaj_region_member_location_ids(text) to anon, authenticated;
grant execute on function public.rawaj_backfill_listing_location_nodes() to authenticated;

-- Seed country root + legacy governorate compatibility nodes.
insert into public.location_nodes (
  country_code, node_type, name_ar, name_en, slug, official_code,
  sort_order, depth, external_source, external_id
)
values ('SY','country','سوريا','Syria','syria','SY',0,0,'iso3166','SY')
on conflict (external_source, external_id) do nothing;

with country as (
  select id from public.location_nodes
  where external_source = 'iso3166' and external_id = 'SY'
  limit 1
)
insert into public.location_nodes (
  parent_id, country_code, node_type, name_ar, name_en, slug, sort_order,
  legacy_governorate_id, external_source, external_id
)
select
  country.id, 'SY', 'governorate', g.name_ar, null, g.slug, g.sort_order,
  g.id, 'rawaj-legacy-governorate', g.id::text
from public.governorates g
cross join country
where g.is_active = true
on conflict (external_source, external_id) do update
set name_ar = excluded.name_ar,
    slug = excluded.slug,
    sort_order = excluded.sort_order,
    legacy_governorate_id = excluded.legacy_governorate_id,
    is_active = true;

commit;
