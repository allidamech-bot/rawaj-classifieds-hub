-- Private seller verification requests and R2-backed documents.
PRAGMA foreign_keys = ON;

CREATE TABLE seller_verification_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected')),
  request_type TEXT NOT NULL CHECK (request_type IN ('personal', 'business')),
  legal_name TEXT NOT NULL,
  business_name TEXT,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'national_id', 'passport', 'other_government_id',
      'commercial_registration', 'business_license', 'tax_document'
    )
  ),
  document_asset_id TEXT NOT NULL,
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_asset_id) REFERENCES media_assets(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL,
  UNIQUE (user_id, client_request_id)
);

CREATE UNIQUE INDEX idx_verification_one_pending_per_user
  ON seller_verification_requests (user_id)
  WHERE status = 'pending_review';
CREATE INDEX idx_verification_admin_queue
  ON seller_verification_requests (status, created_at DESC);
