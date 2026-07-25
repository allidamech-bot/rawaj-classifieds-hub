-- RAWAJ Cloudflare admin governance workspace.
-- Fresh D1 system of record for campaigns, safety operations, taxonomy review,
-- vehicle reference review, and listing data-quality governance.

PRAGMA foreign_keys = ON;

CREATE TABLE ad_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  starts_at TEXT,
  ends_at TEXT,
  target_pages TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(target_pages)),
  target_category_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(target_category_ids)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_ad_campaigns_status_schedule
  ON ad_campaigns (status, starts_at, ends_at, updated_at DESC);

CREATE TABLE ad_campaign_creatives (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  image_url TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100 CHECK (weight BETWEEN 1 AND 1000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_ad_campaign_creatives_campaign
  ON ad_campaign_creatives (campaign_id, is_active, weight DESC, updated_at DESC);

CREATE TABLE ad_campaign_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  creative_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  page TEXT NOT NULL CHECK (page IN ('home', 'search_results', 'listing_detail', 'categories', 'offers')),
  device TEXT NOT NULL CHECK (device IN ('mobile', 'desktop')),
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (creative_id) REFERENCES ad_campaign_creatives(id) ON DELETE CASCADE
);

CREATE INDEX idx_ad_campaign_events_campaign_type
  ON ad_campaign_events (campaign_id, event_type, occurred_at DESC);
CREATE INDEX idx_ad_campaign_events_creative_type
  ON ad_campaign_events (creative_id, event_type, occurred_at DESC);

CREATE TABLE safety_cases (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'listing_report', 'message_report', 'account')),
  source_id TEXT,
  subject_user_id TEXT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
  summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 6000),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'closed')),
  assigned_to TEXT,
  resolution_note TEXT CHECK (resolution_note IS NULL OR length(resolution_note) <= 6000),
  escalated_to_owner INTEGER NOT NULL DEFAULT 0 CHECK (escalated_to_owner IN (0, 1)),
  escalated_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY (subject_user_id) REFERENCES auth_users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES auth_users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_safety_cases_source_unique
  ON safety_cases (source_type, source_id)
  WHERE source_id IS NOT NULL AND source_type <> 'manual';
CREATE INDEX idx_safety_cases_status_severity
  ON safety_cases (status, severity, updated_at DESC);
CREATE INDEX idx_safety_cases_assignee
  ON safety_cases (assigned_to, status, updated_at DESC);

CREATE TABLE safety_case_notes (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  note TEXT NOT NULL CHECK (length(trim(note)) BETWEEN 2 AND 4000),
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES safety_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_safety_case_notes_case
  ON safety_case_notes (case_id, created_at DESC);

CREATE TABLE safety_case_links (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('listing_report', 'message_report', 'listing', 'account')),
  link_id TEXT NOT NULL CHECK (length(trim(link_id)) BETWEEN 1 AND 200),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (case_id, link_type, link_id),
  FOREIGN KEY (case_id) REFERENCES safety_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_safety_case_links_case
  ON safety_case_links (case_id, created_at DESC);

CREATE TABLE taxonomy_versions (
  id TEXT PRIMARY KEY,
  version_number INTEGER NOT NULL UNIQUE CHECK (version_number > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  change_summary TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO taxonomy_versions (
  id, version_number, status, change_summary, published_at, created_at, updated_at
) VALUES (
  'cloudflare-catalog-v1',
  1,
  'published',
  'Cloudflare D1 catalog baseline',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

CREATE TABLE taxonomy_mapping_queue (
  listing_id TEXT PRIMARY KEY,
  current_taxonomy_node_id TEXT,
  suggested_version_id TEXT,
  suggested_taxonomy_node_id TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'auto_mapped', 'needs_review', 'confirmed', 'unresolved', 'rejected', 'applied')),
  mapping_source TEXT NOT NULL DEFAULT 'manual_review',
  evidence TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence)),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  reviewed_listing_updated_at TEXT,
  applied_by TEXT,
  applied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (current_taxonomy_node_id) REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  FOREIGN KEY (suggested_version_id) REFERENCES taxonomy_versions(id) ON DELETE SET NULL,
  FOREIGN KEY (suggested_taxonomy_node_id) REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  FOREIGN KEY (applied_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_taxonomy_mapping_queue_status
  ON taxonomy_mapping_queue (status, confidence DESC, updated_at DESC);

CREATE TABLE vehicle_reference_review_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('make', 'model', 'generation', 'trim')),
  parent_make_id TEXT,
  parent_model_id TEXT,
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  suggested_match_id TEXT,
  listing_id TEXT,
  requested_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'created', 'rejected', 'applied')),
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  reviewed_listing_updated_at TEXT,
  applied_by TEXT,
  applied_at TEXT,
  created_reference_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_make_id) REFERENCES vehicle_makes(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_model_id) REFERENCES vehicle_models(id) ON DELETE SET NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  FOREIGN KEY (applied_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_vehicle_reference_queue_status
  ON vehicle_reference_review_queue (status, entity_type, occurrence_count DESC, updated_at DESC);

CREATE TABLE listing_data_quality_issues (
  id TEXT PRIMARY KEY,
  issue_key TEXT NOT NULL UNIQUE,
  listing_id TEXT NOT NULL,
  taxonomy_version_id TEXT NOT NULL,
  taxonomy_node_id TEXT,
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  field_key TEXT,
  issue_type TEXT NOT NULL CHECK (
    issue_type IN ('taxonomy', 'required_field', 'unexpected_field', 'invalid_value', 'legacy_payload', 'specialized_reference')
  ),
  issue_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'blocking')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'needs_review', 'seller_action', 'dismissed', 'resolved')),
  evidence TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence)),
  detected_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 2000),
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY (taxonomy_version_id) REFERENCES taxonomy_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (taxonomy_node_id) REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL,
  FOREIGN KEY (field_key) REFERENCES field_definitions(key) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_listing_data_quality_status_severity
  ON listing_data_quality_issues (status, severity, updated_at DESC, id);
CREATE INDEX idx_listing_data_quality_category_status
  ON listing_data_quality_issues (category_id, status, updated_at DESC, id);
CREATE INDEX idx_listing_data_quality_listing
  ON listing_data_quality_issues (listing_id, taxonomy_version_id, status);
