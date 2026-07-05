# DEPRECATED — DO NOT RUN

This checklist is superseded and must not be used for current RAWAJ environments.

## Why this is deprecated

The historical migration:

`supabase/migrations/202606290002_classifieds_foundation.sql`

models legacy UUID identifiers for marketplace catalogs such as categories and governorates. The confirmed current RAWAJ architecture uses text identifiers for canonical category, subcategory, governorate, and taxonomy records while retaining UUID identifiers for listings and user/profile-owned records.

Running the historical foundation migration blindly against an existing or current environment can conflict with the canonical schema and migration history.

## Required operator behavior

- Do not copy or execute `202606290002_classifieds_foundation.sql` as a repair step.
- Do not replay all migrations based on filename ordering.
- Do not infer live migration application from repository presence alone.
- Inspect live column types, foreign keys, RLS state, helper functions, policies, and storage bucket state first.
- Prefer narrow, reviewed reconciliation migrations for confirmed drift.
- Consult `docs/database-migration-status.md` for repository migration truth.
- Consult `docs/authorization-model.md` before changing role or moderation policies.
- Consult `docs/production-audit-runbook.md` for evidence-based production verification.

## Historical note

This file previously instructed operators to run `202606290002_classifieds_foundation.sql` manually in the Supabase SQL Editor. That instruction is intentionally revoked.
