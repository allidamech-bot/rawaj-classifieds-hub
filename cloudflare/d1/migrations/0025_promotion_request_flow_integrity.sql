-- Keep custom promotion requests administrative until their selected placement is fulfilled,
-- notify the owner about admin decisions, and repair the Syria listing currency contract.
PRAGMA foreign_keys = ON;

-- Search Boost has its own activation trigger. Generic promotion requests must not silently
-- turn every placement type into the same site-wide featured flag.
DROP TRIGGER IF EXISTS listing_promotion_apply_after_approval;

DROP TRIGGER IF EXISTS trg_promotion_decision_owner_notification;
CREATE TRIGGER trg_promotion_decision_owner_notification
AFTER UPDATE OF status ON listing_promotion_requests
WHEN NEW.status IN ('approved', 'rejected')
  AND OLD.status <> NEW.status
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
    NEW.requester_user_id,
    CASE NEW.status
      WHEN 'approved' THEN 'promotion.approved'
      ELSE 'promotion.rejected'
    END,
    CASE NEW.status
      WHEN 'approved' THEN 'تمت الموافقة على طلب الترويج'
      ELSE 'تم رفض طلب الترويج'
    END,
    CASE NEW.status
      WHEN 'approved' THEN
        'تمت الموافقة على طلب ' ||
        CASE
          WHEN NEW.client_request_id GLOB 'search-boost:*' THEN 'Boost'
          WHEN NEW.promotion_type = 'featured_home' THEN 'المساحة الرئيسية'
          WHEN NEW.promotion_type = 'highlighted' THEN 'نتائج البحث'
          WHEN NEW.promotion_type = 'top_category' THEN 'الأقسام'
          ELSE 'الحملة الإعلانية'
        END ||
        ' للإعلان "' || listing.title || '".'
      ELSE
        'تم رفض طلب الترويج للإعلان "' || listing.title || '".' ||
        CASE
          WHEN NEW.admin_note IS NOT NULL AND trim(NEW.admin_note) <> ''
            THEN ' السبب: ' || trim(NEW.admin_note)
          ELSE ''
        END
    END,
    json_object(
      'targetType', 'promotion',
      'targetId', NEW.id,
      'promotionRequestId', NEW.id,
      'listingId', NEW.listing_id,
      'promotionType', NEW.promotion_type,
      'status', NEW.status,
      'adminNote', NEW.admin_note,
      'isSearchBoost', CASE WHEN NEW.client_request_id GLOB 'search-boost:*' THEN 1 ELSE 0 END,
      'titleEn', CASE NEW.status
        WHEN 'approved' THEN 'Promotion request approved'
        ELSE 'Promotion request rejected'
      END,
      'bodyEn', CASE NEW.status
        WHEN 'approved' THEN 'Your promotion request for "' || listing.title || '" was approved.'
        ELSE 'Your promotion request for "' || listing.title || '" was rejected.' ||
          CASE
            WHEN NEW.admin_note IS NOT NULL AND trim(NEW.admin_note) <> ''
              THEN ' Reason: ' || trim(NEW.admin_note)
            ELSE ''
          END
      END
    ),
    COALESCE(NEW.reviewed_at, NEW.updated_at)
  FROM listings AS listing
  WHERE listing.id = NEW.listing_id;
END;

-- The Syria worker accidentally wrote SAR for newly-created drafts. Repair affected rows and
-- protect the database while the runtime fix rolls through all deployments.
UPDATE listings
   SET currency = 'SYP'
 WHERE currency = 'SAR';

DROP TRIGGER IF EXISTS trg_syria_listing_currency_after_insert;
CREATE TRIGGER trg_syria_listing_currency_after_insert
AFTER INSERT ON listings
WHEN NEW.currency = 'SAR'
BEGIN
  UPDATE listings SET currency = 'SYP' WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_syria_listing_currency_after_update;
CREATE TRIGGER trg_syria_listing_currency_after_update
AFTER UPDATE OF currency ON listings
WHEN NEW.currency = 'SAR'
BEGIN
  UPDATE listings SET currency = 'SYP' WHERE id = NEW.id;
END;
