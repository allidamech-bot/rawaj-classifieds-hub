# RAWAJ Cloudflare production cutover

## Release decision

The owner has approved releasing without legacy media that remains inaccessible
in suspended Supabase Storage. Legacy listing images, promotional banners,
avatars, and covers are intentionally skipped and are not a production blocker.
No fabricated URL or runtime Supabase fallback is permitted.

Existing listings and accounts remain in D1. Listings without a valid D1/R2
image use the established `PlaceholderArt` presentation. New listing images use
the Worker `MEDIA` R2 binding and D1 metadata.

The archival migration tools remain available for an explicitly configured,
read-only source migration, but release validation must not retry or require
legacy media downloads.

## Production topology

- Frontend: Vercel project `rawaj-classifieds-hub`, served at `rawa-j.com`.
- API: Cloudflare Worker `rawaj-public-api`, served at `api.rawa-j.com`.
- Relational data: D1 binding `DB`, database `rawaj-staging`.
- Media: R2 binding `MEDIA`, bucket `rawaj-staging-media`.
- Frontend provider: `VITE_PUBLIC_DATA_PROVIDER=cloudflare`.
- Frontend API base: `VITE_PUBLIC_DATA_API_BASE_URL=https://api.rawa-j.com`.
- Worker config rendering: `CLOUDFLARE_WORKER_CUSTOM_DOMAIN=api.rawa-j.com`
  for production only. Local/test rendering omits the custom route so localhost
  recovery-token safeguards remain testable and cannot be confused with a
  production request.

The existing resource names are retained to avoid duplicating or silently
forking application data. They are the authorized production resources for this
cutover despite their historical `staging` names.

## D1 migration baseline

The target database contains the schema introduced by migrations 0001 through
0003, but its `d1_migrations` bookkeeping was not populated. Before applying
later migrations:

1. Export a private D1 backup outside the repository.
2. Verify the 0001-0003 tables, indexes, triggers, and aggregate row counts.
3. Insert only the missing 0001-0003 migration names into `d1_migrations`.
4. Confirm Wrangler then reports only 0004 and 0005 as pending.
5. Apply 0004 and 0005 in numeric order using Wrangler.
6. Re-run non-sensitive aggregate counts and schema checks.

Never re-run 0001-0003 against the populated database, drop or truncate data, or
rewrite migrations 0001-0005.

## Incomplete features

The release includes Cloudflare auth/recovery, profiles, listing CRUD, new R2
listing images, favorites, saved searches, and text conversations/messages.
Legacy media is intentionally skipped.

Reviews, support persistence, notifications, moderation, chat media, reporting,
blocking, and realtime WebSocket delivery are not part of this cutover. They
must not be represented as migrated and must not silently fall back to
Supabase in Cloudflare mode.

## Rollback

- Frontend: promote the prior known-good Vercel deployment.
- Worker: roll back to the prior Worker version.
- Configuration: restore the prior documented Vercel environment values and
  Worker route/version if needed.
- D1: preserve all data. Do not destructively roll back additive migrations.

If frontend and Worker API contracts become incompatible, roll back both
application deployments together while leaving D1 intact.
