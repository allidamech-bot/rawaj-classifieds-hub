-- RAWAJ location search aliases and non-administrative regional groups.
-- Manual-only migration. Requires the location taxonomy foundation migrations.

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

create unique index if not exists location_search_aliases_node_normalized_uidx
  on public.location_search_aliases(location_node_id, normalized_alias);
create index if not exists location_search_aliases_normalized_idx
  on public.location_search_aliases(normalized_alias);
create index if not exists location_search_aliases_review_idx
  on public.location_search_aliases(review_status, confidence);

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
    translate(
      lower(btrim(coalesce(value, ''))),
      'أإآىة',
      'ااايه'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  );
$$;

create or replace function public.rawaj_touch_location_search_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rawaj_touch_location_search_aliases on public.location_search_aliases;
create trigger rawaj_touch_location_search_aliases
before update on public.location_search_aliases
for each row execute function public.rawaj_touch_location_search_updated_at();

drop trigger if exists rawaj_touch_location_regions on public.location_regions;
create trigger rawaj_touch_location_regions
before update on public.location_regions
for each row execute function public.rawaj_touch_location_search_updated_at();

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

alter table public.location_search_aliases enable row level security;
alter table public.location_regions enable row level security;
alter table public.location_region_members enable row level security;

drop policy if exists location_search_aliases_public_read_reviewed on public.location_search_aliases;
create policy location_search_aliases_public_read_reviewed
on public.location_search_aliases
for select
to anon, authenticated
using (review_status = 'reviewed');

drop policy if exists location_regions_public_read_reviewed on public.location_regions;
create policy location_regions_public_read_reviewed
on public.location_regions
for select
to anon, authenticated
using (is_active = true and review_status = 'reviewed');

drop policy if exists location_region_members_public_read_reviewed on public.location_region_members;
create policy location_region_members_public_read_reviewed
on public.location_region_members
for select
to anon, authenticated
using (review_status = 'reviewed');

-- Admin/owner writes only.
create policy location_search_aliases_admin_all
on public.location_search_aliases
for all
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

create policy location_regions_admin_all
on public.location_regions
for all
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

create policy location_region_members_admin_all
on public.location_region_members
for all
to authenticated
using (public.rawaj_is_owner_or_admin())
with check (public.rawaj_is_owner_or_admin());

-- Resolve reviewed aliases to canonical nodes. Exact normalized alias only.
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

-- Region filtering is exposed only for complete, reviewed regions.
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

revoke all on function public.rawaj_resolve_location_alias(text) from public;
revoke all on function public.rawaj_region_member_location_ids(text) from public;
grant execute on function public.rawaj_resolve_location_alias(text) to anon, authenticated;
grant execute on function public.rawaj_region_member_location_ids(text) to anon, authenticated;
