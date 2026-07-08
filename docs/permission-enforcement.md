# RAWAJ Role Permission Enforcement

The effective permission matrix is derived from persisted roles only for active accounts.

- Owner: sole sensitive authority, staff provisioning, full bans, commercial/system controls.
- Admin: operational authority bounded by explicit permissions; no owner or autonomous staff management.
- Moderator: queue/content moderation only where explicitly permitted; no user management, full audit feed, staff, commercial, campaign, or system authority.

Sensitive operations are enforced in UI visibility/guards and again inside database/RPC authority checks. `current_user_is_admin_like()` is not accepted as a substitute for owner/admin authority on user-management or owner-sensitive operations.
