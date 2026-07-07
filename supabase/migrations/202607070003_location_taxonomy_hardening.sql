-- RAWAJ location taxonomy hardening.
-- Manual-only migration. Requires 202607070001 and 202607070002.

alter table public.location_nodes
  add column if not exists source_url text,
  add column if not exists source_date date,
  add column if not exists confidence text,
  add column if not exists review_status text not null default 'unreviewed',
  add column if not exists notes text;

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

create index if not exists location_nodes_review_status_idx
  on public.location_nodes(review_status, is_active);

create or replace function public.rawaj_refresh_location_subtree_depths()
returns trigger
language plpgsql
as $$
begin
  if old.parent_id is not distinct from new.parent_id then
    return new;
  end if;

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
  if new.parent_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.legacy_governorate_id is distinct from old.legacy_governorate_id then
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

create or replace function public.rawaj_sync_listing_location_node()
returns trigger
language plpgsql
as $$
declare
  resolved_id uuid;
begin
  if tg_op = 'INSERT' and new.location_node_id is not null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.location_node_id is distinct from old.location_node_id then
    return new;
  end if;

  if new.governorate_id is null
     or new.district_ar is null
     or btrim(new.district_ar) = '' then
    new.location_node_id = null;
    return new;
  end if;

  resolved_id := public.rawaj_resolve_location_option(
    new.governorate_id,
    new.district_ar
  );
  new.location_node_id = resolved_id;
  return new;
end;
$$;

revoke all on function public.rawaj_location_descendant_ids(uuid) from public;
revoke all on function public.rawaj_location_path(uuid) from public;
revoke all on function public.rawaj_location_option_paths(text) from public;
revoke all on function public.rawaj_resolve_location_option(text, text) from public;

grant execute on function public.rawaj_location_descendant_ids(uuid) to anon, authenticated;
grant execute on function public.rawaj_location_path(uuid) to anon, authenticated;
grant execute on function public.rawaj_location_option_paths(text) to anon, authenticated;
grant execute on function public.rawaj_resolve_location_option(text, text) to anon, authenticated;
