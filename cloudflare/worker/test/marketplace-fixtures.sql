PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO categories
  (id, slug, name_ar, name_en, sort_order, is_active)
VALUES
  ('test-category', 'test-category', 'اختبار', 'Test', 1, 1);

INSERT OR IGNORE INTO subcategories
  (id, category_id, name_ar, name_en, sort_order)
VALUES
  ('test-subcategory', 'test-category', 'فرعي', 'Subcategory', 1);

INSERT OR IGNORE INTO taxonomy_nodes
  (id, slug, name_ar, name_en, depth, is_active, is_leaf,
   legacy_category_id, legacy_subcategory_id)
VALUES
  ('test-taxonomy-leaf', 'test-taxonomy-leaf', 'اختبار', 'Test taxonomy leaf',
   0, 1, 1, 'test-category', 'test-subcategory');

INSERT OR IGNORE INTO governorates
  (id, slug, name_ar, name_en, districts_ar, districts_en, sort_order, is_active)
VALUES
  ('test-governorate', 'test-governorate', 'دمشق', 'Damascus', '[]', '[]', 1, 1);

INSERT OR IGNORE INTO public_profiles
  (id, display_name, verification_status, account_status, created_at, updated_at)
VALUES
  ('test-public-seller', 'بائع الاختبار', 'verified', 'active',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

UPDATE public_profiles
SET email = 'imported-seller@example.test'
WHERE id = 'test-public-seller' AND email IS NULL;

INSERT OR IGNORE INTO auth_users
  (id, email, email_normalized, password_hash, password_algorithm,
   email_confirmed_at, created_at, updated_at)
VALUES
  ('test-public-seller', 'imported-seller@example.test', 'imported-seller@example.test',
   NULL, NULL, NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

UPDATE auth_users
SET password_hash = NULL, password_algorithm = NULL, email_confirmed_at = NULL,
    disabled_at = NULL, updated_at = '2026-01-01T00:00:00.000Z'
WHERE id = 'test-public-seller';

DELETE FROM auth_one_time_tokens WHERE user_id = 'test-public-seller';
DELETE FROM auth_sessions WHERE user_id = 'test-public-seller';

INSERT OR IGNORE INTO user_roles (user_id, role, created_at)
VALUES ('test-public-seller', 'seller', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO listings
  (id, owner_id, category_id, subcategory_id, governorate_id, title, description,
   price, currency, price_type, listing_condition, status, contact_options, details,
   is_featured, search_text_normalized, created_at, updated_at)
VALUES
  ('test-public-listing', 'test-public-seller', 'test-category', 'test-subcategory',
   'test-governorate', 'إعلان اختبار منشور', 'وصف منشور للاختبارات المحلية', 250,
   'SYP', 'fixed', 'used', 'approved', '{}', '{}', 0, 'public integration test',
   '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
