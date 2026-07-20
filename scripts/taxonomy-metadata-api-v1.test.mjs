import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/202607190033_taxonomy_metadata_api_v1.sql", import.meta.url),
  "utf8",
);

test("published taxonomy API never exposes draft or inactive nodes", () => {
  assert.match(migration, /rawaj_fetch_published_taxonomy_v1/);
  assert.match(migration, /version_row\.status = 'published'/);
  assert.match(migration, /where node_row\.is_active/);
  assert.match(migration, /order by node_row\.depth, node_row\.sort_order, node_row\.node_id/);
  assert.doesNotMatch(migration, /status in \('published', 'draft'\)/);
});

test("taxonomy tree DTO includes stable hierarchy, schema, classification, and SEO metadata", () => {
  for (const key of [
    "'id', node_row.node_id",
    "'parentId', node_row.parent_node_id",
    "'slug', node_row.slug",
    "'isLeaf', node_row.is_leaf",
    "'filterSchemaKey', node_row.filter_schema_key",
    "'displaySchemaKey', node_row.display_schema_key",
    "'classificationKey', node_row.classification_key",
    "'classificationValue', node_row.classification_value",
    "'seoTitleAr', node_row.seo_title_ar",
    "'seoDescriptionEn', node_row.seo_description_en",
  ]) {
    assert.match(migration, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("leaf schema API returns only an active published leaf", () => {
  assert.match(migration, /rawaj_fetch_published_leaf_schema_v1/);
  assert.match(migration, /node_row\.node_id = nullif\(btrim\(p_taxonomy_node_id\), ''\)/);
  assert.match(migration, /and node_row\.is_active/);
  assert.match(migration, /and node_row\.is_leaf/);
  assert.match(migration, /'found', exists \(select 1 from selected_leaf\)/);
});

test("leaf fields include rules, merged validation, options, providers, and conditional rules", () => {
  assert.match(migration, /field_row\.validation_schema \|\| field_row\.validation_override/);
  assert.match(migration, /'optionSetKey', field_row\.option_set_key/);
  assert.match(migration, /'dataProviderKey', field_row\.data_provider_key/);
  assert.match(migration, /from public\.option_values option_row/);
  assert.match(migration, /and option_row\.is_active/);
  assert.match(migration, /from public\.field_conditional_rules condition_row/);
  assert.match(migration, /where condition_row\.is_active/);
  assert.match(migration, /'displaySurfaces', field_row\.display_surfaces/);
});

test("vehicle lookups are bounded, active, dependent, searchable, and year-aware", () => {
  assert.match(migration, /rawaj_fetch_vehicle_makes_v1/);
  assert.match(migration, /greatest\(1, least\(coalesce\(p_limit, 100\), 200\)\)/);
  assert.match(migration, /from unnest\(make_row\.aliases\)/);
  assert.match(migration, /rawaj_fetch_vehicle_models_v1/);
  assert.match(migration, /model_row\.make_id = input_row\.make_id/);
  assert.match(migration, /greatest\(1, least\(coalesce\(p_limit, 200\), 300\)\)/);
  assert.match(migration, /model_row\.start_year is null or model_row\.start_year <= input_row\.model_year/);
  assert.match(migration, /model_row\.end_year is null or model_row\.end_year >= input_row\.model_year/);
  assert.match(migration, /from unnest\(model_row\.aliases\)/);
});

test("generation and trim lookup requires an active controlled model", () => {
  assert.match(migration, /rawaj_fetch_vehicle_model_children_v1/);
  assert.match(migration, /where model_row\.id = nullif\(btrim\(p_model_id\), ''\)/);
  assert.match(migration, /and model_row\.is_active/);
  assert.match(migration, /from public\.vehicle_generations generation_row/);
  assert.match(migration, /from public\.vehicle_trims trim_row/);
  assert.match(migration, /'found', exists \(select 1 from selected_model\)/);
});

test("metadata APIs are read-only public entry points with pinned search paths", () => {
  for (const signature of [
    "rawaj_fetch_published_taxonomy_v1\\(\\)",
    "rawaj_fetch_published_leaf_schema_v1\\(text\\)",
    "rawaj_fetch_vehicle_makes_v1\\(text, integer\\)",
    "rawaj_fetch_vehicle_models_v1\\(text, text, integer, integer\\)",
    "rawaj_fetch_vehicle_model_children_v1\\(text, integer\\)",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature}\\s+from public`),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${signature}\\s+to anon, authenticated`),
    );
  }

  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.doesNotMatch(migration, /insert into|update public\.|delete from/i);
});
