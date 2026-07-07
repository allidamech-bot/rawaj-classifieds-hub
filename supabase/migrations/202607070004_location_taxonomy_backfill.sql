-- RAWAJ location taxonomy legacy-resolution and backfill hardening.
-- Manual-only migration. Requires 202607070001 through 202607070003.

-- Clear stale inherited mapping when a node moves beneath an unmapped parent.
create or replace function public.rawaj_inherit_location_legacy_governorate()
returns trigger
language plpgsql
as $$
declare
  inherited_governorate uuid;
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

  new.legacy_governorate_id = inherited_governorate;
  return new;
end;
$$;

-- Resolve exact canonical path first. If legacy data only stores a leaf name,
-- accept it only when that active Arabic name is unique inside the governorate.
create or replace function public.rawaj_resolve_location_option(
  legacy_governorate uuid,
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
  if legacy_governorate is null or normalized_label = '' then
    return null;
  end if;

  select option_paths.id
  into resolved_id
  from public.rawaj_location_option_paths('SY') option_paths
  where option_paths.legacy_governorate_id = legacy_governorate
    and option_paths.label_ar = normalized_label
  limit 1;

  if resolved_id is not null then
    return resolved_id;
  end if;

  select count(*), min(n.id)
  into candidate_count, resolved_id
  from public.location_nodes n
  where n.is_active = true
    and n.legacy_governorate_id = legacy_governorate
    and btrim(n.name_ar) = normalized_label
    and n.node_type not in ('country', 'governorate');

  if candidate_count = 1 then
    return resolved_id;
  end if;

  return null;
end;
$$;

revoke all on function public.rawaj_resolve_location_option(uuid, text) from public;
grant execute on function public.rawaj_resolve_location_option(uuid, text) to anon, authenticated;

-- Explicit administrative backfill for old listings. It never guesses ambiguous names.
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
  set location_node_id = public.rawaj_resolve_location_option(
    l.governorate_id,
    l.district_ar
  )
  where l.location_node_id is null
    and l.governorate_id is not null
    and l.district_ar is not null
    and btrim(l.district_ar) <> ''
    and public.rawaj_resolve_location_option(l.governorate_id, l.district_ar) is not null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.rawaj_backfill_listing_location_nodes() from public;
grant execute on function public.rawaj_backfill_listing_location_nodes() to authenticated;
