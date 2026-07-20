# RAWAJ Taxonomy & Dynamic Search Foundation V1 — Production Cutover Runbook

Status: pre-production plan only. This document does not authorize or perform a Production change.

## 1. Scope and safety boundary

This cutover covers canonical migrations `202607190020` through `202607190043`.

The release must preserve these invariants:

- Existing `public.taxonomy_nodes`, categories, subcategories, listings, users, and media remain operational.
- Taxonomy V1 remains the single published taxonomy during installation.
- Taxonomy V2 remains `draft`; it is not published during this cutover.
- No review-queue suggestion is applied automatically.
- No listing is automatically reassigned, rejected, archived, or deleted.
- No Storage bucket visibility or signed-URL policy is changed by this release.
- Application deployment and database migration are separate approvals.

## 2. Required release gates

Do not start Production migration unless the current PR HEAD has all of the following:

1. Quality Gate: success.
2. Dynamic Listing Facets V1: success.
3. Taxonomy Data Foundation V1: success.
4. Supabase Local Replay Gate and database lint: success.
5. Browser Smoke: success.
6. Android Release Candidate: success.
7. Vercel Preview: READY and manually accepted on mobile and desktop.
8. No unresolved PR review threads.
9. Exact Production migration history captured and compared with `docs/production-schema/migration-ledger.json`.

Any failure or unknown Production migration state is a stop condition.

## 3. Migration groups and order

Migrations must be applied in canonical filename order. Do not cherry-pick individual migrations or reorder them.

### Group A — Governed taxonomy foundation

- `202607190020_taxonomy_governance_foundation_v1.sql`
- `202607190021_taxonomy_field_registry_foundation_v1.sql`
- `202607190022_vehicle_reference_catalog_foundation_v1.sql`
- `202607190023_taxonomy_data_public_read_contract_v1.sql`
- `202607190024_taxonomy_legacy_mapping_contract_v1.sql`
- `202607190025_taxonomy_owner_governance_rpc_v1.sql`
- `202607190026_marketplace_domain_field_registry_v1.sql`
- `202607190027_complete_marketplace_taxonomy_draft_v2.sql`

Expected effect: additive governance tables, public read contracts, owner-governed RPCs, field registries, and draft Taxonomy V2. Existing runtime taxonomy remains compatible.

### Group B — Listing attributes and review queues

- `202607190028_listing_attribute_values_foundation_v1.sql`
- `202607190029_listing_attribute_dependency_hardening_v1.sql`
- `202607190030_vehicle_reference_seed_and_review_queue_v1.sql`
- `202607190031_listing_taxonomy_and_vehicle_review_queue_seed_v1.sql`
- `202607190032_listing_attribute_write_contract_v1.sql`
- `202607190033_taxonomy_metadata_api_v1.sql`
- `202607190034_taxonomy_mapping_review_apply_v1.sql`
- `202607190035_vehicle_reference_review_apply_v1.sql`
- `202607190036_dynamic_listing_submit_guard_v1.sql`
- `202607190037_listing_data_quality_workspace_v1.sql`
- `202607190038_listing_data_quality_context_v1.sql`
- `202607190039_owner_listing_attribute_read_v1.sql`

Expected effect: typed listing attributes, non-destructive review queues, owner/admin data-quality interfaces, and submit validation. Queue records are suggestions only.

### Group C — Public facets and dynamic search

- `202607190040_dynamic_listing_facets_v1.sql`
- `202607190041_dynamic_listing_facets_repair_v1.sql`
- `202607190042_dynamic_listing_search_page_v1.sql`
- `202607190043_dynamic_listing_public_rpc_input_hardening_v1.sql`

Expected effect: visible-listing facets, cursor search, and bounded public wrappers. Migration `043` must be present because it prevents direct callers from bypassing client-side request limits.

## 4. Production preflight

Run all checks read-only before applying anything.

### 4.1 Capture migration history

Export the Production migration history and compare every applied filename/version with the canonical ledger. Confirm:

- No undocumented `202607190020`–`202607190043` migration is already partially applied.
- No timestamp collision exists in this range.
- Production baseline migrations required by foreign keys and helper functions are present.
- The current Production schema has `profiles`, `categories`, `subcategories`, `listings`, `listing_images`, and the existing location/taxonomy compatibility objects expected by the migrations.

### 4.2 Capture baseline counts

Record at minimum:

```sql
select count(*) as listings from public.listings;
select count(*) as listing_images from public.listing_images;
select count(*) as categories from public.categories;
select count(*) as subcategories from public.subcategories;
select count(*) as profiles from public.profiles;
select status, count(*) from public.listings group by status order by status;
```

Also record database size, active connections, API error rate, database CPU, and Egress baseline.

### 4.3 Detect namespace conflicts

Verify that any pre-existing objects with the new names match the expected definitions. Stop if an object exists outside the recorded migration history.

### 4.4 Backup checkpoint

Before migration:

- Create or confirm a restorable Supabase database backup/PITR checkpoint.
- Export schema-only SQL.
- Export migration history.
- Export row data for new/affected governance tables if any already exist.
- Record application Production deployment SHA and current `main` SHA.

The release owner must confirm the backup timestamp and restore path before proceeding.

## 5. Application sequence

1. Freeze schema changes and merges unrelated to the cutover.
2. Confirm all required gates against one immutable commit SHA.
3. Capture preflight evidence and backup checkpoint.
4. Apply migrations `020` through `043` in canonical order using the normal Supabase migration mechanism.
5. Do not publish Taxonomy V2.
6. Run immediate database verification before changing the application deployment.
7. Deploy/promote the reviewed application commit only after database verification passes.
8. Run post-deploy smoke checks.
9. Observe the system during the monitoring window before declaring completion.

## 6. Immediate database verification

Verify all of the following after migration:

- Exactly one taxonomy version is `published`.
- Taxonomy V2 is still `draft`.
- Existing listing, user, image, category, and subcategory counts have not decreased.
- Review queue creation did not mutate listing ownership or status.
- New public RPCs return only approved, non-archived, non-expired listings.
- Sensitive field definitions are not exposed publicly.
- `anon` and `authenticated` cannot execute the internal dynamic search/facet implementation functions.
- Public wrappers reject more than 250 taxonomy/location nodes and search text longer than 160 characters.
- Owner attribute writes reject unauthorized users and stale writes.
- Admin/owner governance RPCs enforce the expected role checks.

## 7. Application smoke matrix

Test on Preview/Production web and Android WebView:

- Home and category discovery.
- All-listings page without dynamic filters.
- Category listing page with a governed facet.
- Search query in Arabic and English.
- Sort: latest, featured, cheapest, expensive.
- Pagination/cursor continuation.
- Listing detail public visibility.
- Add listing with dynamic fields.
- Edit draft/rejected listing while preserving legacy details.
- Owner listing attributes.
- Admin data-quality workspace.
- Login, profile, favorites, chat, notifications, and existing listing moderation regressions.

## 8. Monitoring window

Monitor at least these signals after deployment:

- PostgREST/RPC 4xx and 5xx counts.
- Database CPU, connections, query latency, and slow-query logs.
- Calls to `rawaj_public_listing_facets_v1` and `rawaj_public_listing_search_page_v1`.
- Supabase Egress and Storage signed-URL request volume.
- Listing page error rate and empty-result anomalies.
- Browser and Android crash/error telemetry.
- Vercel runtime errors and response latency.

Stop expansion and begin rollback assessment if error rate, latency, or Egress increases materially from the captured baseline.

## 9. Rollback strategy

This release is forward-only. Do not attempt destructive down migrations in Production.

### Application rollback

If the database is healthy but the new UI/runtime is faulty:

1. Roll back/promote the previous accepted Vercel deployment.
2. Keep additive database objects installed.
3. Verify old application flows continue using compatibility tables and legacy fields.

### Database containment

If a new public RPC or permission is faulty:

1. Disable/revoke only the affected new RPC grant through a reviewed emergency migration.
2. Keep Taxonomy V2 draft.
3. Do not drop tables or delete queue/attribute data.
4. Restore prior function definitions with a forward repair migration where required.

### Full database recovery

Use backup/PITR restore only for confirmed destructive corruption or unrecoverable schema failure. This requires explicit owner approval because it may roll back legitimate writes created after the checkpoint.

## 10. Pilot and publication boundary

Installing this foundation does not authorize Taxonomy V2 publication.

A later pilot must:

- Select a limited category/leaf scope.
- Review mapping and vehicle-reference queues manually.
- Measure listing completion, search quality, latency, and support impact.
- Obtain an explicit owner decision before publishing a new taxonomy version.

## 11. Go/no-go record

Record the following in the PR or release issue:

- Immutable application commit SHA.
- Migration range and exact migration history comparison.
- Backup/PITR checkpoint timestamp.
- Preflight counts.
- Gate results.
- Migration start/end timestamps.
- Post-migration verification results.
- Deployment ID.
- Monitoring observations.
- Final go/no-go decision and approver.
