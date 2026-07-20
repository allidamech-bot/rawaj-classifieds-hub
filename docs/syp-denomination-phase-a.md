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
- Unclassified prices are not included in numeric price filtering or price ordering.
- Classified prices display both new and old equivalents.
- Owner/admin classification is stale-write protected and changes metadata only.

## Staging acceptance

1. Apply `202607210001_syp_denomination_phase_a.sql` to Staging only.
2. Confirm existing `price` values are byte-for-byte unchanged.
3. Confirm all existing priced SYP rows are `unclassified`.
4. Create one old-SYP and one new-SYP draft.
5. Verify normalized values and dual display.
6. Verify submission fails for `unclassified`.
7. Verify owner and moderator classification queues.
8. Verify price filtering and sorting use normalized values.
9. Verify favorite snapshots and price-drop history retain denomination metadata.
10. Rehearse `scripts/sql/syp-denomination-phase-a-rollback.sql` against a disposable Staging copy.

## Production gate

Do not apply to Production until SQL review, row-count evidence, Staging write acceptance, backup, and rollback rehearsal are attached to the deployment record.
