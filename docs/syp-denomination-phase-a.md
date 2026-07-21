# SYP denomination Phase A

## Purpose

Phase A adds explicit denomination metadata without changing any stored `price`. It makes mixed old/new Syrian-pound values safe to display and compare while preserving the original amount.

## Schema contract

- `price_denomination`: `old`, `new`, or `unclassified`.
- `price_new_syp_normalized`: generated, read-only comparison value.
- Existing rows remain `unclassified`.
- No amount is inferred from magnitude, category, owner, or creation date.
- `100 old SYP = 1 new SYP`.

## Runtime contract

- Drafts may autosave with `unclassified` so existing drafts are not lost.
- A priced SYP listing cannot be submitted for review until the owner chooses `old` or `new`.
- Existing approved listings remain visible.
- Unclassified prices are not included in numeric price filtering, price ordering, price-drop comparisons, saved-search price alerts, or structured Offer data.
- Classified prices display both new and old equivalents.
- Add/edit flows carry denomination metadata explicitly.
- Owner/admin classification is stale-write protected and changes metadata only.
- Favorite snapshots and price history retain the denomination used when the value was recorded.
- Search and sort use `price_new_syp_normalized`, while the source `price` remains untouched.

## Implemented surfaces

- Add-listing and edit-listing denomination selection and validation.
- Listing cards and public detail dual-denomination display.
- Owner/reviewer classification queue.
- Public search filtering, sorting, and cursor comparison.
- Saved-search price-alert guard and normalized thresholds.
- Price-drop history and active-offer comparison.
- Favorite snapshot denomination metadata.
- JSON-LD Offer generation from classified normalized values only.
- Additive migration, self-contained rollback, contracts, TypeScript, and production-build verification.

## Pre-migration deployment compatibility

- The client probes once per Supabase client instance for the additive `price_denomination` column and caches the result.
- Before the migration exists, public listing reads use the legacy field set and preserve the current raw-`price` filtering, ordering, and cursor behavior instead of failing on missing columns.
- After the migration exists, the same paths automatically switch to denomination metadata and `price_new_syp_normalized`.
- Draft creation and owner updates omit `price_denomination` only while connected to the legacy schema, preventing Preview environments from sending unsupported RPC patch keys or insert columns.
- The unclassified queue returns an empty result before migration, and classification requests return an explicit `schema_missing` result.
- This compatibility layer is a rollout safeguard only. It does not replace independent Staging acceptance and must not be used to authorize Production activation before the migration gate is complete.

## Free local apply/rollback rehearsal

The repository owns a repeatable no-cost rehearsal at `.github/workflows/syp-denomination-phase-a-local-rehearsal.yml` and `scripts/sql/syp-denomination-phase-a-local-rehearsal.sql`.

The workflow builds the canonical database baseline without Phase A, inserts deterministic SYP fixtures, then performs the following sequence on a disposable local Supabase stack:

1. Snapshot fixture `id`, `price`, `currency`, and `updated_at` values before migration.
2. Apply `202607210001_syp_denomination_phase_a.sql`.
3. Prove all stored prices and currencies are unchanged.
4. Prove existing priced SYP rows start as `unclassified` with null normalized values.
5. Classify explicit old-SYP and new-SYP fixtures through the owner RPC and verify both normalize to the same new-SYP value.
6. Prove stale classification writes are rejected.
7. Prove a priced unclassified SYP draft cannot be submitted for review.
8. Apply `scripts/sql/syp-denomination-phase-a-rollback.sql`.
9. Prove additive columns and Phase A RPCs are removed, prices remain unchanged, and classification backup rows are retained.
10. Re-apply Phase A cleanly and run database lint.

The first recorded run, GitHub Actions run `29792768954`, passed the entire sequence and uploaded a 14-day evidence artifact. The evidence reported three unchanged fixture prices, two rollback backup rows, successful owner classification, rejected stale write, rejected unclassified submission, successful rollback, and successful clean re-apply.

This is stronger than a normal schema replay, but it remains a local disposable environment. It does not claim independent Supabase Staging equivalence and does not authorize a Production migration.

## Staging acceptance

1. Apply `202607210001_syp_denomination_phase_a.sql` to Staging only.
2. Record the pre-apply count and checksum/snapshot of `listings.id`, `price`, and `currency`.
3. Confirm existing `price` values are byte-for-byte unchanged after apply.
4. Confirm all existing priced SYP rows are `unclassified` and have a null normalized value.
5. Create one old-SYP and one new-SYP draft.
6. Verify normalized values and dual display.
7. Verify submission fails for `unclassified`.
8. Verify owner and moderator classification queues, including stale-write rejection.
9. Verify price filtering, sorting, and cursor pagination use normalized values.
10. Verify saved-search price alerts exclude unclassified listings.
11. Verify favorite snapshots and price-drop history retain denomination metadata.
12. Verify structured data omits unclassified offers and uses the normalized new-SYP amount after classification.
13. Rehearse `scripts/sql/syp-denomination-phase-a-rollback.sql` against a disposable Staging copy.
14. Re-run the full local replay and acceptance suite after rollback and confirm the baseline schema/functions are restored.

## Production gate

Do not apply to Production until independent SQL review, affected-row evidence, Staging write acceptance, backup evidence, and a successful rollback rehearsal are attached to the deployment record. Merging the application code or migration file does not authorize a Production migration.
