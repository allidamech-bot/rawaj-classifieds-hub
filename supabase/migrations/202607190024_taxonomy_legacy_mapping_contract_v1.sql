-- RAWAJ Taxonomy, Data & Search Foundation V1: explicit compatibility mappings.
-- Multiple legacy categories/subcategories may map to one canonical leaf while
-- carrying safe structured attribute patches such as brand or transaction intent.

create table if not exists public.taxonomy_legacy_mappings (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.taxonomy_versions(id) on delete cascade,
  legacy_category_id text not null references public.categories(id) on delete cascade,
  legacy_subcategory_id text references public.subcategories(id) on delete cascade,
  taxonomy_node_id text not null,
  mapping_kind text not null default 'exact',
  priority integer not null default 100,
  attribute_patch jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxonomy_legacy_mappings_node_fkey
    foreign key (version_id, taxonomy_node_id)
    references public.taxonomy_version_nodes(version_id, node_id)
    on delete cascade,
  constraint taxonomy_legacy_mappings_kind_check check (
    mapping_kind in ('exact', 'category_default', 'brand_attribute', 'compatibility', 'manual_review')
  ),
  constraint taxonomy_legacy_mappings_priority_check check (priority >= 0),
  constraint taxonomy_legacy_mappings_patch_object check (jsonb_typeof(attribute_patch) = 'object'),
  constraint taxonomy_legacy_mappings_scope_check check (
    (mapping_kind = 'category_default' and legacy_subcategory_id is null)
    or (mapping_kind <> 'category_default' and legacy_subcategory_id is not null)
  )
);

create unique index if not exists taxonomy_legacy_mappings_exact_scope_idx
  on public.taxonomy_legacy_mappings(version_id, legacy_category_id, legacy_subcategory_id)
  where legacy_subcategory_id is not null and is_active;

create unique index if not exists taxonomy_legacy_mappings_category_default_idx
  on public.taxonomy_legacy_mappings(version_id, legacy_category_id)
  where legacy_subcategory_id is null and mapping_kind = 'category_default' and is_active;

create index if not exists taxonomy_legacy_mappings_target_idx
  on public.taxonomy_legacy_mappings(version_id, taxonomy_node_id, priority, id)
  where is_active;

alter table public.taxonomy_legacy_mappings enable row level security;
revoke all on table public.taxonomy_legacy_mappings from anon, authenticated;
grant select on table public.taxonomy_legacy_mappings to anon, authenticated;

drop policy if exists taxonomy_legacy_mappings_public_read on public.taxonomy_legacy_mappings;
create policy taxonomy_legacy_mappings_public_read
on public.taxonomy_legacy_mappings
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.taxonomy_versions version_row
    join public.taxonomy_version_nodes node_row
      on node_row.version_id = version_row.id
     and node_row.node_id = taxonomy_legacy_mappings.taxonomy_node_id
    where version_row.id = taxonomy_legacy_mappings.version_id
      and version_row.status = 'published'
      and node_row.is_active
      and node_row.is_leaf
  )
);

drop trigger if exists taxonomy_legacy_mappings_touch_updated_at
  on public.taxonomy_legacy_mappings;
create trigger taxonomy_legacy_mappings_touch_updated_at
before update on public.taxonomy_legacy_mappings
for each row execute function public.rawaj_touch_taxonomy_foundation_updated_at();

comment on table public.taxonomy_legacy_mappings is
  'Versioned compatibility map from legacy category/subcategory identifiers to canonical leaves, with optional safe structured attribute patches.';
