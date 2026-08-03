# Saudi infrastructure and administration closure

This release contract prevents the Saudi marketplace infrastructure from being considered closed until production verifies all of the following:

- Firebase email/password success and negative cases, invalid-token rejection, persisted sessions, password reset, Google OAuth entry, and browser logout.
- Cloudflare Worker routing, Service Binding behavior, CORS, D1 readiness, R2 upload/read/delete, and Saudi resource identities.
- Ordinary-user denial and moderator, administrator, and owner authorization boundaries.
- Live Saudi administration UI access for an owner account and denial after logout.
- Listing draft creation, final taxonomy assignment, required category data, image upload, submission, moderation approval/rejection, public publication, and audit records.
- SAR enforcement and isolation from the Syrian marketplace.
- Automatic cleanup of disposable Firebase, D1, R2, listing, moderation, and audit data.
- Non-destructive Cloudflare deployment inventory checks for rollback readiness.
- Scheduled public monitoring for health, references, key pages, the administration shell, and CORS.

The production journey uses disposable identities and listings. It must not log email addresses, Firebase UIDs, access tokens, or secrets.
