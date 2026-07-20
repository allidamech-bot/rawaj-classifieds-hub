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
