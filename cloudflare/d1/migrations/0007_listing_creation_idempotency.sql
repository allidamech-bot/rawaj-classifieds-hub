PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS listing_creation_requests (
  user_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, request_id),
  UNIQUE (listing_id),
  FOREIGN KEY (user_id) REFERENCES public_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listing_creation_requests_listing
  ON listing_creation_requests (listing_id);
