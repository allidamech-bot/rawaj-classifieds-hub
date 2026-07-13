-- RAWAJ Phase 4: canonical listing taxonomy write path.
-- Source-controlled only. Review and apply explicitly in Supabase Production.
-- This migration preserves legacy category_id/subcategory_id columns and URLs.

create table if not exists public.listing_taxonomy_assignments (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  taxonomy_node_id text not null references public.taxonomy_nodes(id) on delete restrict,
  assignment_source text not null default 'legacy_derived'
    check (assignment_source in ('legacy_derived', 'explicit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listing_taxonomy_assignments_node_listing_idx
  on public.listing_taxonomy_assignments (taxonomy_node_id, listing_id);

create or replace function public.rawaj_resolve_legacy_taxonomy_node(
  p_category_id text,
  p_subcategory_id text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select node.id
  from public.taxonomy_nodes node
  where node.is_active = true
    and (
      (
        p_subcategory_id is not null
        and node.legacy_subcategory_id = p_subcategory_id
        and node.legacy_category_id = p_category_id
      )
      or (
        p_subcategory_id is null
        and node.legacy_subcategory_id is null
        and node.legacy_category_id = p_category_id
      )
    )
  order by
    case when p_subcategory_id is not null then node.depth else -node.depth end desc,
    node.sort_order asc,
    node.id asc
  limit 1;
$$;

create or replace function public.rawaj_sync_listing_taxonomy_from_legacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_node_id text;
begin
  resolved_node_id := public.rawaj_resolve_legacy_taxonomy_node(
    new.category_id,
    new.subcategory_id
  );

  if resolved_node_id is null and new.subcategory_id is not null then
    resolved_node_id := public.rawaj_resolve_legacy_taxonomy_node(new.category_id, null);
  end if;

  if resolved_node_id is null then
    delete from public.listing_taxonomy_assignments
    where listing_id = new.id
      and assignment_source = 'legacy_derived';
    return new;
  end if;

  insert into public.listing_taxonomy_assignments (
    listing_id,
    taxonomy_node_id,
    assignment_source,
    created_at,
    updated_at
  ) values (
    new.id,
    resolved_node_id,
    'legacy_derived',
    now(),
    now()
  )
  on conflict (listing_id) do update
  set taxonomy_node_id = excluded.taxonomy_node_id,
      assignment_source = 'legacy_derived',
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists listings_sync_taxonomy_from_legacy on public.listings;
create trigger listings_sync_taxonomy_from_legacy
after insert or update of category_id, subcategory_id on public.listings
for each row execute function public.rawaj_sync_listing_taxonomy_from_legacy();

insert into public.listing_taxonomy_assignments (
  listing_id,
  taxonomy_node_id,
  assignment_source,
  created_at,
  updated_at
)
select
  listing.id,
  coalesce(
    public.rawaj_resolve_legacy_taxonomy_node(listing.category_id, listing.subcategory_id),
    public.rawaj_resolve_legacy_taxonomy_node(listing.category_id, null)
  ),
  'legacy_derived',
  now(),
  now()
from public.listings listing
where coalesce(
  public.rawaj_resolve_legacy_taxonomy_node(listing.category_id, listing.subcategory_id),
  public.rawaj_resolve_legacy_taxonomy_node(listing.category_id, null)
) is not null
on conflict (listing_id) do nothing;

create or replace function public.rawaj_assign_listing_taxonomy(
  p_listing_id uuid,
  p_taxonomy_node_id text
)
returns table (
  listing_id uuid,
  taxonomy_node_id text,
  assignment_source text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing public.listings%rowtype;
  target_node public.taxonomy_nodes%rowtype;
  inherited_category_id text;
  inherited_subcategory_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into target_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;

  if target_listing.owner_id <> auth.uid() then
    raise exception 'Only the listing owner can assign taxonomy.' using errcode = '42501';
  end if;

  if target_listing.status not in ('draft', 'rejected') then
    raise exception 'Taxonomy can only be changed while the listing is editable.' using errcode = '42501';
  end if;

  select * into target_node
  from public.taxonomy_nodes
  where id = p_taxonomy_node_id
    and is_active = true;

  if not found then
    raise exception 'Taxonomy node not found or inactive.' using errcode = 'P0002';
  end if;

  if target_node.is_leaf is not true then
    raise exception 'Explicit listing taxonomy must select a leaf node.' using errcode = '22023';
  end if;

  with recursive lineage as (
    select node.id, node.parent_id, node.depth,
           node.legacy_category_id, node.legacy_subcategory_id
    from public.taxonomy_nodes node
    where node.id = p_taxonomy_node_id

    union all

    select parent.id, parent.parent_id, parent.depth,
           parent.legacy_category_id, parent.legacy_subcategory_id
    from public.taxonomy_nodes parent
    join lineage child on child.parent_id = parent.id
  )
  select
    (array_agg(legacy_category_id order by depth desc)
      filter (where legacy_category_id is not null))[1],
    (array_agg(legacy_subcategory_id order by depth desc)
      filter (where legacy_subcategory_id is not null))[1]
  into inherited_category_id, inherited_subcategory_id
  from lineage;

  if inherited_category_id is null then
    raise exception 'Taxonomy node has no legacy category compatibility mapping.' using errcode = '23514';
  end if;

  if target_listing.category_id is distinct from inherited_category_id then
    raise exception 'Taxonomy node does not match the listing category.' using errcode = '23514';
  end if;

  if inherited_subcategory_id is not null
     and target_listing.subcategory_id is distinct from inherited_subcategory_id then
    raise exception 'Taxonomy node does not match the listing subcategory.' using errcode = '23514';
  end if;

  insert into public.listing_taxonomy_assignments (
    listing_id,
    taxonomy_node_id,
    assignment_source,
    created_at,
    updated_at
  ) values (
    p_listing_id,
    p_taxonomy_node_id,
    'explicit',
    now(),
    now()
  )
  on conflict (listing_id) do update
  set taxonomy_node_id = excluded.taxonomy_node_id,
      assignment_source = 'explicit',
      updated_at = now();

  return query
  select assignment.listing_id,
         assignment.taxonomy_node_id,
         assignment.assignment_source,
         assignment.updated_at
  from public.listing_taxonomy_assignments assignment
  where assignment.listing_id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_assign_listing_taxonomy(uuid, text) from public;
grant execute on function public.rawaj_assign_listing_taxonomy(uuid, text) to authenticated;

alter table public.listing_taxonomy_assignments enable row level security;

drop policy if exists "Public reads taxonomy for public listings"
  on public.listing_taxonomy_assignments;
create policy "Public reads taxonomy for public listings"
on public.listing_taxonomy_assignments
for select
using (
  exists (
    select 1
    from public.listings listing
    where listing.id = listing_taxonomy_assignments.listing_id
      and listing.status = 'approved'
      and listing.archived_at is null
      and (listing.expires_at is null or listing.expires_at > now())
  )
);

drop policy if exists "Owners read their listing taxonomy"
  on public.listing_taxonomy_assignments;
create policy "Owners read their listing taxonomy"
on public.listing_taxonomy_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.listings listing
    where listing.id = listing_taxonomy_assignments.listing_id
      and listing.owner_id = auth.uid()
  )
);

drop policy if exists "Admin-like reads listing taxonomy"
  on public.listing_taxonomy_assignments;
create policy "Admin-like reads listing taxonomy"
on public.listing_taxonomy_assignments
for select
to authenticated
using (public.current_user_is_admin_like());

comment on table public.listing_taxonomy_assignments is
  'Canonical listing-to-taxonomy relation. Legacy category/subcategory columns remain for backward compatibility.';
comment on function public.rawaj_assign_listing_taxonomy(uuid, text) is
  'Assigns an explicit active leaf taxonomy node to an editable listing while validating legacy compatibility.';
