-- RAWAJ Cloudflare D1 catalog foundation.
-- Forward-only SQLite schema for public/read-only marketplace catalogs.
-- PostgreSQL RLS, functions, triggers, auth tables, and transactional data are intentionally excluded.

PRAGMA foreign_keys = ON;

CREATE TABLE rawaj_catalog_sync_state (
  domain TEXT PRIMARY KEY,
  source_snapshot_at TEXT,
  source_row_count INTEGER NOT NULL DEFAULT 0 CHECK (source_row_count >= 0),
  source_checksum_sha256 TEXT,
  synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  hint_ar TEXT,
  hint_en TEXT,
  placeholder TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_categories_active_sort
  ON categories (is_active, sort_order, id);

CREATE TABLE subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_subcategories_category_sort
  ON subcategories (category_id, sort_order, id);

CREATE TABLE governorates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  districts_ar TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(districts_ar)),
  districts_en TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(districts_en)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_governorates_active_sort
  ON governorates (is_active, sort_order, id);

CREATE TABLE taxonomy_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  icon_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_leaf INTEGER NOT NULL DEFAULT 0 CHECK (is_leaf IN (0, 1)),
  filter_schema_key TEXT,
  classification_key TEXT,
  classification_value TEXT,
  legacy_category_id TEXT,
  legacy_subcategory_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (parent_id) REFERENCES taxonomy_nodes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (legacy_category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (legacy_subcategory_id) REFERENCES subcategories(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_taxonomy_nodes_parent_active_sort
  ON taxonomy_nodes (parent_id, is_active, sort_order, id);
CREATE INDEX idx_taxonomy_nodes_leaf_active
  ON taxonomy_nodes (is_leaf, is_active, id);
CREATE INDEX idx_taxonomy_nodes_legacy
  ON taxonomy_nodes (legacy_category_id, legacy_subcategory_id);

CREATE TABLE option_sets (
  key TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  provider_key TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE field_definitions (
  key TEXT PRIMARY KEY,
  label_ar TEXT NOT NULL,
  label_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  placeholder_ar TEXT,
  placeholder_en TEXT,
  field_type TEXT NOT NULL,
  unit_key TEXT,
  option_set_key TEXT,
  data_provider_key TEXT,
  validation_schema TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(validation_schema)),
  is_searchable INTEGER NOT NULL DEFAULT 0 CHECK (is_searchable IN (0, 1)),
  is_filterable INTEGER NOT NULL DEFAULT 0 CHECK (is_filterable IN (0, 1)),
  is_displayable INTEGER NOT NULL DEFAULT 1 CHECK (is_displayable IN (0, 1)),
  is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (option_set_key) REFERENCES option_sets(key) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_field_definitions_active_sort
  ON field_definitions (is_active, sort_order, key);
CREATE INDEX idx_field_definitions_capabilities
  ON field_definitions (is_searchable, is_filterable, is_displayable);

CREATE TABLE option_values (
  option_set_key TEXT NOT NULL,
  value_key TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  label_en TEXT,
  aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (option_set_key, value_key),
  FOREIGN KEY (option_set_key) REFERENCES option_sets(key) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_option_values_active_sort
  ON option_values (option_set_key, is_active, sort_order, value_key);

CREATE TABLE vehicle_makes (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases)),
  country_code TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_vehicle_makes_active_sort
  ON vehicle_makes (is_active, sort_order, id);

CREATE TABLE vehicle_models (
  id TEXT PRIMARY KEY,
  make_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases)),
  vehicle_type TEXT,
  start_year INTEGER,
  end_year INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (make_id, slug),
  CHECK (start_year IS NULL OR start_year >= 1886),
  CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year),
  FOREIGN KEY (make_id) REFERENCES vehicle_makes(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_vehicle_models_make_active_sort
  ON vehicle_models (make_id, is_active, sort_order, id);

CREATE TABLE vehicle_generations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases)),
  start_year INTEGER,
  end_year INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, model_id),
  UNIQUE (model_id, slug),
  CHECK (start_year IS NULL OR start_year >= 1886),
  CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year),
  FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_vehicle_generations_model_active_sort
  ON vehicle_generations (model_id, is_active, sort_order, id);

CREATE TABLE vehicle_trims (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  generation_id TEXT,
  slug TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases)),
  start_year INTEGER,
  end_year INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (model_id, slug),
  CHECK (start_year IS NULL OR start_year >= 1886),
  CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year),
  FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (generation_id, model_id)
    REFERENCES vehicle_generations(id, model_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_vehicle_trims_model_active_sort
  ON vehicle_trims (model_id, is_active, sort_order, id);
CREATE INDEX idx_vehicle_trims_generation
  ON vehicle_trims (generation_id, model_id);
