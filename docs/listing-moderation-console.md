# RAWAJ Listing Moderation Console

Protected actions: approve, reject, request changes, suspend, unpublish, archive, expire now, and extend expiry.

Every action requires a reason, checks the loaded `updated_at` value to prevent stale decisions, persists an immutable moderation action row, and writes an audit-log entry.

The migration and UI do not change the Canonical Syria Location Taxonomy or BottomNav.
