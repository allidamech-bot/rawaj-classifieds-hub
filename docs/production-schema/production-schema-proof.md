# RAWAJ Production Schema Proof

Status: **Historical Production extraction retained; current release delta awaiting controlled Production verification**

Historical extraction repository baseline: `427dd3924f073aa370fcb58751548de65f284430`

Repository reviewed through: `9a9f8a6beba5cb7ba5e7c9252487ab0b3dcb357f`

Last document reconciliation: **2026-07-16**

Evidence classification: **S — Supabase Production verified** applies only to the PostgreSQL catalog snapshot captured on 2026-07-11. It does not prove that migrations merged afterward are applied. Application migration history and Dashboard-only Auth settings remain unverified.

## Extraction record

- Supabase project: RAWAJ Production
- Extraction date: 2026-07-11
- Evidence source: read-only SQL catalog extraction exported from Supabase SQL Editor
- Extractor scope: PostgreSQL catalogs, information schema, storage buckets, RLS policies, extensions, and Realtime publication membership
- Scheduled jobs query executed: not applicable (`pg_cron` was not installed in the captured snapshot)
- Auth configuration evidence source: pending Supabase Dashboard verification
- Current proof bundle: `supabase/verification/20260716_phase_0_production_proof.sql`

## Evidence sections received from the 2026-07-11 snapshot

- [ ] Application migration history — no `supabase_migrations.schema_migrations` relation existed
- [x] Relations and RLS state
- [x] Columns
- [x] Constraints
- [x] Indexes
- [x] Triggers
- [x] Functions/procedures
- [x] Table grants
- [x] Routine grants
- [x] RLS and storage policies
- [x] Custom enum types
- [x] Storage buckets
- [x] Extensions
- [x] Realtime publication membership
- [x] Replica identity
- [x] Scheduled jobs applicability
- [ ] Auth settings from Supabase Dashboard

## Historical Production catalog summary — 2026-07-11

- Public tables: **38**
- Public tables with RLS enabled: **38 / 38**
- Public tables without a primary key: **0**
- Public tables using default replica identity: **38 / 38**
- Public indexes: **128**
- Public constraints: **229**
- Non-internal public triggers: **51**
- Public functions/procedures: **133**
- Public RLS policies: **96**
- Storage RLS policies: **16**
- Table grants: **1165**
- Routine grants: **533**
- Public enum types: **8**
- Installed extensions: **5**
- SECURITY DEFINER routines without explicit `search_path`: **0**
- Tables in `supabase_realtime` publication: **0**

These numbers are retained as historical evidence and must not be presented as the current Production state after 2026-07-11.

## Confirmed Production storage buckets in the historical snapshot

| Bucket | Public | Limit | Allowed MIME types |
|---|---:|---:|---|
| `listing-images` | no | 5 MiB | JPEG, PNG, WebP |
| `profile-media` | yes | 3 MiB | JPEG, PNG, WebP |
| `verification-documents` | no | 10 MiB | JPEG, PNG, WebP, PDF |

## Release delta after the historical extraction

| Migration | Repository state | Intended correction | Production state |
|---|---|---|---|
| `202607160002_require_listing_moderation_audit.sql` | Merged through PR #392 | Make listing status transition, moderation history, and audit log atomic; keep owner notification best-effort | **Unknown until applied and verified** |
| `202607160003_enable_chat_realtime.sql` | Merged through PR #394 | Add `conversations` and `conversation_messages` to `supabase_realtime`, grant authenticated SELECT through RLS, and revoke anonymous SELECT | **Unknown until applied and verified** |

No document update may change either Production state to verified merely because the migration exists in GitHub.

## Reconciliation findings

### 1. Two unvalidated ad-placement URL constraints are intentional

The 2026-07-11 snapshot contained two `NOT VALID` constraints on `public.ad_placements`:

- `ad_placements_destination_url_https_check`
- `ad_placements_image_url_https_check`

Repository migration `202607090005_harden_ad_placement_urls.sql` intentionally creates both constraints as `NOT VALID`. They protect new and updated rows while avoiding an unapproved scan or rewrite of historical Production rows.

Classification: **verified repository intent; no defect identified in the historical snapshot**.

Authorized action: none. Do not run `VALIDATE CONSTRAINT` unless a separate data-quality review proves all historical rows compliant and explicitly approves validation.

### 2. Realtime conclusion from the historical document is superseded

The 2026-07-11 snapshot proved that `supabase_realtime` had zero member tables. At that time, the repository review recorded no subscription dependency.

That conclusion is no longer valid for the current repository. `src/features/communication/useLiveChatWorkspace.ts` now subscribes to `postgres_changes` for:

- `public.conversation_messages`
- `public.conversations`

Migration `202607160003_enable_chat_realtime.sql` is therefore a justified, narrow reconciliation migration. Its presence in the repository does not prove Production application.

Required evidence after application:

1. Both tables appear in `pg_publication_tables` for `supabase_realtime`.
2. RLS remains enabled on both tables.
3. Participant-only SELECT policies remain present.
4. `authenticated` has SELECT and `anon` does not.
5. A two-account participant test receives message changes promptly.
6. A non-participant account receives no conversation or message events.

### 3. Public profile-media bucket is intentional

The historical snapshot exposed `profile-media` publicly with a 3 MiB limit and JPEG/PNG/WebP allowlist. Repository migration `202607010003_account_settings_seller_reviews_contract.sql` explicitly creates or updates this bucket with `public = true` and adds a public SELECT policy. Upload, update, and delete policies remain restricted to authenticated users operating within their own UUID-prefixed `avatar` or `cover` path.

Classification: **verified repository intent; no storage visibility defect identified in the historical snapshot**.

### 4. Application migration history remains unavailable

The historical database extraction contained internal migration tables for Supabase Auth, Realtime, and Storage only. No application-level `supabase_migrations.schema_migrations` relation existed, so repository migrations cannot be marked applied solely from object presence or GitHub history.

Classification: **migration application order remains unresolved; object-level evidence is authoritative for the state captured at a specific timestamp**.

### 5. Listing moderation audit correction requires Production proof

The current repository requires a listing review decision to commit its listing state, moderation action, and audit log atomically. The 2026-07-11 extraction predates this correction.

Required evidence after application:

1. The expected RPC signature exists.
2. `pg_get_functiondef` contains the mandatory moderation-action insert.
3. `pg_get_functiondef` contains the mandatory audit-log call.
4. The only best-effort `when others then null` block wraps owner notification delivery.
5. An approve/reject acceptance test produces both authoritative records.

## Positive controls retained from the historical snapshot

- Every captured public table had RLS enabled.
- Every captured public table had a primary key.
- No captured SECURITY DEFINER routine lacked an explicit `search_path` configuration.
- Storage bucket privacy and MIME/size limits were explicit.
- `pg_cron` was not installed in the captured snapshot.
- The non-validated ad-placement constraints matched intentional repository design.
- Public profile media exposure matched repository design and write access remained owner-scoped.

These controls require a new extraction before they can be claimed for the current release commit.

## Object-level comparison status

| Object class | Historical Production truth | Current classification | Next action |
|---|---|---|---|
| Tables/columns | 38 public tables extracted | Historical evidence only | Refresh extraction on the release commit |
| Constraints | 229 total; 2 intentionally not validated | Historical evidence aligned with intent | Recheck after release migrations |
| Indexes | 128 extracted | Historical evidence only | Refresh extraction |
| Triggers | 51 extracted | Historical evidence only | Compare definitions with owning functions |
| Functions/RPCs | 133 extracted | Historical baseline predates moderation-audit correction | Apply and verify exact signature and definition |
| Grants | 1165 table and 533 routine grants | Historical baseline | Verify chat-table authenticated/anon privileges |
| RLS policies | 96 public and 16 storage policies | Historical baseline | Verify participant-only chat policies and full role matrix |
| Storage | 3 buckets extracted | Historical evidence aligned with intent | Recheck limits and policies |
| Types/enums | 8 public enums extracted | Historical evidence only | Refresh extraction |
| Realtime | Publication had 0 tables | **Known mismatch with current client dependency** | Apply migration and verify two table memberships plus RLS behavior |
| Scheduled jobs | `pg_cron` was not installed | Historical evidence | Recheck scheduler architecture separately |
| Extensions | 5 installed | Historical evidence | Refresh extraction |
| Migration history | Application history unavailable | Unresolved | Preserve explicit unknown state; do not replay blindly |
| Auth settings | Not in PostgreSQL extraction | Pending | Verify through Supabase Dashboard |

## Controlled verification procedure

1. Pin the exact `main` release commit.
2. Review and apply only the approved forward migrations in order.
3. Run `supabase/verification/20260716_phase_0_production_proof.sql` read-only.
4. Export all result sets with timestamp, actor, project, and commit.
5. Execute the moderator approve/reject acceptance test.
6. Execute participant A/B and non-participant C Realtime tests.
7. Refresh the full Production catalog extraction.
8. Update the migration ledger and this document only from captured evidence.

## Production safety statement

The 2026-07-11 extraction and the Phase 0 proof bundle are read-only. This document does not itself authorize replaying historical migrations, renaming migrations, validating historical constraints, changing Auth settings, or modifying Production data. The two forward migrations listed above were separately reviewed and merged, but their Production state remains **unknown** until controlled application and post-application evidence are captured.
