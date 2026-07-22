# RAWAJ Cloudflare cutover architecture

## Objective

Replace Supabase as the production backend without coupling the marketplace UI to
D1, R2, or any other storage implementation.

The public site talks to one versioned Worker API. The Worker owns authorization,
query shaping, public-field allowlists, caching, and media access. D1 and R2 are
private bindings and are never called directly by the browser.

## Target topology

```text
RAWAJ web / Android
        |
        v
rawaj-public-api Worker
   |             |
   v             v
 D1 DB      private R2 bucket
```

Later write-side Workers will use the same domain boundaries for authentication,
listing creation, moderation, chat, notifications, and administration.

## Non-negotiable invariants

1. No runtime dual-write between Supabase and D1.
2. No silent read fallback between providers.
3. No Supabase URL or storage path in the final public API contract.
4. No arbitrary R2 object-key endpoint.
5. Public media is served only when referenced by an approved listing, an active
   ad placement, or a public profile.
6. Every snapshot has a stable timestamp, row counts, and SHA-256 manifest.
7. Every media upload is checksum-verified before its D1 asset becomes `ready`.
8. Supabase source data is not mutated or deleted during migration.
9. Production cutover happens by deployment configuration after verification.
10. Rollback is a deployment rollback, not a data mutation.

## Read-model schema

`0001_catalog_foundation.sql` owns stable public catalog data.

`0002_public_marketplace_foundation.sql` owns:

- import batches and verification state;
- normalized media assets;
- public profile projections;
- canonical Syrian location data;
- approved-listing projections and taxonomy assignments;
- listing image relationships;
- active advertising placements;
- FTS5 search index and synchronization triggers.

Private account data is intentionally excluded from the public projection.

## Migration flow

### 1. Snapshot

`cloudflare/migration/export-public-snapshot.mjs`

- opens one repeatable-read, read-only PostgreSQL transaction;
- reads the entire public projection at one consistent point in time;
- emits D1-compatible SQL;
- emits a media manifest;
- emits row counts and SHA-256 checksums;
- performs no writes against Supabase.

### 2. Media copy

`cloudflare/migration/migrate-media-to-r2.mjs`

- defaults to dry-run;
- copies only with `--apply`;
- validates content type and maximum size;
- calculates SHA-256 before upload;
- compares existing R2 metadata before overwrite;
- refuses checksum conflicts unless `--force` is explicitly supplied;
- verifies the uploaded checksum through a HEAD request;
- emits a D1 finalization SQL file;
- never deletes the Supabase source.

### 3. D1 import and verification

1. Apply versioned D1 migrations.
2. Import `public-snapshot.sql`.
3. Run media migration.
4. Import `media-finalize.sql`.
5. Compare D1 counts with `snapshot-manifest.json`.
6. Verify foreign keys, sample listing payloads, FTS search, ad placement windows,
   and R2 object checksums.
7. Mark the import batch `verified`.

### 4. Application cutover

The UI will be switched to the Worker API only after the batch is verified.
The Worker endpoint is configured through deployment environment, not by code
fallback. The previous deployment remains the rollback point until acceptance
testing completes.

## Resource configuration

`wrangler.base.jsonc` contains stable Worker configuration only.

`wrangler.generated.jsonc` is produced from deployment secrets and is never
committed. Required values:

- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_R2_BUCKET_NAME`

Cloudflare account authentication is supplied to Wrangler through:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## Remaining phases

1. Provision D1 and R2.
2. Export and import the public snapshot.
3. Copy and verify all media.
4. Deploy and acceptance-test the public Worker.
5. Switch public web reads to the Worker API.
6. Migrate authentication and private account state.
7. Migrate listing writes and moderation.
8. Migrate messaging, notifications, and administration.
9. Retire Supabase only after parity and retention checks.
