# RAWAJ Cloudflare migration status

Captured: 2026-07-22

## Current verified state

- Integration branch: `feature/cloudflare-storage-migration-continuation`
- Stacked review: PR #512, based on `feature/listing-user-journey-recovery`
- Cloudflare Worker build succeeds from the generated TanStack Start/Nitro output.
- The Worker configuration has no custom domain route and explicitly disables both `workers.dev` and version preview URLs.
- The private R2 listing-image path is integrated behind `/api/listing-images`.
- New image uploads use R2 only when all server-side R2 settings are available; otherwise the existing Supabase Storage path remains active.
- Existing Supabase image records and objects have not been changed or deleted.

## Live inventory

### Listing images

- `listing_images` database rows: 57
- `listing-images` Storage objects: 57
- Database rows without an object: 0
- Storage objects without a database row: 0
- Existing `r2:` rows: 0
- Current source bytes: 5,470,293

### Other media

- `profile-media` objects: 7
- Current profile-media bytes: 8,438,783
- Profile media is not included in the listing-image phase and requires its own read/write path before migration.

### Relational backend complexity

- Public tables: 61
- PostgreSQL functions: 254
- RLS policies: 124
- Triggers: 89
- Enums: 8

The relational data volume is small. The migration risk is concentrated in authorization and business logic, not row count or database size.

## Why Supabase migrations cannot be copied directly to D1

D1 uses SQLite SQL semantics. RAWAJ currently depends on PostgreSQL-specific capabilities including PL/pgSQL functions, RLS policies, trigger functions, enums, `auth.uid()`, PostgREST RPCs, and Supabase Realtime/Auth integration. Cloudflare documents that PostgreSQL dumps are not directly compatible with D1.

Therefore the D1 track must be a forward-only rewrite:

1. Convert table schemas and indexes to SQLite-compatible DDL.
2. Move RLS authorization checks into authenticated Worker service methods.
3. Replace PostgREST RPCs with typed Worker API commands.
4. Replace database triggers with explicit transactional service logic or queues/workflows.
5. Rebuild Realtime-dependent journeys before switching writes.
6. Import a verified data snapshot only after schema and behavior parity tests pass.

## Execution sequence

### Phase 1 — R2 listing images

1. Run the migration tool without `--apply` and review the JSONL manifest.
2. Copy a small limited batch with `--apply --limit=N`.
3. Verify each object by SHA-256 metadata and test authenticated display/deletion.
4. Copy all 57 objects without changing database paths.
5. Deploy the dual-read code to a controlled environment.
6. Perform a separate reviewed database cutover from `path` to `r2:path`.
7. Keep the source bucket untouched through the rollback window.

Migration tool:

```bash
node scripts/migrate-supabase-listing-images-to-r2.mjs
node scripts/migrate-supabase-listing-images-to-r2.mjs --apply --limit=3
```

Required for inventory/dry-run:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Additionally required for `--apply`:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- optional `R2_REGION` (defaults to `auto`)

The tool never deletes source objects and never updates `listing_images.storage_path`.

### Phase 2 — Remaining media

Add R2 support for profile avatars, seller covers, promotion receipts, chat attachments, and voice messages one domain at a time. Each domain must have dual-read, ownership enforcement, copy verification, cutover, and rollback coverage.

### Phase 3 — Cloudflare API with Supabase Postgres bridge

Before D1 parity is ready, Cloudflare Hyperdrive can connect Workers to the existing Supabase PostgreSQL database. This allows API execution to move to Workers without attempting a risky all-at-once database rewrite. Supabase Auth may remain temporarily while Worker endpoints validate JWTs and enforce authorization.

### Phase 4 — D1 foundation

Create a new D1 schema and migration ledger for the lowest-risk read-only domains first: categories, taxonomy, governorates, locations, vehicle references, and option catalogs. Do not import user-owned or transactional tables until the Worker authorization layer and parity tests are complete.

### Phase 5 — Transactional cutover

Migrate listings, favorites, saved searches, conversations, notifications, moderation, and account data through snapshot plus reconciliation. Use dual writes or a controlled maintenance window, compare counts and checksums, then switch reads and writes independently.

### Phase 6 — Supabase retirement

Only after authentication, storage, database, Realtime, moderation, and rollback validation are complete:

- stop new writes to Supabase;
- retain a final immutable export;
- monitor Cloudflare-only operation;
- remove Supabase resources after the agreed retention period.

## Non-negotiable safeguards

- No direct PostgreSQL migration replay into D1.
- No deletion from Supabase during copy phases.
- No Production domain route until authenticated end-to-end tests pass.
- No client exposure of R2 credentials or Supabase service-role credentials.
- Every cutover requires a manifest, count reconciliation, checksum verification, and rollback path.
