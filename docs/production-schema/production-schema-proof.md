# RAWAJ Production Schema Proof

Status: **Production catalog extraction received; repository reconciliation in progress**

Baseline repository commit: `427dd3924f073aa370fcb58751548de65f284430`

Evidence classification: **S — Supabase Production verified** for PostgreSQL catalog objects listed below. Migration application history and Dashboard-only Auth settings remain unverified.

## Extraction record

- Supabase project: RAWAJ Production
- Extraction date: 2026-07-11
- Evidence source: read-only SQL catalog extraction exported from Supabase SQL Editor
- Extractor scope: PostgreSQL catalogs, information schema, storage buckets, RLS policies, extensions, and realtime publication membership
- Scheduled jobs query executed: not applicable (`pg_cron` is not installed)
- Auth configuration evidence source: pending Supabase Dashboard verification

## Evidence sections received

- [ ] Application migration history — no `supabase_migrations.schema_migrations` relation exists
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

## Production catalog summary

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

## Confirmed Production storage buckets

| Bucket | Public | Limit | Allowed MIME types |
|---|---:|---:|---|
| `listing-images` | no | 5 MiB | JPEG, PNG, WebP |
| `profile-media` | yes | 3 MiB | JPEG, PNG, WebP |
| `verification-documents` | no | 10 MiB | JPEG, PNG, WebP, PDF |

## Confirmed findings requiring reconciliation review

### 1. Two unvalidated constraints

Production contains two `NOT VALID` constraints on `public.ad_placements`:

- `ad_placements_destination_url_https_check`
- `ad_placements_image_url_https_check`

Both enforce non-empty HTTPS URLs with a maximum length of 2048 characters. They apply to new/updated rows but have not been validated against all existing rows. No `VALIDATE CONSTRAINT` action is authorized until repository intent and current data compatibility are checked.

### 2. Realtime publication is empty

The `supabase_realtime` publication currently has no member tables. This is not automatically a defect. It must be compared with application behavior to determine whether RAWAJ relies on Supabase Realtime for chats, notifications, or other live updates.

### 3. Application migration history remains unavailable

The database contains internal migration tables for Supabase Auth, Realtime, and Storage only. No application-level `supabase_migrations.schema_migrations` relation exists, so repository migrations cannot be marked applied solely from Production catalog evidence.

## Positive controls confirmed

- Every public table has RLS enabled.
- Every public table has a primary key.
- No SECURITY DEFINER routine is missing an explicit `search_path` configuration.
- Storage bucket privacy and MIME/size limits are explicit.
- `pg_cron` is not installed, so there are no extension-backed scheduled jobs to reconcile.

## Object-level comparison

| Object class | Production truth | Current classification | Next action |
|---|---|---|---|
| Tables/columns | 38 public tables extracted | Verified Production evidence | Compare exact definitions to repository migrations |
| Constraints | 229 total; 2 not validated | Review required | Compare migration intent and inspect affected data before validation |
| Indexes | 128 extracted | Verified Production evidence | Compare exact definitions to repository migrations |
| Triggers | 51 extracted | Verified Production evidence | Compare exact definitions and owning functions |
| Functions/RPCs | 133 extracted | Verified Production evidence | Compare signatures, definitions, grants, and callers |
| Grants | 1165 table and 533 routine grants | Verified Production evidence | Compare with intended anon/authenticated/service-role access |
| RLS policies | 96 public and 16 storage policies | Verified Production evidence | Compare policy definitions to migrations and API assumptions |
| Storage | 3 buckets extracted | Verified Production evidence | Confirm public `profile-media` exposure is intentional |
| Types/enums | 8 public enums extracted | Verified Production evidence | Compare labels and usage to repository migrations |
| Realtime | Publication has 0 tables | Review required | Determine whether application depends on Realtime subscriptions |
| Scheduled jobs | `pg_cron` not installed | Not applicable | No action |
| Extensions | 5 installed | Verified Production evidence | Compare with repository prerequisites |
| Migration history | Application history unavailable | Unresolved | Infer object state only; do not replay or rename migrations |
| Auth settings | Not in PostgreSQL extraction | Pending | Verify through Supabase Dashboard |

## Reconciliation decision

No historical migration will be replayed or renamed from this evidence. The next repository step is a deterministic object-level comparison between the extracted Production catalog and the canonical migration ledger. Any corrective SQL must be narrow, forward-only, idempotent where practical, and separately reviewed before Production execution.

## Production safety statement

The extraction was read-only. This document does not authorize replaying historical migrations, renaming applied migrations, validating constraints, changing Realtime publication membership, modifying grants or RLS policies, altering storage visibility, or changing Production data.