# RAWAJ Production Schema Proof

Status: **awaiting Supabase Production extraction**

Baseline repository commit: `427dd3924f073aa370fcb58751548de65f284430`

Evidence classification: **S — Requires Supabase Production Verification** until populated from the read-only extractor.

## Extraction record

- Supabase project: RAWAJ Production
- Extraction date/time:
- Extracted by:
- Extractor commit:
- SQL file: `docs/production-schema/extract-production-truth.sql`
- Scheduled jobs query executed: yes / no / not applicable
- Auth configuration evidence source:

## Evidence sections received

- [ ] 01 Migration history
- [ ] 02 Relations and RLS state
- [ ] 03 Columns
- [ ] 04 Constraints
- [ ] 05 Indexes
- [ ] 06 Triggers
- [ ] 07 Functions/procedures
- [ ] 08 Table grants
- [ ] 09 Routine grants
- [ ] 10 RLS and storage policies
- [ ] 11 Custom types
- [ ] 12 Storage buckets
- [ ] 13 Extensions
- [ ] 14 Realtime publication
- [ ] 15 Replica identity
- [ ] 16 Scheduled jobs, when pg_cron is installed
- [ ] Auth settings from Supabase Dashboard

## Migration-history comparison

Pending extraction.

The comparison must map every repository migration to one of:

- verified applied
- verified not applied
- ambiguous because of a duplicate version
- repository-only historical record
- manual Production change
- superseded
- reconciliation

No duplicate-version file may be assigned an applied state based only on its numeric prefix.

## Object-level comparison

| Object class | Repository intent | Production truth | Difference | Severity | Resolution |
|---|---|---|---|---|---|
| Tables/columns | Pending | Pending | Pending | Pending | Pending |
| Constraints | Pending | Pending | Pending | Pending | Pending |
| Indexes | Pending | Pending | Pending | Pending | Pending |
| Triggers | Pending | Pending | Pending | Pending | Pending |
| Functions/RPCs | Pending | Pending | Pending | Pending | Pending |
| Grants | Pending | Pending | Pending | Pending | Pending |
| RLS policies | Pending | Pending | Pending | Pending | Pending |
| Storage | Pending | Pending | Pending | Pending | Pending |
| Types/enums | Pending | Pending | Pending | Pending | Pending |
| Realtime | Pending | Pending | Pending | Pending | Pending |
| Scheduled jobs | Pending | Pending | Pending | Pending | Pending |
| Extensions | Pending | Pending | Pending | Pending | Pending |

## Reconciliation decision

No reconciliation SQL may be written until the evidence sections above are complete and differences are classified.

## Production safety statement

The extraction query is read-only. This document does not authorize replaying historical migrations, renaming applied migrations, dropping objects, or changing Production data.
