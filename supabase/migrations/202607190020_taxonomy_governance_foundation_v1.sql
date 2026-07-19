-- RAWAJ Taxonomy, Data & Search Foundation V1: governed taxonomy versions and listing mapping queue.
-- Additive only: public.taxonomy_nodes remains the runtime published compatibility table.

create table if not exists public.taxonomy_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null unique,
  status text not null default 'draft',
  based_on_version_id uuid references public.taxonomy_versions(id) on delete restrict,
  change_summary text,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxonomy_versions_number_positive check (version_number > 0),
  constraint taxonomy_versions_status_check check (status in ('draft', 'published', 'archived')),
  constraint taxonomy_versions_publish_metadata check (
    (status = 'published' and published_at is not null)
    or status <> 'published'
  )
);

create unique index if not exists taxonomy_versions_single_published_idx
  on public.taxonomy_versions ((status))
  where status = 'published';

create table if not exists public.taxonomy_version_nodes (
  version_id uuid not null references public.taxonomy_versions(id) on delete cascade,
  node_id text not null,
  parent_node_id text,
  slug text not null,
  name_ar text not null,
  name_en text,
  description_ar text,
  description_en text,
  icon_key text,
  sort_order integer not null default 0,
  depth integer not null default 0,
  is_active boolean not null default true,
  is_leaf boolean not null default false,
  filter_schema_key text,
  display_schema_key text,
  classification_key text,
  classification_value text,
  legacy_category_id text references public.categories(id) on delete set null,
  legacy_subcategory_id text references public.subcategories(id) on delete set null,
  seo_title_ar text,
  seo_title_en text,
  seo_description_ar text,
  seo_description_en text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (version_id, node_id),
  unique (version_id, slug),
  constraint taxonomy_version_nodes_parent_not_self check (
    parent_node_id is null or parent_node_id <> node_id
  ),
  constraint taxonomy_version_nodes_depth_nonnegative check (depth >= 0),
  constraint taxonomy_version_nodes_root_depth check (
    (parent_node_id is null and depth = 0)
    or (parent_node_id is not null and depth > 0)
  ),
  constraint taxonomy_version_nodes_classification_pair check (
    (classification_key is null and classification_value is null)
    or (classification_key is not null and classification_value is not null)
  ),
  constraint taxonomy_version_nodes_parent_fkey
    foreign key (version_id, parent_node_id)
    references public.taxonomy_version_nodes(version_id, node_id)
    on delete restrict
    deferrable initially deferred
);

create index if not exists taxonomy_version_nodes_parent_sort_idx
  on public.taxonomy_version_nodes(version_id, parent_node_id, sort_order, node_id);
create index if not exists taxonomy_version_nodes_legacy_category_idx
  on public.taxonomy_version_nodes(version_id, legacy_category_id)
  where legacy_category_id is not null;
create index if not exists taxonomy_version_nodes_legacy_subcategory_idx
  on public.taxonomy_version_nodes(version_id, legacy_subcategory_id)
  where legacy_subcategory_id is not null;

create table if not exists public.taxonomy_mapping_queue (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  current_taxonomy_node_id text references public.taxonomy_nodes(id) on delete set null,
  suggested_version_id uuid,
  suggested_taxonomy_node_id text,
  confidence numeric(5,4),
  status text not null default 'pending',
  mapping_source text not null default 'unknown',
  evidence jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxonomy_mapping_queue_suggestion_fkey
    foreign key (suggested_version_id, suggested_taxonomy_node_id)
    references public.taxonomy_version_nodes(version_id, node_id)
    on delete set null,
  constraint taxonomy_mapping_queue_suggestion_pair check (
    (suggested_version_id is null and suggested_taxonomy_node_id is null)
    or (suggested_version_id is not null and suggested_taxonomy_node_id is not null)
  ),
  constraint taxonomy_mapping_queue_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  ),
  constraint taxonomy_mapping_queue_status_check check (
    status in ('pending', 'auto_mapped', 'needs_review', 'confirmed', 'unresolved')
  ),
  constraint taxonomy_mapping_queue_source_check check (
    mapping_source in ('legacy_rule', 'structured_fields', 'manual', 'import', 'unknown')
  ),
  constraint taxonomy_mapping_queue_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint taxonomy_mapping_queue_attempt_count_check check (attempt_count >= 0)
);

create index if not exists taxonomy_mapping_queue_status_confidence_idx
  on public.taxonomy_mapping_queue(status, confidence desc nulls last, updated_at);
create index if not exists taxonomy_mapping_queue_suggested_node_idx
  on public.taxonomy_mapping_queue(suggested_version_id, suggested_taxonomy_node_id)
  where suggested_taxonomy_node_id is not null;

-- Snapshot the current runtime taxonomy as the first published governed version.
insert into public.taxonomy_versions (
  version_number,
  status,
  change_summary,
  published_at
)
select
  1,
  'published',
  'Baseline snapshot of the pre-foundation runtime taxonomy.',
  now()
where not exists (
  select 1 from public.taxonomy_versions where status = 'published'
);

with published_version as (
  select id
  from public.taxonomy_versions
  where status = 'published'
  order by version_number desc
  limit 1
)
insert into public.taxonomy_version_nodes (
  version_id,
  node_id,
  parent_node_id,
  slug,
  name_ar,
  name_en,
  description_ar,
  description_en,
  icon_key,
  sort_order,
  depth,
  is_active,
  is_leaf,
  filter_schema_key,
  display_schema_key,
  classification_key,
  classification_value,
  legacy_category_id,
  legacy_subcategory_id,
  created_at,
  updated_at
)
select
  published_version.id,
  taxonomy_nodes.id,
  taxonomy_nodes.parent_id,
  taxonomy_nodes.slug,
  taxonomy_nodes.name_ar,
  taxonomy_nodes.name_en,
  taxonomy_nodes.description_ar,
  taxonomy_nodes.description_en,
  taxonomy_nodes.icon_key,
  taxonomy_nodes.sort_order,
  taxonomy_nodes.depth,
  taxonomy_nodes.is_active,
  taxonomy_nodes.is_leaf,
  taxonomy_nodes.filter_schema_key,
  taxonomy_nodes.filter_schema_key,
  taxonomy_nodes.classification_key,
  taxonomy_nodes.classification_value,
  taxonomy_nodes.legacy_category_id,
  taxonomy_nodes.legacy_subcategory_id,
  taxonomy_nodes.created_at,
  taxonomy_nodes.updated_at
from public.taxonomy_nodes
cross join published_version
on conflict (version_id, node_id) do nothing;
