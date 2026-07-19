-- RAWAJ Taxonomy, Data & Search Foundation V1: deferred cross-attribute integrity and mapping hardening.

create or replace function public.rawaj_enforce_listing_attribute_dependencies()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_listing_id uuid := coalesce(new.listing_id, old.listing_id);
  v_make_id text;
  v_model_id text;
  v_generation_id text;
  v_trim_id text;
  v_expected_parent text;
begin
  select value_key into v_make_id
  from public.listing_attribute_values
  where listing_id = v_listing_id and field_key = 'vehicle_make';

  select value_key into v_model_id
  from public.listing_attribute_values
  where listing_id = v_listing_id and field_key = 'vehicle_model';

  select value_key into v_generation_id
  from public.listing_attribute_values
  where listing_id = v_listing_id and field_key = 'vehicle_generation';

  select value_key into v_trim_id
  from public.listing_attribute_values
  where listing_id = v_listing_id and field_key = 'vehicle_trim';

  if v_model_id is not null then
    select make_id into v_expected_parent
    from public.vehicle_models
    where id = v_model_id and is_active;

    if v_expected_parent is null or v_make_id is null or v_expected_parent <> v_make_id then
      raise exception 'listing_attribute_vehicle_model_make_mismatch';
    end if;
  end if;

  if v_generation_id is not null then
    select model_id into v_expected_parent
    from public.vehicle_generations
    where id = v_generation_id and is_active;

    if v_expected_parent is null or v_model_id is null or v_expected_parent <> v_model_id then
      raise exception 'listing_attribute_vehicle_generation_model_mismatch';
    end if;
  end if;

  if v_trim_id is not null then
    select model_id into v_expected_parent
    from public.vehicle_trims
    where id = v_trim_id and is_active;

    if v_expected_parent is null or v_model_id is null or v_expected_parent <> v_model_id then
      raise exception 'listing_attribute_vehicle_trim_model_mismatch';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.rawaj_enforce_listing_attribute_dependencies()
  from public, anon, authenticated;

drop trigger if exists listing_attribute_values_dependencies
  on public.listing_attribute_values;
create constraint trigger listing_attribute_values_dependencies
after insert or update or delete on public.listing_attribute_values
deferrable initially deferred
for each row execute function public.rawaj_enforce_listing_attribute_dependencies();

create or replace function public.rawaj_validate_taxonomy_legacy_mapping()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_actual_category_id text;
begin
  if new.legacy_subcategory_id is not null then
    select category_id
      into v_actual_category_id
    from public.subcategories
    where id = new.legacy_subcategory_id;

    if v_actual_category_id is null or v_actual_category_id <> new.legacy_category_id then
      raise exception 'taxonomy_legacy_mapping_category_mismatch';
    end if;
  end if;

  if not exists (
    select 1
    from public.taxonomy_version_nodes node_row
    where node_row.version_id = new.version_id
      and node_row.node_id = new.taxonomy_node_id
      and node_row.is_active
      and node_row.is_leaf
  ) then
    raise exception 'taxonomy_legacy_mapping_requires_active_leaf';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.rawaj_validate_taxonomy_legacy_mapping()
  from public, anon, authenticated;

drop trigger if exists taxonomy_legacy_mappings_validate
  on public.taxonomy_legacy_mappings;
create trigger taxonomy_legacy_mappings_validate
before insert or update on public.taxonomy_legacy_mappings
for each row execute function public.rawaj_validate_taxonomy_legacy_mapping();

-- A future sensitive field may be stored for internal operations, but it must not
-- become publicly visible merely because the parent listing is public.
drop policy if exists listing_attribute_values_visible_with_listing
  on public.listing_attribute_values;
create policy listing_attribute_values_visible_with_listing
on public.listing_attribute_values
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings listing_row
    join public.field_definitions field_row
      on field_row.key = listing_attribute_values.field_key
    where listing_row.id = listing_attribute_values.listing_id
      and field_row.is_active
      and not field_row.is_sensitive
  )
);

comment on function public.rawaj_enforce_listing_attribute_dependencies() is
  'Deferred integrity gate preventing orphaned or mismatched vehicle make/model/generation/trim relationships after batch writes or deletes.';
comment on function public.rawaj_validate_taxonomy_legacy_mapping() is
  'Internal mapping validator requiring category/subcategory consistency and an active canonical leaf target.';
