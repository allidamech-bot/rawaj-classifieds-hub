# Notification Center Pagination

The notification center now uses bounded offset pagination instead of silently truncating the user-visible history to the latest 20 rows.

## Behavior

- Initial page size: 20
- Maximum API page size: 50
- `hasMore` is detected by requesting one extra row
- Older notifications load on demand
- Pagination errors preserve already loaded notifications
- Appended pages are deduplicated by notification ID
- Known optimistic read state is re-applied to later pages

## Compatibility

The existing `fetchMyNotifications()` helper remains available for lightweight consumers such as the notification trigger.
