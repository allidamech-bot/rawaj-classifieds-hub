import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = await Promise.all(
  [
    "202607190020_taxonomy_governance_foundation_v1.sql",
    "202607190021_taxonomy_field_registry_foundation_v1.sql",
    "202607190022_vehicle_reference_catalog_foundation_v1.sql",
    "202607190023_taxonomy_data_public_read_contract_v1.sql",
  ].map((filename) =>
    readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"),
  ),
);

const migration = migrations.join("\n");

const requiredTables = [
  "taxonomy_versions",
  "taxonomy_version_nodes",
  "option_sets",
  "option_values",
  "field_definitions",
  "taxonomy_field_rules",
  "field_conditional_rules",
  "taxonomy_mapping_queue",
  "vehicle_makes",
  "vehicle_models",
  "vehicle_generations",
  "vehicle_trims",
];

test("foundation creates the governed taxonomy, field, mapping, and vehicle tables", () => {
  for (const table of requiredTables) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\s*\\(`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("versioned nodes preserve the existing runtime taxonomy during additive rollout", () => {
  assert.match(migration, /public\.taxonomy_nodes remains the runtime published compatibility table/);
  assert.match(migration, /insert into public\.taxonomy_version_nodes/);
  assert.match(migration, /from public\.taxonomy_nodes\s*\ncross join published_version/);
  assert.match(migration, /unique \(version_id, slug\)/);
  assert.match(migration, /foreign key \(version_id, parent_node_id\)/);
  assert.match(migration, /deferrable initially deferred/);
});

test("only one published taxonomy version is permitted", () => {
  assert.match(migration, /taxonomy_versions_single_published_idx/);
  assert.match(migration, /where status = 'published'/);
  assert.match(migration, /status in \('draft', 'published', 'archived'\)/);
  assert.match(migration, /status = 'published' and published_at is not null/);
});

test("field schemas are stable, reusable, and leaf-scoped", () => {
  assert.match(migration, /create table if not exists public\.field_definitions/);
  assert.match(migration, /create table if not exists public\.taxonomy_field_rules/);
  assert.match(migration, /create table if not exists public\.field_conditional_rules/);
  assert.match(migration, /primary key \(version_id, taxonomy_node_id, field_key\)/);
  assert.match(migration, /display_surfaces <@ array/);
  assert.match(migration, /effect in \('show', 'hide', 'require', 'optional', 'clear'\)/);
});

test("vehicle models and descendants cannot exist without controlled parents", () => {
  assert.match(
    migration,
    /make_id text not null references public\.vehicle_makes\(id\) on delete restrict/,
  );
  assert.match(
    migration,
    /model_id text not null references public\.vehicle_models\(id\) on delete cascade/,
  );
  assert.match(migration, /unique \(make_id, slug\)/);
  assert.match(migration, /unique \(model_id, slug\)/);
  assert.match(migration, /'vehicle_models_by_make'/);
  assert.match(migration, /'vehicle_generations_by_model'/);
  assert.match(migration, /'vehicle_trims_by_model'/);
});

test("legacy listing migration is explicit, reviewable, and confidence bounded", () => {
  assert.match(migration, /create table if not exists public\.taxonomy_mapping_queue/);
  assert.match(migration, /listing_id uuid primary key references public\.listings\(id\)/);
  assert.match(migration, /confidence >= 0 and confidence <= 1/);
  assert.match(
    migration,
    /status in \('pending', 'auto_mapped', 'needs_review', 'confirmed', 'unresolved'\)/,
  );
  assert.match(migration, /reviewed_by uuid references public\.profiles\(id\)/);
});

test("public clients receive read-only published metadata and never receive mapping queue access", () => {
  for (const table of [
    "taxonomy_versions",
    "taxonomy_version_nodes",
    "option_sets",
    "option_values",
    "field_definitions",
    "taxonomy_field_rules",
    "field_conditional_rules",
    "vehicle_makes",
    "vehicle_models",
    "vehicle_generations",
    "vehicle_trims",
  ]) {
    assert.match(
      migration,
      new RegExp(`grant select on table public\\.${table} to anon, authenticated`),
    );
  }

  assert.match(
    migration,
    /revoke all on table public\.taxonomy_mapping_queue from anon, authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:select|insert|update|delete|all) on table public\.taxonomy_mapping_queue to anon, authenticated/,
  );
  assert.doesNotMatch(migration, /for (?:insert|update|delete)\s*\nto anon, authenticated/);
});

test("public taxonomy reads expose only the published active version", () => {
  assert.match(migration, /create policy taxonomy_versions_public_read/);
  assert.match(migration, /using \(status = 'published'\)/);
  assert.match(migration, /create policy taxonomy_version_nodes_public_read/);
  assert.match(migration, /version_row\.status = 'published'/);
  assert.match(migration, /and node_row\.is_active/);
});

test("foundation trigger helper pins search_path and is not directly executable", () => {
  assert.match(
    migration,
    /create or replace function public\.rawaj_touch_taxonomy_foundation_updated_at\(\)/,
  );
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(
    migration,
    /revoke all on function public\.rawaj_touch_taxonomy_foundation_updated_at\(\) from public, anon, authenticated/,
  );
});
