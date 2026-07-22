-- Repair explicit listing taxonomy assignment under PL/pgSQL RETURNS TABLE semantics.
-- The output column listing_id is a PL/pgSQL variable, so ON CONFLICT (listing_id)
-- is ambiguous unless the conflict target is identified by its constraint name.

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

  select listing.*
    into target_listing
  from public.listings listing
  where listing.id = p_listing_id
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

  select node.*
    into target_node
  from public.taxonomy_nodes node
  where node.id = p_taxonomy_node_id
    and node.is_active = true;

  if not found then
    raise exception 'Taxonomy node not found or inactive.' using errcode = 'P0002';
  end if;

  if target_node.is_leaf is not true then
    raise exception 'Explicit listing taxonomy must select a leaf node.' using errcode = '22023';
  end if;

  with recursive lineage as (
    select
      node.id,
      node.parent_id,
      node.depth,
      node.legacy_category_id,
      node.legacy_subcategory_id
    from public.taxonomy_nodes node
    where node.id = p_taxonomy_node_id

    union all

    select
      parent.id,
      parent.parent_id,
      parent.depth,
      parent.legacy_category_id,
      parent.legacy_subcategory_id
    from public.taxonomy_nodes parent
    join lineage child on child.parent_id = parent.id
  )
  select
    (
      array_agg(lineage.legacy_category_id order by lineage.depth desc)
        filter (where lineage.legacy_category_id is not null)
    )[1],
    (
      array_agg(lineage.legacy_subcategory_id order by lineage.depth desc)
        filter (where lineage.legacy_subcategory_id is not null)
    )[1]
  into inherited_category_id, inherited_subcategory_id
  from lineage;

  if inherited_category_id is null then
    raise exception 'Taxonomy node has no legacy category compatibility mapping.'
      using errcode = '23514';
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
  on conflict on constraint listing_taxonomy_assignments_pkey do update
  set taxonomy_node_id = excluded.taxonomy_node_id,
      assignment_source = 'explicit',
      updated_at = now();

  return query
  select
    assignment.listing_id,
    assignment.taxonomy_node_id,
    assignment.assignment_source,
    assignment.updated_at
  from public.listing_taxonomy_assignments assignment
  where assignment.listing_id = p_listing_id;
end;
$$;

revoke all on function public.rawaj_assign_listing_taxonomy(uuid, text) from public;
revoke all on function public.rawaj_assign_listing_taxonomy(uuid, text) from anon;
grant execute on function public.rawaj_assign_listing_taxonomy(uuid, text) to authenticated;

comment on function public.rawaj_assign_listing_taxonomy(uuid, text) is
  'Assigns an explicit active leaf taxonomy node to an editable listing without PL/pgSQL output-column ambiguity.';

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.rawaj_assign_listing_taxonomy(uuid, text)'::regprocedure
  )
  into function_definition;

  if function_definition ~* 'on conflict\s*\(\s*listing_id\s*\)\s*do update' then
    raise exception 'Taxonomy assignment ambiguity contract violated.';
  end if;

  if function_definition !~* 'on conflict\s+on constraint\s+listing_taxonomy_assignments_pkey' then
    raise exception 'Taxonomy assignment conflict target is not constraint-qualified.';
  end if;
end;
$$;

notify pgrst, 'reload schema';