PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO public_profiles
  (id, display_name, verification_status, account_status, created_at, updated_at)
VALUES
  ('rehearsal-buyer', 'Rehearsal Buyer', 'unverified', 'active',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('rehearsal-seller', 'Rehearsal Seller', 'verified', 'active',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('rehearsal-firebase', 'Rehearsal Firebase', 'unverified', 'active',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO auth_users
  (id, email, email_normalized, created_at, updated_at, auth_provider, auth_user_id)
VALUES
  ('rehearsal-buyer', 'buyer@example.test', 'buyer@example.test',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
   'supabase', 'rehearsal-buyer'),
  ('rehearsal-seller', 'seller@example.test', 'seller@example.test',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
   'supabase', 'rehearsal-seller'),
  ('rehearsal-firebase', 'firebase@example.test', 'firebase@example.test',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
   'firebase', 'rehearsal-firebase');

INSERT OR IGNORE INTO user_roles (user_id, role, created_at)
VALUES
  ('rehearsal-buyer', 'user', '2026-01-01T00:00:00.000Z'),
  ('rehearsal-seller', 'seller', '2026-01-01T00:00:00.000Z'),
  ('rehearsal-firebase', 'user', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO listings
  (id, owner_id, category_id, subcategory_id, governorate_id, title, description,
   price, currency, price_type, listing_condition, status, contact_options, details,
   is_featured, search_text_normalized, created_at, updated_at)
VALUES
  ('f06e2d10-d6b1-495b-957e-82aa7c3b4f3c', 'rehearsal-seller',
   'test-category', 'test-subcategory', 'test-governorate', 'Protected draft 1',
   'Protected reconciliation fixture', 100, 'SYP', 'fixed', 'used', 'draft', '{}', '{}',
   0, 'protected draft 1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('1a6da03a-1cc2-4b64-a14e-182c792f8dfd', 'rehearsal-seller',
   'test-category', 'test-subcategory', 'test-governorate', 'Protected draft 2',
   'Protected reconciliation fixture', 100, 'SYP', 'fixed', 'used', 'draft', '{}', '{}',
   0, 'protected draft 2', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('9e738966-5f41-481b-8af6-b8358701b331', 'rehearsal-seller',
   'test-category', 'test-subcategory', 'test-governorate', 'Protected draft 3',
   'Protected reconciliation fixture', 100, 'SYP', 'fixed', 'used', 'draft', '{}', '{}',
   0, 'protected draft 3', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('867e6932-73ff-4a4f-b730-d1ec816a9c2d', 'rehearsal-seller',
   'test-category', 'test-subcategory', 'test-governorate', 'Protected draft 4',
   'Protected reconciliation fixture', 100, 'SYP', 'fixed', 'used', 'draft', '{}', '{}',
   0, 'protected draft 4', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('98d65b0e-b491-44bf-a286-2726749fc028', 'rehearsal-seller',
   'test-category', 'test-subcategory', 'test-governorate', 'Protected draft 5',
   'Protected reconciliation fixture', 100, 'SYP', 'fixed', 'used', 'draft', '{}', '{}',
   0, 'protected draft 5', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('339ae87b-77e9-4bba-91f6-1d461b27f7fa', 'rehearsal-seller',
   'test-category', 'test-subcategory', 'test-governorate', 'Protected draft 6',
   'Protected reconciliation fixture', 100, 'SYP', 'fixed', 'used', 'draft', '{}', '{}',
   0, 'protected draft 6', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('8df376e2-e0e5-415d-af89-6a1660096904', 'rehearsal-seller',
   'test-category', 'test-subcategory', 'test-governorate', 'Protected draft 7',
   'Protected reconciliation fixture', 100, 'SYP', 'fixed', 'used', 'draft', '{}', '{}',
   0, 'protected draft 7', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO conversations
  (id, listing_id, buyer_id, seller_id, status, last_message_at, created_at, updated_at)
VALUES
  ('rehearsal-conversation', 'test-public-listing', 'rehearsal-buyer', 'rehearsal-seller',
   'active', '2026-01-01T00:02:00.000Z', '2026-01-01T00:00:00.000Z',
   '2026-01-01T00:02:00.000Z');

INSERT OR IGNORE INTO conversation_messages
  (id, conversation_id, sender_id, body, message_type, media_asset_id,
   delivered_at, read_at, deleted_at, created_at, client_request_id)
VALUES
  ('rehearsal-message-1', 'rehearsal-conversation', 'rehearsal-buyer',
   'Fixture message one', 'text', NULL, '2026-01-01T00:01:00.000Z',
   NULL, NULL, '2026-01-01T00:01:00.000Z', 'buyer-request-1'),
  ('rehearsal-message-2', 'rehearsal-conversation', 'rehearsal-seller',
   'Fixture message two', 'text', NULL, '2026-01-01T00:02:00.000Z',
   '2026-01-01T00:03:00.000Z', NULL, '2026-01-01T00:02:00.000Z',
   'seller-request-1');

INSERT OR IGNORE INTO notification_preferences
  (user_id, email_enabled, push_enabled, messages_enabled,
   listing_updates_enabled, marketing_enabled, updated_at)
VALUES
  ('rehearsal-buyer', 1, 0, 1, 1, 0, '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO listing_reports
  (id, listing_id, reporter_id, reason, details, status, created_at)
VALUES
  ('rehearsal-listing-report', 'test-public-listing', 'rehearsal-buyer',
   'fixture', 'Reconciliation fixture', 'open', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO seller_reviews
  (id, seller_id, reviewer_id, listing_id, rating, comment, status, created_at, updated_at)
VALUES
  ('rehearsal-seller-review', 'rehearsal-seller', 'rehearsal-buyer',
   'test-public-listing', 5, 'Fixture review', 'approved',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO support_requests
  (id, user_id, subject, message, status, priority, created_at, updated_at)
VALUES
  ('rehearsal-support-request', 'rehearsal-buyer', 'Fixture support request',
   'Reconciliation fixture', 'open', 'normal',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
