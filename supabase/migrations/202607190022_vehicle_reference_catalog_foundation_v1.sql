-- RAWAJ Taxonomy, Data & Search Foundation V1: controlled vehicle make/model/generation/trim catalog.

create table if not exists public.vehicle_makes (
  id text primary key,
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  aliases text[] not null default '{}'::text[],
  country_code text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_makes_id_format check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_makes_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_makes_country_code_check check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  ),
  constraint vehicle_makes_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.vehicle_models (
  id text primary key,
  make_id text not null references public.vehicle_makes(id) on delete restrict,
  slug text not null,
  name_ar text not null,
  name_en text not null,
  aliases text[] not null default '{}'::text[],
  vehicle_type text,
  start_year integer,
  end_year integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (make_id, slug),
  constraint vehicle_models_id_format check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_models_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_models_years_check check (
    (start_year is null or start_year between 1886 and 2100)
    and (end_year is null or end_year between 1886 and 2100)
    and (start_year is null or end_year is null or end_year >= start_year)
  ),
  constraint vehicle_models_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists vehicle_models_make_active_sort_idx
  on public.vehicle_models(make_id, sort_order, name_en, id)
  where is_active;

create table if not exists public.vehicle_generations (
  id text primary key,
  model_id text not null references public.vehicle_models(id) on delete cascade,
  slug text not null,
  name_ar text not null,
  name_en text not null,
  aliases text[] not null default '{}'::text[],
  start_year integer,
  end_year integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, slug),
  unique (id, model_id),
  constraint vehicle_generations_id_format check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_generations_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_generations_years_check check (
    (start_year is null or start_year between 1886 and 2100)
    and (end_year is null or end_year between 1886 and 2100)
    and (start_year is null or end_year is null or end_year >= start_year)
  ),
  constraint vehicle_generations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists vehicle_generations_model_active_sort_idx
  on public.vehicle_generations(model_id, sort_order, start_year desc nulls last, id)
  where is_active;

create table if not exists public.vehicle_trims (
  id text primary key,
  model_id text not null references public.vehicle_models(id) on delete cascade,
  generation_id text,
  slug text not null,
  name_ar text not null,
  name_en text not null,
  aliases text[] not null default '{}'::text[],
  start_year integer,
  end_year integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, slug),
  constraint vehicle_trims_generation_model_fkey
    foreign key (generation_id, model_id)
    references public.vehicle_generations(id, model_id)
    on delete cascade,
  constraint vehicle_trims_id_format check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_trims_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint vehicle_trims_years_check check (
    (start_year is null or start_year between 1886 and 2100)
    and (end_year is null or end_year between 1886 and 2100)
    and (start_year is null or end_year is null or end_year >= start_year)
  ),
  constraint vehicle_trims_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists vehicle_trims_model_active_sort_idx
  on public.vehicle_trims(model_id, generation_id, sort_order, name_en, id)
  where is_active;
