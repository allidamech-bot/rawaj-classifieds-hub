-- RAWAJ Taxonomy, Data & Search Foundation V1: updated-at triggers and read-only public metadata contracts.
-- Depends on migrations 202607190020 through 202607190022.

create or replace function public.rawaj_touch_taxonomy_foundation_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.rawaj_touch_taxonomy_foundation_updated_at() from public, anon, authenticated;

DO $triggers$
declare
  target_table text;
begin
  foreach target_table in array array[
    'taxonomy_versions',
    'taxonomy_version_nodes',
    'option_sets',
    'option_values',
    'field_definitions',
    'taxonomy_field_rules',
    'field_conditional_rules',
    'taxonomy_mapping_queue',
    'vehicle_makes',
    'vehicle_models',
    'vehicle_generations',
    'vehicle_trims'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_touch_updated_at', target_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.rawaj_touch_taxonomy_foundation_updated_at()',
      target_table || '_touch_updated_at',
      target_table
    );
  end loop;
end;
$triggers$;

-- Enforce safe read-only public contracts. Drafts and mapping queues remain locked
-- until owner-only RPCs are introduced in a later reviewed phase.
alter table public.taxonomy_versions enable row level security;
alter table public.taxonomy_version_nodes enable row level security;
alter table public.option_sets enable row level security;
alter table public.option_values enable row level security;
alter table public.field_definitions enable row level security;
alter table public.taxonomy_field_rules enable row level security;
alter table public.field_conditional_rules enable row level security;
alter table public.taxonomy_mapping_queue enable row level security;
alter table public.vehicle_makes enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_generations enable row level security;
alter table public.vehicle_trims enable row level security;

revoke all on table public.taxonomy_versions from anon, authenticated;
revoke all on table public.taxonomy_version_nodes from anon, authenticated;
revoke all on table public.option_sets from anon, authenticated;
revoke all on table public.option_values from anon, authenticated;
revoke all on table public.field_definitions from anon, authenticated;
revoke all on table public.taxonomy_field_rules from anon, authenticated;
revoke all on table public.field_conditional_rules from anon, authenticated;
revoke all on table public.taxonomy_mapping_queue from anon, authenticated;
revoke all on table public.vehicle_makes from anon, authenticated;
revoke all on table public.vehicle_models from anon, authenticated;
revoke all on table public.vehicle_generations from anon, authenticated;
revoke all on table public.vehicle_trims from anon, authenticated;

grant select on table public.taxonomy_versions to anon, authenticated;
grant select on table public.taxonomy_version_nodes to anon, authenticated;
grant select on table public.option_sets to anon, authenticated;
grant select on table public.option_values to anon, authenticated;
grant select on table public.field_definitions to anon, authenticated;
grant select on table public.taxonomy_field_rules to anon, authenticated;
grant select on table public.field_conditional_rules to anon, authenticated;
grant select on table public.vehicle_makes to anon, authenticated;
grant select on table public.vehicle_models to anon, authenticated;
grant select on table public.vehicle_generations to anon, authenticated;
grant select on table public.vehicle_trims to anon, authenticated;

drop policy if exists taxonomy_versions_public_read on public.taxonomy_versions;
create policy taxonomy_versions_public_read
on public.taxonomy_versions
for select
to anon, authenticated
using (status = 'published');

drop policy if exists taxonomy_version_nodes_public_read on public.taxonomy_version_nodes;
create policy taxonomy_version_nodes_public_read
on public.taxonomy_version_nodes
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.taxonomy_versions version_row
    where version_row.id = taxonomy_version_nodes.version_id
      and version_row.status = 'published'
  )
);

drop policy if exists option_sets_public_read on public.option_sets;
create policy option_sets_public_read
on public.option_sets
for select
to anon, authenticated
using (is_active);

drop policy if exists option_values_public_read on public.option_values;
create policy option_values_public_read
on public.option_values
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.option_sets option_set
    where option_set.key = option_values.option_set_key
      and option_set.is_active
  )
);

drop policy if exists field_definitions_public_read on public.field_definitions;
create policy field_definitions_public_read
on public.field_definitions
for select
to anon, authenticated
using (is_active and not is_sensitive);

drop policy if exists taxonomy_field_rules_public_read on public.taxonomy_field_rules;
create policy taxonomy_field_rules_public_read
on public.taxonomy_field_rules
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.taxonomy_versions version_row
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = version_row.id
     and node_row.node_id = taxonomy_field_rules.taxonomy_node_id
    join public.field_definitions field_row
      on field_row.key = taxonomy_field_rules.field_key
    where version_row.id = taxonomy_field_rules.version_id
      and version_row.status = 'published'
      and node_row.is_active
      and field_row.is_active
      and not field_row.is_sensitive
  )
);

drop policy if exists field_conditional_rules_public_read on public.field_conditional_rules;
create policy field_conditional_rules_public_read
on public.field_conditional_rules
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.taxonomy_versions version_row
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = version_row.id
     and node_row.node_id = field_conditional_rules.taxonomy_node_id
    join public.field_definitions trigger_field
      on trigger_field.key = field_conditional_rules.trigger_field_key
    join public.field_definitions target_field
      on target_field.key = field_conditional_rules.target_field_key
    where version_row.id = field_conditional_rules.version_id
      and version_row.status = 'published'
      and node_row.is_active
      and trigger_field.is_active
      and target_field.is_active
      and not trigger_field.is_sensitive
      and not target_field.is_sensitive
  )
);

drop policy if exists vehicle_makes_public_read on public.vehicle_makes;
create policy vehicle_makes_public_read
on public.vehicle_makes
for select
to anon, authenticated
using (is_active);

drop policy if exists vehicle_models_public_read on public.vehicle_models;
create policy vehicle_models_public_read
on public.vehicle_models
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.vehicle_makes make_row
    where make_row.id = vehicle_models.make_id and make_row.is_active
  )
);

drop policy if exists vehicle_generations_public_read on public.vehicle_generations;
create policy vehicle_generations_public_read
on public.vehicle_generations
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.vehicle_models model_row
    join public.vehicle_makes make_row on make_row.id = model_row.make_id
    where model_row.id = vehicle_generations.model_id
      and model_row.is_active
      and make_row.is_active
  )
);

drop policy if exists vehicle_trims_public_read on public.vehicle_trims;
create policy vehicle_trims_public_read
on public.vehicle_trims
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.vehicle_models model_row
    join public.vehicle_makes make_row on make_row.id = model_row.make_id
    where model_row.id = vehicle_trims.model_id
      and model_row.is_active
      and make_row.is_active
  )
);

comment on table public.taxonomy_versions is
  'Governed taxonomy release metadata. Exactly one row may be published.';
comment on table public.taxonomy_version_nodes is
  'Versioned taxonomy snapshots. public.taxonomy_nodes remains the runtime published compatibility table until cutover.';
comment on table public.taxonomy_mapping_queue is
  'Private review queue for mapping legacy/root-only listings to canonical leaf nodes.';
comment on table public.field_definitions is
  'Stable marketplace field registry used by listing studio, filters, cards, details, and comparison.';
comment on table public.vehicle_models is
  'Controlled vehicle model catalog; model options are always scoped by make_id.';
