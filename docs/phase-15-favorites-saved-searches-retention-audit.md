# Phase 15 — Favorites, Saved Searches, Retention & Re-engagement

## Audit findings

- Favorite writes already converged through `rawaj_set_favorite_v1`, but the contract lacked explicit advisory locking and deterministic pagination indexes.
- Saved-search creation used a browser-side duplicate read followed by insert, leaving a race window for duplicate writes.
- Saved-search update and delete paths wrote tables directly from the browser instead of converging through actor-derived server contracts.
- Saved-search reads were unbounded and lacked a deterministic secondary order.
- Existing alert and push delivery primitives already protect public listing visibility and are retained for legacy compatibility.
- Unavailable favorites remain represented by private snapshots without exposing deleted, expired, archived, or unapproved listing data.

## Implemented contract

- Actor identity is derived from `auth.uid()` inside every Phase 15 mutation RPC.
- Favorite, saved-search create, update, and delete mutations use transaction-scoped advisory locks.
- Duplicate saved-search creation converges on the oldest existing account-owned record.
- Alert frequency is allowlisted to `off`, `daily`, or `weekly`.
- Saved-search reads use explicit columns, deterministic ordering, and a 100-row bound.
- Composite indexes support account-scoped retention reads and alert match cleanup.
- Browser APIs retain existing signatures for legacy callers while server authority ignores caller-supplied identity.

## Validation gates

- Permanent focused Node contract.
- Permanent read-only GitHub workflow.
- Quality Gate integration.
- Migration ledger collision check.
- Typecheck and production build through CI.
- Browser smoke through existing repository workflows and Vercel preview checks.

## Production rule

The Phase 15 migration is repository-only. It must be applied manually to Supabase Production after the PR is merged and the exact migration contents are reviewed.
