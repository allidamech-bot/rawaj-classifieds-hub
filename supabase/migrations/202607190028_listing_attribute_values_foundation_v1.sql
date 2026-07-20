-- RAWAJ Taxonomy, Data & Search Foundation V1: typed listing attribute storage.
-- Direct client writes stay disabled; governed listing RPCs will write validated values.

create table if not exists public.listing_attribute_values (
  listing_id uuid not null references public.listings(id) on delete cascade,
  field_key text not null references public.field_definitions(key) on delete restrict,
  value_text text,
  value_numeric numeric,
  value_boolean boolean,
  value_date date,
  value_key text,
  value_json jsonb,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (listing_id, field_key),
  constraint listing_attribute_values_single_value check (
    num_nonnulls(value_text, value_numeric, value_boolean, value_date, value_key, value_json) = 1
  ),
  constraint listing_attribute_values_source_check check (
    source in ('user', 'legacy_backfill', 'admin', 'system')
  )
);

create index if not exists listing_attribute_values_field_key_idx
  on public.listing_attribute_values(field_key, value_key, listing_id)
  where value_key is not null;

create index if not exists listing_attribute_values_field_numeric_idx
  on public.listing_attribute_values(field_key, value_numeric, listing_id)
  where value_numeric is not null;

create index if not exists listing_attribute_values_listing_idx
  on public.listing_attribute_values(listing_id, field_key);

create or replace function public.rawaj_validate_listing_attribute_value()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_field public.field_definitions%rowtype;
  v_model_make_id text;
  v_selected_parent_key text;
  v_minimum numeric;
  v_maximum numeric;
  v_min_length integer;
  v_max_length integer;
begin
  select *
    into v_field
  from public.field_definitions
  where key = new.field_key
    and is_active;

  if not found then
    raise exception 'listing_attribute_unknown_field';
  end if;

  if not exists (
    select 1
    from public.listing_taxonomy_assignments assignment_row
    join public.taxonomy_versions version_row
      on version_row.status = 'published'
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = version_row.id
     and node_row.node_id = assignment_row.taxonomy_node_id
    join public.taxonomy_field_rules rule_row
      on rule_row.version_id = node_row.version_id
     and rule_row.taxonomy_node_id = node_row.node_id
     and rule_row.field_key = new.field_key
    where assignment_row.listing_id = new.listing_id
      and node_row.is_active
      and node_row.is_leaf
  ) then
    raise exception 'listing_attribute_not_allowed_for_taxonomy';
  end if;

  if v_field.field_type in ('text', 'textarea') and new.value_text is null then
    raise exception 'listing_attribute_text_value_required';
  elsif v_field.field_type in ('integer', 'numeric', 'year') and new.value_numeric is null then
    raise exception 'listing_attribute_numeric_value_required';
  elsif v_field.field_type = 'boolean' and new.value_boolean is null then
    raise exception 'listing_attribute_boolean_value_required';
  elsif v_field.field_type = 'date' and new.value_date is null then
    raise exception 'listing_attribute_date_value_required';
  elsif v_field.field_type in ('single_select', 'reference', 'location') and new.value_key is null then
    raise exception 'listing_attribute_key_value_required';
  elsif v_field.field_type = 'multi_select'
    and (new.value_json is null or jsonb_typeof(new.value_json) <> 'array') then
    raise exception 'listing_attribute_array_value_required';
  end if;

  if v_field.field_type in ('integer', 'year')
    and new.value_numeric is not null
    and trunc(new.value_numeric) <> new.value_numeric then
    raise exception 'listing_attribute_integer_value_required';
  end if;

  if new.value_numeric is not null then
    v_minimum := nullif(v_field.validation_schema ->> 'minimum', '')::numeric;
    v_maximum := nullif(v_field.validation_schema ->> 'maximum', '')::numeric;
    if v_minimum is not null and new.value_numeric < v_minimum then
      raise exception 'listing_attribute_below_minimum';
    end if;
    if v_maximum is not null and new.value_numeric > v_maximum then
      raise exception 'listing_attribute_above_maximum';
    end if;
  end if;

  if new.value_text is not null then
    v_min_length := nullif(v_field.validation_schema ->> 'minLength', '')::integer;
    v_max_length := nullif(v_field.validation_schema ->> 'maxLength', '')::integer;
    if v_min_length is not null and char_length(new.value_text) < v_min_length then
      raise exception 'listing_attribute_below_min_length';
    end if;
    if v_max_length is not null and char_length(new.value_text) > v_max_length then
      raise exception 'listing_attribute_above_max_length';
    end if;
  end if;

  if v_field.option_set_key is not null then
    if new.value_key is not null and not exists (
      select 1
      from public.option_values option_row
      where option_row.option_set_key = v_field.option_set_key
        and option_row.value_key = new.value_key
        and option_row.is_active
    ) then
      raise exception 'listing_attribute_invalid_option';
    end if;

    if new.value_json is not null and exists (
      select 1
      from jsonb_array_elements_text(new.value_json) selected_value
      where not exists (
        select 1
        from public.option_values option_row
        where option_row.option_set_key = v_field.option_set_key
          and option_row.value_key = selected_value
          and option_row.is_active
      )
    ) then
      raise exception 'listing_attribute_invalid_multi_option';
    end if;
  end if;

  if v_field.data_provider_key = 'vehicle_makes' then
    if not exists (
      select 1 from public.vehicle_makes make_row
      where make_row.id = new.value_key and make_row.is_active
    ) then
      raise exception 'listing_attribute_invalid_vehicle_make';
    end if;
  elsif v_field.data_provider_key = 'vehicle_models_by_make' then
    select model_row.make_id
      into v_model_make_id
    from public.vehicle_models model_row
    where model_row.id = new.value_key
      and model_row.is_active;

    select attribute_row.value_key
      into v_selected_parent_key
    from public.listing_attribute_values attribute_row
    where attribute_row.listing_id = new.listing_id
      and attribute_row.field_key = 'vehicle_make';

    if v_model_make_id is null or v_selected_parent_key is null or v_model_make_id <> v_selected_parent_key then
      raise exception 'listing_attribute_vehicle_model_make_mismatch';
    end if;
  elsif v_field.data_provider_key = 'vehicle_generations_by_model' then
    select generation_row.model_id
      into v_model_make_id
    from public.vehicle_generations generation_row
    where generation_row.id = new.value_key
      and generation_row.is_active;

    select attribute_row.value_key
      into v_selected_parent_key
    from public.listing_attribute_values attribute_row
    where attribute_row.listing_id = new.listing_id
      and attribute_row.field_key = 'vehicle_model';

    if v_model_make_id is null or v_selected_parent_key is null or v_model_make_id <> v_selected_parent_key then
      raise exception 'listing_attribute_vehicle_generation_model_mismatch';
    end if;
  elsif v_field.data_provider_key = 'vehicle_trims_by_model' then
    select trim_row.model_id
      into v_model_make_id
    from public.vehicle_trims trim_row
    where trim_row.id = new.value_key
      and trim_row.is_active;

    select attribute_row.value_key
      into v_selected_parent_key
    from public.listing_attribute_values attribute_row
    where attribute_row.listing_id = new.listing_id
      and attribute_row.field_key = 'vehicle_model';

    if v_model_make_id is null or v_selected_parent_key is null or v_model_make_id <> v_selected_parent_key then
      raise exception 'listing_attribute_vehicle_trim_model_mismatch';
    end if;
  elsif v_field.data_provider_key = 'location_nodes' then
    if not exists (
      select 1
      from public.location_nodes location_row
      where location_row.id::text = new.value_key
        and location_row.is_active
    ) then
      raise exception 'listing_attribute_invalid_location';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.rawaj_validate_listing_attribute_value() from public, anon, authenticated;

drop trigger if exists listing_attribute_values_validate
  on public.listing_attribute_values;
create trigger listing_attribute_values_validate
before insert or update on public.listing_attribute_values
for each row execute function public.rawaj_validate_listing_attribute_value();

alter table public.listing_attribute_values enable row level security;
revoke all on table public.listing_attribute_values from anon, authenticated;
grant select on table public.listing_attribute_values to anon, authenticated;

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
    where listing_row.id = listing_attribute_values.listing_id
  )
);

comment on table public.listing_attribute_values is
  'Typed canonical listing attributes. Direct client writes are disabled; validated listing RPCs own mutations.';
comment on function public.rawaj_validate_listing_attribute_value() is
  'Internal trigger validator enforcing published leaf field rules, option sets, numeric/text constraints, and vehicle reference parent relationships.';
