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

## Reconciliation findings

### 1. Two unvalidated ad-placement URL constraints are intentional

Production contains two `NOT VALID` constraints on `public.ad_placements`:

- `ad_placements_destination_url_https_check`
- `ad_placements_image_url_https_check`

Repository migration `202607090005_harden_ad_placement_urls.sql` intentionally creates both constraints as `NOT VALID`. The migration comment states that they protect new and updated rows while deliberately avoiding a scan or rewrite of historical Production rows.

Classification: **verified repository intent; no defect; no reconciliation migration required**.

Authorized action: none. Do not run `VALIDATE CONSTRAINT` unless a separate data-quality review proves all historical rows compliant and explicitly approves validation.

### 2. Realtime publication is empty and no repository subscription dependency was found

The `supabase_realtime` publication currently has no member tables. Repository search found no `postgres_changes` subscription and no `.channel(` usage in application code.

Classification: **no current repository evidence that RAWAJ depends on database-change Realtime subscriptions**.

Authorized action: none. Do not add tables to `supabase_realtime` merely because the publication is empty.

### 3. Application migration history remains unavailable

The database contains internal migration tables for Supabase Auth, Realtime, and Storage only. No application-level `supabase_migrations.schema_migrations` relation exists, so repository migrations cannot be marked applied solely from Production catalog evidence.

Classification: **migration ledger application order remains unresolved; object-level evidence is authoritative for current state**.

## Positive controls confirmed

- Every public table has RLS enabled.
- Every public table has a primary key.
- No SECURITY DEFINER routine is missing an explicit `search_path` configuration.
- Storage bucket privacy and MIME/size limits are explicit.
- `pg_cron` is not installed, so there are no extension-backed scheduled jobs to reconcile.
- The only non-validated constraints match intentional repository design.
- No repository evidence requires Realtime publication membership.

## Object-level comparison

| Object class | Production truth | Current classification | Next action |
|---|---|---|---|
| Tables/columns | 38 public tables extracted | Verified Production evidence | Continue exact definition comparison where a concrete repository mismatch is found |
| Constraints | 229 total; 2 intentionally not validated | Aligned with repository intent | No corrective SQL |
| Indexes | 128 extracted | Verified Production evidence | Continue exact definition comparison where a concrete mismatch is found |
| Triggers | 51 extracted | Verified Production evidence | Continue exact definition comparison with owning functions |
| Functions/RPCs | 133 extracted | Security baseline passes | Compare signatures, definitions, grants, and application callers |
| Grants | 1165 table and 533 routine grants | Verified Production evidence | Compare only access paths used by anon/authenticated clients |
| RLS policies | 96 public and 16 storage policies | Baseline safety passes | Compare policy definitions to API assumptions |
| Storage | 3 buckets extracted | Verified Production evidence | Confirm public `profile-media` exposure remains intentional |
| Types/enums | 8 public enums extracted | Verified Production evidence | Compare labels and usage to repository migrations |
| Realtime | Publication has 0 tables; no subscriptions found | No defect identified | No action |
| Scheduled jobs | `pg_cron` not installed | Not applicable | No action |
| Extensions | 5 installed | Verified Production evidence | Compare with repository prerequisites |
| Migration history | Application history unavailable | Unresolved | Infer object state only; do not replay or rename migrations |
| Auth settings | Not in PostgreSQL extraction | Pending | Verify through Supabase Dashboard |

## Reconciliation decision

No historical migration will be replayed or renamed from this evidence. No corrective SQL is currently justified for the two `NOT VALID` constraints or the empty Realtime publication.

The remaining reconciliation work is limited to deterministic comparison of Production RPC signatures/grants, RLS policy definitions, storage exposure, and repository callers. Any future corrective SQL must be narrow, forward-only, idempotent where practical, and separately reviewed before Production execution.

## Production safety statement

The extraction was read-only. This document does not authorize replaying historical migrations, renaming applied migrations, validating constraints, changing Realtime publication membership, modifying grants or RLS policies, altering storage visibility, or changing Production data.
