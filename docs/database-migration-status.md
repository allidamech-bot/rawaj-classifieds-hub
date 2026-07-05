# RAWAJ database migration status

This document records repository migration intent for Phase 1. It does not claim
that a migration was applied to a live environment unless live evidence proves it.

## Canonical live type model confirmed by read-only inspection

- profiles.id: uuid
- user_roles.user_id: uuid
- categories.id: text
- subcategories.id: text
- subcategories.category_id: text
- governorates.id: text
- listings.id: uuid
- listings.owner_id: uuid
- listings.category_id: text
- listings.subcategory_id: text
- listings.governorate_id: text
- listing_images.id: uuid
- listing_images.listing_id: uuid
- taxonomy_nodes.id: text
- taxonomy_nodes.parent_id: text
- taxonomy_nodes.legacy_category_id: text
- taxonomy_nodes.legacy_subcategory_id: text

## Status vocabulary

- canonical: matches current intended architecture
- superseded: historical path that must not be used for current bootstrap/replay
- reconciliation: narrow migration intended to align known drift
- live-unverified: repository migration exists but live application is not proven
- manual-deprecated: retained only as non-executable historical documentation

## Current classification

| Path | Status | Notes |
| --- | --- | --- |
| `supabase/migrations/202606290001_auth_roles_foundation.sql` | historical/canonical precursor | Role/profile foundation; live details must still be verified before replay. |
| `supabase/migrations/202606290002_classifieds_foundation.sql` | superseded | Legacy UUID category/location foundation conflicts with confirmed current text-ID marketplace model. Do not replay on current environments. |
| `supabase/migrations/202606300001_core_marketplace_schema_rls.sql` | canonical direction | Defines text category/location identifiers and private listing image bucket direction. Historical application state is not inferred from repository presence. |
| `supabase/migrations/202607020003_owner_admin_moderator_policy_alignment.sql` | live-unverified | Latest repository policy intent separates moderation from owner-only hard delete, but live policy names previously observed did not prove full application. Do not replay blindly. |
| `supabase/migrations/202607040001_taxonomy_nodes_foundation.sql` | canonical direction | Requires text category/subcategory identifiers and provides current deep taxonomy foundation. |
| `supabase/migrations/202607050001_reconcile_listing_image_storage_visibility.sql` | reconciliation | Removes legacy bucket-wide object read and limits public object access to approved, non-archived listings while keeping the bucket private. |
| `supabase/manual/setup_listing_images_storage.sql` | manual-deprecated | Legacy public-bucket setup. Non-executable deprecation notice only. |
| `supabase/manual/apply_classifieds_foundation.md` | superseded checklist | Historical instruction points at the legacy UUID classifieds foundation and must not be used for current environments. |

## Operating rules

1. Never infer live application from filename ordering alone.
2. Never replay all repository SQL against an existing environment.
3. Compare live types, constraints, RLS, policies, functions, and bucket state before reconciliation.
4. Prefer narrow idempotent reconciliation migrations over foundation replay.
5. Keep data-preserving compatibility for existing listings and URLs.
6. Record future live verification separately from repository intent.
