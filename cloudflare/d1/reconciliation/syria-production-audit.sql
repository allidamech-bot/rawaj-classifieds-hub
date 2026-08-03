-- Syria production reconciliation report.
-- Aggregate counts only: this file must never print user PII or record contents.

PRAGMA foreign_keys = ON;

SELECT 'count.categories' AS metric, COUNT(*) AS value FROM categories;
SELECT 'count.subcategories' AS metric, COUNT(*) AS value FROM subcategories;
SELECT 'count.governorates' AS metric, COUNT(*) AS value FROM governorates;
SELECT 'count.location_regions' AS metric, COUNT(*) AS value FROM location_regions;
SELECT 'count.location_nodes' AS metric, COUNT(*) AS value FROM location_nodes;
SELECT 'count.public_profiles' AS metric, COUNT(*) AS value FROM public_profiles;
SELECT 'count.auth_users' AS metric, COUNT(*) AS value FROM auth_users;
SELECT 'count.listings' AS metric, COUNT(*) AS value FROM listings;
SELECT 'count.listing_images' AS metric, COUNT(*) AS value FROM listing_images;
SELECT 'count.media_assets' AS metric, COUNT(*) AS value FROM media_assets;
SELECT 'count.conversations' AS metric, COUNT(*) AS value FROM conversations;
SELECT 'count.conversation_messages' AS metric, COUNT(*) AS value FROM conversation_messages;
SELECT 'count.notifications' AS metric, COUNT(*) AS value FROM notifications;
SELECT 'count.seller_reviews' AS metric, COUNT(*) AS value FROM seller_reviews;
SELECT 'count.listing_reports' AS metric, COUNT(*) AS value FROM listing_reports;
SELECT 'count.support_requests' AS metric, COUNT(*) AS value FROM support_requests;

SELECT 'violation.location_regions_non_sy' AS metric, COUNT(*) AS value
  FROM location_regions WHERE country_code <> 'SY';
SELECT 'violation.location_nodes_non_sy' AS metric, COUNT(*) AS value
  FROM location_nodes WHERE country_code <> 'SY';
SELECT 'violation.listings_currency' AS metric, COUNT(*) AS value
  FROM listings WHERE currency NOT IN ('SYP', 'USD');
SELECT 'violation.price_changes_currency' AS metric, COUNT(*) AS value
  FROM listing_price_changes WHERE currency NOT IN ('SYP', 'USD');
SELECT 'violation.favorite_snapshots_currency' AS metric, COUNT(*) AS value
  FROM favorite_listing_snapshots WHERE currency_snapshot NOT IN ('SYP', 'USD');
SELECT 'violation.media_missing_checksum' AS metric, COUNT(*) AS value
  FROM media_assets WHERE checksum_sha256 IS NULL OR trim(checksum_sha256) = '';
SELECT 'violation.media_missing_object_key' AS metric, COUNT(*) AS value
  FROM media_assets WHERE object_key IS NULL OR trim(object_key) = '';
SELECT 'violation.listing_without_profile' AS metric, COUNT(*) AS value
  FROM listings l LEFT JOIN public_profiles p ON p.id = l.owner_id WHERE p.id IS NULL;
SELECT 'violation.listing_image_without_asset' AS metric, COUNT(*) AS value
  FROM listing_images li LEFT JOIN media_assets ma ON ma.id = li.media_asset_id WHERE ma.id IS NULL;
SELECT 'violation.profile_avatar_without_asset' AS metric, COUNT(*) AS value
  FROM public_profiles p LEFT JOIN media_assets ma ON ma.id = p.avatar_asset_id
  WHERE p.avatar_asset_id IS NOT NULL AND ma.id IS NULL;
SELECT 'violation.profile_cover_without_asset' AS metric, COUNT(*) AS value
  FROM public_profiles p LEFT JOIN media_assets ma ON ma.id = p.cover_asset_id
  WHERE p.cover_asset_id IS NOT NULL AND ma.id IS NULL;
SELECT 'violation.conversation_without_buyer' AS metric, COUNT(*) AS value
  FROM conversations c LEFT JOIN auth_users u ON u.id = c.buyer_id WHERE u.id IS NULL;
SELECT 'violation.conversation_without_seller' AS metric, COUNT(*) AS value
  FROM conversations c LEFT JOIN auth_users u ON u.id = c.seller_id WHERE u.id IS NULL;
SELECT 'violation.message_without_conversation' AS metric, COUNT(*) AS value
  FROM conversation_messages m LEFT JOIN conversations c ON c.id = m.conversation_id WHERE c.id IS NULL;
SELECT 'violation.notification_without_user' AS metric, COUNT(*) AS value
  FROM notifications n LEFT JOIN auth_users u ON u.id = n.user_id WHERE u.id IS NULL;

PRAGMA foreign_key_check;
