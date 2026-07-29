-- Ensure listing moderation outcomes always create actionable owner notifications.
-- This is intentionally database-owned so the status update, moderation audit, and
-- notification delivery stay in the same D1 transaction regardless of caller.

PRAGMA foreign_keys = ON;

-- Repair previously-created listing notifications that stored a listing id but did
-- not include the canonical targetType/targetId fields consumed by the UI.
UPDATE notifications
SET data = json_set(
  CASE WHEN json_valid(data) THEN data ELSE '{}' END,
  '$.targetType',
  'owner_listing',
  '$.targetId',
  COALESCE(json_extract(data, '$.listingId'), json_extract(data, '$.listing_id'))
)
WHERE json_valid(data)
  AND (type LIKE 'listing.%' OR type IN ('approved', 'rejected', 'expired'))
  AND COALESCE(json_extract(data, '$.targetId'), json_extract(data, '$.target_id')) IS NULL
  AND COALESCE(json_extract(data, '$.listingId'), json_extract(data, '$.listing_id')) IS NOT NULL;

-- Keep future listing notifications actionable even when an older producer only
-- writes listingId/listing_id into the data payload.
DROP TRIGGER IF EXISTS notifications_normalize_listing_target_after_insert;
CREATE TRIGGER notifications_normalize_listing_target_after_insert
AFTER INSERT ON notifications
WHEN json_valid(NEW.data)
  AND (NEW.type LIKE 'listing.%' OR NEW.type IN ('approved', 'rejected', 'expired'))
  AND COALESCE(json_extract(NEW.data, '$.targetId'), json_extract(NEW.data, '$.target_id')) IS NULL
  AND COALESCE(json_extract(NEW.data, '$.listingId'), json_extract(NEW.data, '$.listing_id')) IS NOT NULL
BEGIN
  UPDATE notifications
  SET data = json_set(
    data,
    '$.targetType',
    'owner_listing',
    '$.targetId',
    COALESCE(json_extract(data, '$.listingId'), json_extract(data, '$.listing_id'))
  )
  WHERE id = NEW.id;
END;

-- The moderation endpoint records listing_moderation_actions in the same D1 batch
-- as the listing status transition. Emitting from that durable event prevents a
-- successful approve/reject response from ever completing without a user-facing
-- notification.
DROP TRIGGER IF EXISTS listing_moderation_notify_owner_after_insert;
CREATE TRIGGER listing_moderation_notify_owner_after_insert
AFTER INSERT ON listing_moderation_actions
WHEN NEW.action IN ('approve', 'reject', 'request_changes')
BEGIN
  INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
  SELECT
    lower(hex(randomblob(4))) || '-' ||
      lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', (abs(random()) % 4) + 1, 1) ||
      substr(lower(hex(randomblob(2))), 2) || '-' ||
      lower(hex(randomblob(6))),
    listing.owner_id,
    CASE NEW.action
      WHEN 'approve' THEN 'listing.approved'
      WHEN 'request_changes' THEN 'listing.changes_requested'
      ELSE 'listing.rejected'
    END,
    CASE NEW.action
      WHEN 'approve' THEN 'تم قبول إعلانك'
      WHEN 'request_changes' THEN 'إعلانك يحتاج إلى تعديلات'
      ELSE 'تم رفض إعلانك'
    END,
    CASE NEW.action
      WHEN 'approve' THEN
        'تم قبول إعلانك "' || listing.title || '" وأصبح منشوراً في رواج.'
      WHEN 'request_changes' THEN
        'إعلانك "' || listing.title || '" يحتاج إلى تعديلات قبل النشر.' ||
        CASE
          WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> ''
            THEN ' ملاحظة الإدارة: ' || trim(NEW.reason)
          ELSE ''
        END
      ELSE
        'تم رفض إعلانك "' || listing.title || '".' ||
        CASE
          WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> ''
            THEN ' السبب: ' || trim(NEW.reason)
          ELSE ' راجع الإعلان وعدّله قبل إعادة الإرسال.'
        END
    END,
    json_object(
      'targetType', 'owner_listing',
      'targetId', listing.id,
      'listingId', listing.id,
      'moderationAction', NEW.action,
      'reason', NEW.reason,
      'reviewedAt', NEW.created_at,
      'titleEn', CASE NEW.action
        WHEN 'approve' THEN 'Your listing was approved'
        WHEN 'request_changes' THEN 'Your listing needs changes'
        ELSE 'Your listing was rejected'
      END,
      'bodyEn', CASE NEW.action
        WHEN 'approve' THEN
          'Your listing "' || listing.title || '" was approved and is now live on RAWAJ.'
        WHEN 'request_changes' THEN
          'Your listing "' || listing.title || '" needs changes before it can be published.' ||
          CASE
            WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> ''
              THEN ' Admin note: ' || trim(NEW.reason)
            ELSE ''
          END
        ELSE
          'Your listing "' || listing.title || '" was rejected.' ||
          CASE
            WHEN NEW.reason IS NOT NULL AND trim(NEW.reason) <> ''
              THEN ' Reason: ' || trim(NEW.reason)
            ELSE ' Review and edit the listing before submitting it again.'
          END
      END
    ),
    NEW.created_at
  FROM listings AS listing
  WHERE listing.id = NEW.listing_id
    AND listing.owner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM notifications AS existing
      WHERE existing.user_id = listing.owner_id
        AND existing.type = CASE NEW.action
          WHEN 'approve' THEN 'listing.approved'
          WHEN 'request_changes' THEN 'listing.changes_requested'
          ELSE 'listing.rejected'
        END
        AND existing.created_at = NEW.created_at
        AND COALESCE(
          json_extract(existing.data, '$.targetId'),
          json_extract(existing.data, '$.target_id'),
          json_extract(existing.data, '$.listingId'),
          json_extract(existing.data, '$.listing_id')
        ) = listing.id
    );
END;
