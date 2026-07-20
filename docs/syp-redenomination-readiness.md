# RAWAJ SYP redenomination readiness

## Decision boundary

The official redenomination standard is:

- `100` old Syrian pounds = `1` new Syrian pound.
- Monetary values must remain economically equivalent; the operation changes denomination, not purchasing value.
- During the transition, monetary amounts must be distinguishable as old or new and displayed in both denominations where required.

This repository must not divide every existing `SYP` value by `100` until each stored amount has an explicit denomination. The current `currency = 'SYP'` value identifies the currency but not whether the numeric amount is old or new.

## Read-only Production snapshot — 2026-07-20

The connected RAWAJ Production project was inspected with read-only SQL:

| Item | Observed value |
| --- | ---: |
| Approved listings | 33 |
| Listings with numeric prices | 26 |
| Listings without numeric prices | 7 |
| Distinct stored currencies | `SYP` only |
| Minimum stored numeric price | 345 |
| Maximum stored numeric price | 320,000,000 |
| Favorite snapshot rows | 0 |
| Price-change history rows | 0 |
| Saved searches containing price filters | 0 |

All current listings were created after the new-currency rollout began. The wide price range and category distribution indicate that magnitude alone cannot prove whether a row is old or new denomination. No automatic threshold conversion is permitted.

## Required two-phase cutover

### Phase A — additive classification

1. Add an explicit SYP denomination field with values:
   - `old`
   - `new`
   - `unclassified`
2. Backfill all existing priced `SYP` rows as `unclassified`.
3. Require new and edited priced `SYP` listings to select `old` or `new` denomination.
4. Add a normalized new-SYP amount for sorting, filtering, price-drop detection, snapshots, alerts, and reporting.
5. Display both old and new values for classified SYP amounts.
6. Create an owner/admin classification queue for existing rows.
7. Do not alter the stored numeric `price` during this phase.

### Phase B — governed conversion

Phase B may begin only after every priced SYP row is classified and the following preconditions pass:

- no `unclassified` priced SYP rows;
- no stale owner updates;
- all listing read/write RPCs carry denomination metadata;
- saved searches and price filters use the normalized amount;
- favorite snapshots and price-change history preserve denomination;
- rollback tables and row counts are captured;
- staging write acceptance passes with old and new input cases;
- a reviewed Production backup exists.

Only then may a migration normalize canonical storage to new SYP. The conversion must use the exact factor `100`, preserve original values in an audit table, and be reversible.

## Repository impact inventory

The cutover affects more than `listings.price`:

- listing create/update/submit RPCs;
- public listing filters and sort order;
- listing cards, detail pages, compare, SEO, and JSON-LD;
- favorites and favorite snapshots;
- price-change history and price-drop notifications;
- saved-search price filters and background matching;
- promotions and any amount-based reports;
- generated TypeScript listing types;
- demo data and acceptance fixtures;
- Android and web formatting.

## Safety rules

- Never infer denomination from price magnitude, category, owner, or creation date.
- Never overwrite a numeric amount before storing its original amount and denomination.
- Never use floating exchange rates; this is a fixed redenomination factor.
- Never mix old and new amounts in comparison, sorting, or alert logic.
- Never apply the migration directly to Production before staging acceptance and a rollback rehearsal.

## Read-only audit command

Run `scripts/sql/syp-redenomination-production-audit.sql` through an approved read-only connection. The script starts with `begin transaction read only` and ends with `rollback`; it contains no data-definition or data-mutation statements.

## External legal/operational evidence

Before Phase B, attach the current Central Bank implementation instructions, the active end date for old-currency exchange, and the dual-display requirements to the release evidence. The conversion factor remains `100:1`; operational deadlines may change and must be reverified immediately before deployment.
