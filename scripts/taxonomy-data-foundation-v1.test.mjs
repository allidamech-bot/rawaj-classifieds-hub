import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = await Promise.all(
  [
    "202607190020_taxonomy_governance_foundation_v1.sql",
    "202607190021_taxonomy_field_registry_foundation_v1.sql",
    "202607190022_vehicle_reference_catalog_foundation_v1.sql",
    "202607190023_taxonomy_data_public_read_contract_v1.sql",
    "202607190024_taxonomy_legacy_mapping_contract_v1.sql",
    "202607190025_taxonomy_owner_governance_rpc_v1.sql",
    "202607190026_marketplace_domain_field_registry_v1.sql",
    "202607190027_complete_marketplace_taxonomy_draft_v2.sql",
    "202607190028_listing_attribute_values_foundation_v1.sql",
    "202607190029_listing_attribute_dependency_hardening_v1.sql",
    "202607190030_vehicle_reference_seed_and_review_queue_v1.sql",
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
  "taxonomy_legacy_mappings",
  "vehicle_makes",
  "vehicle_models",
  "vehicle_generations",
  "vehicle_trims",
  "vehicle_reference_review_queue",
  "listing_attribute_values",
];

test("foundation creates the governed taxonomy, field, mapping, vehicle, and attribute tables", () => {
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

test("domain fields cover product, fashion, food, animal, education, service, and business data", () => {
  for (const key of [
    "product_authenticity",
    "fashion_size",
    "food_unit",
    "expiry_date",
    "animal_breed",
    "vaccinated",
    "education_delivery_mode",
    "service_pricing_unit",
    "business_item_type",
    "operating_hours",
  ]) {
    assert.match(migration, new RegExp(`\\('${key}'`));
  }
  assert.match(migration, /Seller-declared and not authenticated by RAWAJ/);
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

test("vehicle catalog seeds common makes and models with aliases", () => {
  for (const make of ["toyota", "hyundai", "kia", "mercedes-benz", "byd", "saipa", "iran-khodro"]) {
    assert.match(migration, new RegExp(`\\('${make}', '${make}'`));
  }
  for (const model of [
    "toyota-camry",
    "hyundai-elantra",
    "kia-cerato",
    "byd-song-plus",
    "saipa-pride",
    "iran-khodro-samand",
  ]) {
    assert.match(migration, new RegExp(`\\('${model}'`));
  }
  assert.match(migration, /array\['سيراتو','Cerato','Cirato'\]/);
  assert.match(migration, /array\['كامري','كامريه','Kamri','Camry'\]/);
});

test("unknown vehicle references enter a private deduplicated review queue", () => {
  assert.match(migration, /create table if not exists public\.vehicle_reference_review_queue/);
  assert.match(migration, /vehicle_reference_review_queue_open_scope_idx/);
  assert.match(migration, /where status = 'pending'/);
  assert.match(migration, /revoke all on table public\.vehicle_reference_review_queue from anon, authenticated/);
  assert.doesNotMatch(
    migration,
    /grant (?:select|insert|update|delete|all) on table public\.vehicle_reference_review_queue to anon, authenticated/,
  );
});

test("legacy compatibility mappings can consolidate old categories into canonical leaves", () => {
  assert.match(migration, /create table if not exists public\.taxonomy_legacy_mappings/);
  assert.match(migration, /attribute_patch jsonb not null default '\{\}'::jsonb/);
  assert.match(
    migration,
    /mapping_kind in \('exact', 'category_default', 'brand_attribute', 'compatibility', 'manual_review'\)/,
  );
  assert.match(migration, /taxonomy_legacy_mappings_exact_scope_idx/);
  assert.match(migration, /taxonomy_legacy_mappings_category_default_idx/);
  assert.match(migration, /node_row\.is_leaf/);
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

test("public clients receive read-only published metadata and never receive private review queues", () => {
  for (const table of [
    "taxonomy_versions",
    "taxonomy_version_nodes",
    "option_sets",
    "option_values",
    "field_definitions",
    "taxonomy_field_rules",
    "field_conditional_rules",
    "taxonomy_legacy_mappings",
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

  for (const table of ["taxonomy_mapping_queue", "vehicle_reference_review_queue"]) {
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${table} from anon, authenticated`),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`grant (?:select|insert|update|delete|all) on table public\\.${table} to anon, authenticated`),
    );
  }
  assert.doesNotMatch(migration, /for (?:insert|update|delete)\s*\nto anon, authenticated/);
});

test("public taxonomy reads expose only the published active version", () => {
  assert.match(migration, /create policy taxonomy_versions_public_read/);
  assert.match(migration, /using \(status = 'published'\)/);
  assert.match(migration, /create policy taxonomy_version_nodes_public_read/);
  assert.match(migration, /version_row\.status = 'published'/);
  assert.match(migration, /and node_row\.is_active/);
});

test("owner governance validates and atomically publishes a complete taxonomy", () => {
  assert.match(migration, /create or replace function public\.rawaj_owner_validate_taxonomy_version/);
  assert.match(migration, /active_roots_without_active_leaves/);
  assert.match(migration, /active_leaves_without_complete_schema/);
  assert.match(migration, /legacy_subcategories_without_mapping/);
  assert.match(migration, /taxonomy_cycles/);
  assert.match(migration, /runtime_slug_reuse_conflicts/);
  assert.match(migration, /create or replace function public\.rawaj_owner_create_taxonomy_draft/);
  assert.match(migration, /A taxonomy draft already exists/);
  assert.match(migration, /create or replace function public\.rawaj_owner_publish_taxonomy_version/);
  assert.match(migration, /raise exception 'stale_taxonomy_version'/);
  assert.match(migration, /taxonomy_validation_failed/);
  assert.match(migration, /lock table public\.taxonomy_versions/);
  assert.match(migration, /lock table public\.taxonomy_nodes/);
  assert.match(migration, /'taxonomy\.version_published'/);
});

test("owner taxonomy governance RPCs are authenticated entry points with database owner checks", () => {
  for (const signature of [
    "rawaj_owner_validate_taxonomy_version\\(uuid\\)",
    "rawaj_owner_create_taxonomy_draft\\(text\\)",
    "rawaj_owner_publish_taxonomy_version\\(uuid, timestamptz, text\\)",
  ]) {
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public, anon`));
  }
  assert.match(migration, /not public\.current_user_has_role\('owner'\)/);
});

test("taxonomy V2 is installed as a draft and never auto-published", () => {
  assert.match(migration, /values \(\s*2,\s*'draft'/);
  assert.match(migration, /This migration creates a draft only/);
  assert.doesNotMatch(
    migration,
    /202607190027_complete_marketplace_taxonomy_draft_v2[\s\S]*rawaj_owner_publish_taxonomy_version\(/,
  );
});

test("taxonomy V2 covers every active root and maps every legacy subcategory", () => {
  assert.match(migration, /from public\.categories category_row/);
  assert.match(migration, /from public\.subcategories subcategory_row/);
  assert.match(migration, /insert into public\.taxonomy_legacy_mappings/);
  assert.match(migration, /else subcategory_row\.id/);
  assert.match(migration, /'mobiles-phones'/);
  assert.match(migration, /'jobs-opportunities'/);
  assert.match(migration, /'realestate-commercial-other'/);
});

test("legacy brand and employment buckets become structured attributes instead of duplicate leaves", () => {
  assert.match(migration, /when 'mobiles-iphone' then 'mobiles-phones'/);
  assert.match(migration, /jsonb_build_object\('electronics_brand', 'Apple'\)/);
  assert.match(migration, /when 'jobs-full-time' then 'jobs-opportunities'/);
  assert.match(migration, /jsonb_build_object\('employment_type', 'full_time'\)/);
  assert.match(migration, /when 'jobs-remote' then jsonb_build_object\('remote_mode', 'remote'\)/);
});

test("every active leaf receives schema-driven studio, detail, and filter rules", () => {
  assert.match(migration, /with schema_rules as/);
  assert.match(migration, /join schema_rules schema_rule/);
  assert.match(migration, /leaf_row\.is_active\s*\n\s*and leaf_row\.is_leaf/);
  assert.match(migration, /'listing_studio', 'search_filter', 'comparison'/);
  assert.match(migration, /field_row\.is_active/);
});

test("listing attributes are typed, leaf-scoped, and not directly writable by clients", () => {
  assert.match(migration, /create table if not exists public\.listing_attribute_values/);
  assert.match(migration, /num_nonnulls\(value_text, value_numeric, value_boolean, value_date, value_key, value_json\) = 1/);
  assert.match(migration, /listing_attribute_not_allowed_for_taxonomy/);
  assert.match(migration, /listing_attribute_invalid_option/);
  assert.match(migration, /revoke all on table public\.listing_attribute_values from anon, authenticated/);
  assert.match(migration, /grant select on table public\.listing_attribute_values to anon, authenticated/);
  assert.doesNotMatch(
    migration,
    /grant (?:insert|update|delete|all) on table public\.listing_attribute_values to anon, authenticated/,
  );
});

test("vehicle attribute relationships remain valid after inserts, updates, and deletes", () => {
  assert.match(migration, /create constraint trigger listing_attribute_values_dependencies/);
  assert.match(migration, /after insert or update or delete/);
  assert.match(migration, /deferrable initially deferred/);
  assert.match(migration, /listing_attribute_vehicle_model_make_mismatch/);
  assert.match(migration, /listing_attribute_vehicle_generation_model_mismatch/);
  assert.match(migration, /listing_attribute_vehicle_trim_model_mismatch/);
  assert.match(migration, /if tg_op = 'DELETE'/);
});

test("legacy mappings enforce category consistency and active leaf targets", () => {
  assert.match(migration, /taxonomy_legacy_mapping_category_mismatch/);
  assert.match(migration, /taxonomy_legacy_mapping_requires_active_leaf/);
  assert.match(migration, /create trigger taxonomy_legacy_mappings_validate/);
});

test("sensitive attributes cannot become public through a public listing", () => {
  assert.match(migration, /not field_row\.is_sensitive/);
  assert.match(migration, /listing_attribute_values_visible_with_listing/);
});

test("foundation trigger helpers pin search_path and are not directly executable", () => {
  for (const signature of [
    "rawaj_touch_taxonomy_foundation_updated_at",
    "rawaj_validate_listing_attribute_value",
    "rawaj_enforce_listing_attribute_dependencies",
    "rawaj_validate_taxonomy_legacy_mapping",
  ]) {
    assert.match(migration, new RegExp(`function public\\.${signature}\\(\\)`));
  }
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(
    migration,
    /revoke all on function public\.rawaj_touch_taxonomy_foundation_updated_at\(\) from public, anon, authenticated/,
  );
});
