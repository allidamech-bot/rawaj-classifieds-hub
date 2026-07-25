-- Cloudflare trust, support, listing reports, and seller reviews cutover.
PRAGMA foreign_keys = ON;

ALTER TABLE support_requests ADD COLUMN type TEXT NOT NULL DEFAULT 'other'
  CHECK (type IN ('complaint', 'suggestion', 'technical_issue', 'abuse_report', 'other'));
ALTER TABLE support_requests ADD COLUMN related_listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL;
ALTER TABLE support_requests ADD COLUMN related_report_id TEXT REFERENCES listing_reports(id) ON DELETE SET NULL;
ALTER TABLE support_requests ADD COLUMN public_response TEXT;
ALTER TABLE support_requests ADD COLUMN admin_note TEXT;
CREATE INDEX idx_support_requests_user_created
  ON support_requests (user_id, created_at DESC, id DESC);

ALTER TABLE listing_reports ADD COLUMN report_type TEXT NOT NULL DEFAULT 'other'
  CHECK (report_type IN (
    'suspicious_listing', 'fraud', 'prohibited_content', 'abusive_user',
    'misleading_price', 'wrong_info', 'other'
  ));
ALTER TABLE listing_reports ADD COLUMN listing_title_snapshot TEXT;
ALTER TABLE listing_reports ADD COLUMN assigned_to TEXT REFERENCES auth_users(id) ON DELETE SET NULL;
ALTER TABLE listing_reports ADD COLUMN admin_note TEXT;
ALTER TABLE listing_reports ADD COLUMN updated_at TEXT;
UPDATE listing_reports SET updated_at = created_at WHERE updated_at IS NULL;
CREATE INDEX idx_listing_reports_reporter_created
  ON listing_reports (reporter_id, created_at DESC, id DESC);
CREATE INDEX idx_listing_reports_listing_reporter
  ON listing_reports (listing_id, reporter_id, report_type, status);

ALTER TABLE seller_reviews ADD COLUMN traits TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(traits));
ALTER TABLE seller_reviews ADD COLUMN admin_note TEXT;
ALTER TABLE seller_reviews ADD COLUMN reviewed_by TEXT REFERENCES auth_users(id) ON DELETE SET NULL;
ALTER TABLE seller_reviews ADD COLUMN reviewed_at TEXT;
ALTER TABLE seller_reviews ADD COLUMN seller_response TEXT;
ALTER TABLE seller_reviews ADD COLUMN seller_response_updated_at TEXT;
CREATE INDEX idx_seller_reviews_reviewer_created
  ON seller_reviews (reviewer_id, created_at DESC, id DESC);

CREATE TABLE seller_review_reports (
  id TEXT PRIMARY KEY,
  review_id TEXT,
  reporter_user_id TEXT NOT NULL,
  reported_reviewer_user_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('abuse', 'spam', 'misleading', 'personal_data', 'prohibited_content', 'other')
  ),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'under_review', 'resolved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES seller_reviews(id) ON DELETE SET NULL,
  FOREIGN KEY (reporter_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_reviewer_user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_seller_review_reports_open_unique
  ON seller_review_reports (review_id, reporter_user_id)
  WHERE review_id IS NOT NULL AND status IN ('new', 'under_review');
CREATE INDEX idx_seller_review_reports_status
  ON seller_review_reports (status, created_at DESC, id DESC);
