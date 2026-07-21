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

- Phase A activation is controlled by the explicit build flag `VITE_RAWAJ_SYP_DENOMINATION_SCHEMA=1`.
- The flag defaults to disabled. Application code deployed before the migration therefore uses the legacy field set and preserves the current raw-`price` filtering, ordering, cursor, create, and update behavior.
- The client does not probe the missing `price_denomination` column. This prevents Preview and SSR builds from writing expected missing-column errors into the Production PostgreSQL logs.
- After the additive migration is applied and verified, set `VITE_RAWAJ_SYP_DENOMINATION_SCHEMA=1` for the intended environment and rebuild that client. The same paths then switch to denomination metadata and `price_new_syp_normalized`.
- Draft creation and owner updates omit `price_denomination` while the flag is disabled, preventing Preview environments from sending unsupported RPC patch keys or insert columns.
- The unclassified queue returns an empty result while the flag is disabled, and classification requests return an explicit `schema_missing` result.
- Rollback requires disabling the flag and rebuilding clients before removing the additive database objects.
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

1. Keep `VITE_RAWAJ_SYP_DENOMINATION_SCHEMA` disabled in the existing Staging client.
2. Apply `202607210001_syp_denomination_phase_a.sql` to Staging only.
3. Record the pre-apply count and checksum/snapshot of `listings.id`, `price`, and `currency`.
4. Confirm existing `price` values are byte-for-byte unchanged after apply.
5. Confirm all existing priced SYP rows are `unclassified` and have a null normalized value.
6. Set `VITE_RAWAJ_SYP_DENOMINATION_SCHEMA=1` in Staging and rebuild the client.
7. Create one old-SYP and one new-SYP draft.
8. Verify normalized values and dual display.
9. Verify submission fails for `unclassified`.
10. Verify owner and moderator classification queues, including stale-write rejection.
11. Verify price filtering, sorting, and cursor pagination use normalized values.
12. Verify saved-search price alerts exclude unclassified listings.
13. Verify favorite snapshots and price-drop history retain denomination metadata.
14. Verify structured data omits unclassified offers and uses the normalized new-SYP amount after classification.
15. Disable the flag and rebuild the Staging client before rehearsing `scripts/sql/syp-denomination-phase-a-rollback.sql` against a disposable Staging copy.
16. Re-run the full local replay and acceptance suite after rollback and confirm the baseline schema/functions are restored.

## Production gate

Do not apply to Production until independent SQL review, affected-row evidence, Staging write acceptance, backup evidence, and a successful rollback rehearsal are attached to the deployment record. Merging the application code or migration file does not authorize a Production migration.

Production activation must remain ordered:

1. Deploy compatible application code with `VITE_RAWAJ_SYP_DENOMINATION_SCHEMA` disabled.
2. Apply and verify the additive migration.
3. Set `VITE_RAWAJ_SYP_DENOMINATION_SCHEMA=1` and rebuild Vercel and Android release artifacts.
4. Verify reads, writes, classification, filtering, and structured data before promotion.
