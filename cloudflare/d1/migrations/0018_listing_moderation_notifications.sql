-- Deliver listing moderation decisions to the listing owner and repair legacy
-- notification targets so existing timeline cards become actionable.

PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS trg_listing_moderation_owner_notification;
CREATE TRIGGER trg_listing_moderation_owner_notification
AFTER INSERT ON listing_moderation_actions
WHEN NEW.action IN ('approve', 'reject', 'request_changes')
BEGIN
  INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
  SELECT
    lower(
      hex(randomblob(4)) || '-' ||
      hex(randomblob(2)) || '-' ||
      '4' || substr(hex(randomblob(2)), 2, 3) || '-' ||
      substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2, 3) || '-' ||
      hex(randomblob(6))
    ),
    listing.owner_id,
    CASE NEW.action
      WHEN 'approve' THEN 'listing.approved'
      WHEN 'request_changes' THEN 'listing.changes_requested'
      ELSE 'listing.rejected'
    END,
    CASE NEW.action
      WHEN 'approve' THEN 'تمت الموافقة على إعلانك'
      WHEN 'request_changes' THEN 'إعلانك يحتاج إلى تعديلات'
      ELSE 'تم رفض إعلانك'
    END,
    CASE NEW.action
      WHEN 'approve' THEN 'تمت الموافقة على إعلان "' || listing.title || '" وأصبح منشورًا في رواج.'
      WHEN 'request_changes' THEN
        'يحتاج إعلان "' || listing.title || '" إلى تعديلات قبل النشر.' ||
        CASE
          WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> '' THEN ' الملاحظات: ' || trim(NEW.reason)
          ELSE ''
        END
      ELSE
        'تم رفض إعلان "' || listing.title || '".' ||
        CASE
          WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> '' THEN ' السبب: ' || trim(NEW.reason)
          ELSE ''
        END
    END,
    json_object(
      'targetType', 'owner_listing',
      'targetId', listing.id,
      'listingId', listing.id,
      'moderationAction', NEW.action,
      'reason', NEW.reason,
      'titleEn', CASE NEW.action
        WHEN 'approve' THEN 'Your listing was approved'
        WHEN 'request_changes' THEN 'Your listing needs changes'
        ELSE 'Your listing was rejected'
      END,
      'bodyEn', CASE NEW.action
        WHEN 'approve' THEN 'Your listing "' || listing.title || '" was approved and is now live on RAWAJ.'
        WHEN 'request_changes' THEN
          'Your listing "' || listing.title || '" needs changes before publication.' ||
          CASE
            WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> '' THEN ' Notes: ' || trim(NEW.reason)
            ELSE ''
          END
        ELSE
          'Your listing "' || listing.title || '" was rejected.' ||
          CASE
            WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> '' THEN ' Reason: ' || trim(NEW.reason)
            ELSE ''
          END
      END
    ),
    NEW.created_at
  FROM listings AS listing
  WHERE listing.id = NEW.listing_id;
END;

-- Future inserts from older producers may still carry resource-specific ids
-- without the canonical targetType/targetId pair. Normalize them immediately.
DROP TRIGGER IF EXISTS trg_notification_target_metadata_normalization;
CREATE TRIGGER trg_notification_target_metadata_normalization
AFTER INSERT ON notifications
WHEN
  json_extract(NEW.data, '$.targetType') IS NULL AND
  json_extract(NEW.data, '$.target_type') IS NULL AND
  (
    coalesce(json_extract(NEW.data, '$.listingId'), json_extract(NEW.data, '$.listing_id')) IS NOT NULL OR
    coalesce(json_extract(NEW.data, '$.conversationId'), json_extract(NEW.data, '$.conversation_id')) IS NOT NULL OR
    coalesce(json_extract(NEW.data, '$.sellerId'), json_extract(NEW.data, '$.seller_id')) IS NOT NULL OR
    coalesce(json_extract(NEW.data, '$.savedSearchId'), json_extract(NEW.data, '$.saved_search_id')) IS NOT NULL OR
    coalesce(json_extract(NEW.data, '$.supportRequestId'), json_extract(NEW.data, '$.support_request_id')) IS NOT NULL OR
    coalesce(json_extract(NEW.data, '$.verificationRequestId'), json_extract(NEW.data, '$.verification_request_id')) IS NOT NULL OR
    coalesce(json_extract(NEW.data, '$.promotionRequestId'), json_extract(NEW.data, '$.promotion_request_id')) IS NOT NULL
  )
BEGIN
  UPDATE notifications
  SET data = CASE
    WHEN coalesce(json_extract(data, '$.listingId'), json_extract(data, '$.listing_id')) IS NOT NULL THEN
      json_set(
        data,
        '$.targetType', CASE WHEN type LIKE 'listing.%' THEN 'owner_listing' ELSE 'listing' END,
        '$.targetId', CAST(coalesce(json_extract(data, '$.listingId'), json_extract(data, '$.listing_id')) AS TEXT)
      )
    WHEN coalesce(json_extract(data, '$.conversationId'), json_extract(data, '$.conversation_id')) IS NOT NULL THEN
      json_set(
        data,
        '$.targetType', 'conversation',
        '$.targetId', CAST(coalesce(json_extract(data, '$.conversationId'), json_extract(data, '$.conversation_id')) AS TEXT)
      )
    WHEN coalesce(json_extract(data, '$.sellerId'), json_extract(data, '$.seller_id')) IS NOT NULL THEN
      json_set(
        data,
        '$.targetType', 'seller',
        '$.targetId', CAST(coalesce(json_extract(data, '$.sellerId'), json_extract(data, '$.seller_id')) AS TEXT)
      )
    WHEN coalesce(json_extract(data, '$.savedSearchId'), json_extract(data, '$.saved_search_id')) IS NOT NULL THEN
      json_set(
        data,
        '$.targetType', 'saved_search',
        '$.targetId', CAST(coalesce(json_extract(data, '$.savedSearchId'), json_extract(data, '$.saved_search_id')) AS TEXT)
      )
    WHEN coalesce(json_extract(data, '$.supportRequestId'), json_extract(data, '$.support_request_id')) IS NOT NULL THEN
      json_set(
        data,
        '$.targetType', 'support',
        '$.targetId', CAST(coalesce(json_extract(data, '$.supportRequestId'), json_extract(data, '$.support_request_id')) AS TEXT)
      )
    WHEN coalesce(json_extract(data, '$.verificationRequestId'), json_extract(data, '$.verification_request_id')) IS NOT NULL THEN
      json_set(
        data,
        '$.targetType', 'verification',
        '$.targetId', CAST(coalesce(json_extract(data, '$.verificationRequestId'), json_extract(data, '$.verification_request_id')) AS TEXT)
      )
    WHEN coalesce(json_extract(data, '$.promotionRequestId'), json_extract(data, '$.promotion_request_id')) IS NOT NULL THEN
      json_set(
        data,
        '$.targetType', 'promotion',
        '$.targetId', CAST(coalesce(json_extract(data, '$.promotionRequestId'), json_extract(data, '$.promotion_request_id')) AS TEXT)
      )
    ELSE data
  END
  WHERE id = NEW.id;
END;

-- Repair rows already present in D1 so the current notification timeline can
-- open them without waiting for a new event.
UPDATE notifications
SET data = CASE
  WHEN coalesce(json_extract(data, '$.listingId'), json_extract(data, '$.listing_id')) IS NOT NULL THEN
    json_set(
      data,
      '$.targetType', CASE WHEN type LIKE 'listing.%' THEN 'owner_listing' ELSE 'listing' END,
      '$.targetId', CAST(coalesce(json_extract(data, '$.listingId'), json_extract(data, '$.listing_id')) AS TEXT)
    )
  WHEN coalesce(json_extract(data, '$.conversationId'), json_extract(data, '$.conversation_id')) IS NOT NULL THEN
    json_set(
      data,
      '$.targetType', 'conversation',
      '$.targetId', CAST(coalesce(json_extract(data, '$.conversationId'), json_extract(data, '$.conversation_id')) AS TEXT)
    )
  WHEN coalesce(json_extract(data, '$.sellerId'), json_extract(data, '$.seller_id')) IS NOT NULL THEN
    json_set(
      data,
      '$.targetType', 'seller',
      '$.targetId', CAST(coalesce(json_extract(data, '$.sellerId'), json_extract(data, '$.seller_id')) AS TEXT)
    )
  WHEN coalesce(json_extract(data, '$.savedSearchId'), json_extract(data, '$.saved_search_id')) IS NOT NULL THEN
    json_set(
      data,
      '$.targetType', 'saved_search',
      '$.targetId', CAST(coalesce(json_extract(data, '$.savedSearchId'), json_extract(data, '$.saved_search_id')) AS TEXT)
    )
  WHEN coalesce(json_extract(data, '$.supportRequestId'), json_extract(data, '$.support_request_id')) IS NOT NULL THEN
    json_set(
      data,
      '$.targetType', 'support',
      '$.targetId', CAST(coalesce(json_extract(data, '$.supportRequestId'), json_extract(data, '$.support_request_id')) AS TEXT)
    )
  WHEN coalesce(json_extract(data, '$.verificationRequestId'), json_extract(data, '$.verification_request_id')) IS NOT NULL THEN
    json_set(
      data,
      '$.targetType', 'verification',
      '$.targetId', CAST(coalesce(json_extract(data, '$.verificationRequestId'), json_extract(data, '$.verification_request_id')) AS TEXT)
    )
  WHEN coalesce(json_extract(data, '$.promotionRequestId'), json_extract(data, '$.promotion_request_id')) IS NOT NULL THEN
    json_set(
      data,
      '$.targetType', 'promotion',
      '$.targetId', CAST(coalesce(json_extract(data, '$.promotionRequestId'), json_extract(data, '$.promotion_request_id')) AS TEXT)
    )
  ELSE data
END
WHERE
  json_extract(data, '$.targetType') IS NULL AND
  json_extract(data, '$.target_type') IS NULL;
