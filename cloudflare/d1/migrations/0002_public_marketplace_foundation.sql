-- RAWAJ Cloudflare D1 public marketplace foundation.
-- This schema is the canonical read model for public marketplace traffic.
-- Private authentication, moderation, messaging, and write-side state are migrated in later phases.

PRAGMA foreign_keys = ON;

CREATE TABLE rawaj_import_batches (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_snapshot_at TEXT NOT NULL,
  source_checksum_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared', 'importing', 'verified', 'failed')),
  counts_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(counts_json)),
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT,
  failure_reason TEXT
);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 TEXT NOT NULL,
  etag TEXT,
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'quarantined', 'deleted')),
  source_storage_path TEXT,
  imported_batch_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (imported_batch_id) REFERENCES rawaj_import_batches(id) ON DELETE SET NULL
);

CREATE INDEX idx_media_assets_owner_status
  ON media_assets (owner_id, status, created_at DESC);
CREATE INDEX idx_media_assets_checksum
  ON media_assets (checksum_sha256, byte_size);

CREATE TABLE public_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  business_name TEXT,
  bio TEXT,
  governorate TEXT,
  city_area TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  account_status TEXT NOT NULL DEFAULT 'pending_review',
  avatar_asset_id TEXT,
  cover_asset_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  imported_batch_id TEXT,
  FOREIGN KEY (avatar_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  FOREIGN KEY (cover_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL,
  FOREIGN KEY (imported_batch_id) REFERENCES rawaj_import_batches(id) ON DELETE SET NULL
);

CREATE INDEX idx_public_profiles_status
  ON public_profiles (account_status, verification_status, created_at DESC);

CREATE TABLE location_regions (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'SY',
  slug TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  region_type TEXT NOT NULL DEFAULT 'vernacular',
  is_complete INTEGER NOT NULL DEFAULT 0 CHECK (is_complete IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  source_name TEXT,
  source_url TEXT,
  source_note TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (country_code, slug)
);

CREATE TABLE location_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  country_code TEXT NOT NULL DEFAULT 'SY',
  node_type TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  slug TEXT NOT NULL,
  official_code TEXT,
  external_source TEXT,
  external_id TEXT,
  latitude REAL,
  longitude REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  search_aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(search_aliases)),
  legacy_governorate_id TEXT,
  legacy_district_ar TEXT,
  source_url TEXT,
  source_date TEXT,
  confidence TEXT,
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (parent_id, slug),
  FOREIGN KEY (parent_id) REFERENCES location_nodes(id) ON DELETE RESTRICT
);

CREATE INDEX idx_location_nodes_parent_active_sort
  ON location_nodes (parent_id, is_active, sort_order, name_ar);
CREATE INDEX idx_location_nodes_legacy
  ON location_nodes (legacy_governorate_id, legacy_district_ar);
CREATE INDEX idx_location_nodes_type_active
  ON location_nodes (country_code, node_type, is_active);

CREATE TABLE location_region_members (
  region_id TEXT NOT NULL,
  location_node_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'member',
  source_name TEXT,
  source_url TEXT,
  source_note TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  created_at TEXT NOT NULL,
  PRIMARY KEY (region_id, location_node_id),
  FOREIGN KEY (region_id) REFERENCES location_regions(id) ON DELETE CASCADE,
  FOREIGN KEY (location_node_id) REFERENCES location_nodes(id) ON DELETE CASCADE
);

CREATE TABLE location_search_aliases (
  id TEXT PRIMARY KEY,
  location_node_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  language_code TEXT,
  alias_type TEXT NOT NULL DEFAULT 'alternate_name',
  source_name TEXT,
  source_url TEXT,
  source_note TEXT,
  confidence TEXT NOT NULL DEFAULT 'medium',
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (location_node_id, normalized_alias),
  FOREIGN KEY (location_node_id) REFERENCES location_nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_location_aliases_normalized
  ON location_search_aliases (normalized_alias, location_node_id);

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  governorate_id TEXT NOT NULL,
  location_node_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price REAL,
  currency TEXT NOT NULL DEFAULT 'SYP',
  price_type TEXT NOT NULL DEFAULT 'fixed',
  listing_condition TEXT NOT NULL DEFAULT 'not_applicable',
  status TEXT NOT NULL,
  district_ar TEXT,
  contact_name TEXT,
  contact_options TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(contact_options)),
  details TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  featured_until TEXT,
  published_at TEXT,
  archived_at TEXT,
  reserved_at TEXT,
  expires_at TEXT,
  renewed_at TEXT,
  expiry_days INTEGER CHECK (expiry_days IS NULL OR expiry_days IN (30, 60, 90)),
  search_text_normalized TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  imported_batch_id TEXT,
  FOREIGN KEY (owner_id) REFERENCES public_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE RESTRICT,
  FOREIGN KEY (governorate_id) REFERENCES governorates(id) ON DELETE RESTRICT,
  FOREIGN KEY (location_node_id) REFERENCES location_nodes(id) ON DELETE SET NULL,
  FOREIGN KEY (imported_batch_id) REFERENCES rawaj_import_batches(id) ON DELETE SET NULL
);

CREATE INDEX idx_listings_public_latest
  ON listings (status, archived_at, expires_at, created_at DESC, id DESC);
CREATE INDEX idx_listings_public_featured
  ON listings (status, is_featured DESC, created_at DESC, id DESC);
CREATE INDEX idx_listings_category
  ON listings (status, category_id, subcategory_id, created_at DESC);
CREATE INDEX idx_listings_location
  ON listings (status, governorate_id, location_node_id, district_ar);
CREATE INDEX idx_listings_price
  ON listings (status, price_type, price, id);

CREATE TABLE listing_taxonomy_assignments (
  listing_id TEXT NOT NULL,
  taxonomy_node_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (listing_id, taxonomy_node_id),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (taxonomy_node_id) REFERENCES taxonomy_nodes(id) ON DELETE RESTRICT
);

CREATE INDEX idx_listing_taxonomy_node
  ON listing_taxonomy_assignments (taxonomy_node_id, listing_id);

CREATE TABLE listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  media_asset_id TEXT NOT NULL,
  alt_ar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (listing_id, sort_order),
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT
);

CREATE INDEX idx_listing_images_listing_order
  ON listing_images (listing_id, sort_order, id);

CREATE TABLE ad_placements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  placement_page TEXT NOT NULL,
  media_asset_id TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  priority INTEGER NOT NULL DEFAULT 0,
  target_mobile INTEGER NOT NULL DEFAULT 1 CHECK (target_mobile IN (0, 1)),
  target_desktop INTEGER NOT NULL DEFAULT 1 CHECK (target_desktop IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  imported_batch_id TEXT,
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (imported_batch_id) REFERENCES rawaj_import_batches(id) ON DELETE SET NULL
);

CREATE INDEX idx_ad_placements_active
  ON ad_placements (placement_page, status, starts_at, ends_at, priority DESC, id);

CREATE VIRTUAL TABLE listings_fts USING fts5(
  listing_id UNINDEXED,
  title,
  description,
  search_text_normalized,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER listings_fts_after_insert
AFTER INSERT ON listings
BEGIN
  INSERT INTO listings_fts (listing_id, title, description, search_text_normalized)
  VALUES (new.id, new.title, new.description, new.search_text_normalized);
END;

CREATE TRIGGER listings_fts_after_delete
AFTER DELETE ON listings
BEGIN
  DELETE FROM listings_fts WHERE listing_id = old.id;
END;

CREATE TRIGGER listings_fts_after_update
AFTER UPDATE OF title, description, search_text_normalized ON listings
BEGIN
  DELETE FROM listings_fts WHERE listing_id = old.id;
  INSERT INTO listings_fts (listing_id, title, description, search_text_normalized)
  VALUES (new.id, new.title, new.description, new.search_text_normalized);
END;
