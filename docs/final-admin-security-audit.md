# RAWAJ Final Admin Security & E2E Contract Audit

This stage closes the administration security plan with persistent regression checks and database-boundary hardening.

## Covered boundaries

- Owner / Admin / Moderator permission matrix
- direct admin route authorization
- owner-only system settings and staff authority
- owner target protection
- user suspend / restore / ban boundaries
- listing moderation reason and stale-version contracts
- safety case lifecycle, notes, links, assignment, and escalation
- ad placement owner authority and stale writes
- campaign owner authority, measured events, and stale writes
- audit event presence for sensitive mutations
- RLS presence on new sensitive operational tables
- removal of direct client mutation grants on RPC-managed sensitive tables
- emergency read-only enforcement at the database boundary
- scoped new-write freezes for listings, messages, promotions, and verifications
- public BottomNav preserved at exactly five items
- admin routes remain hidden from the public BottomNav

## Persistent regression gate

`npm run security:admin` executes deterministic repository contract checks. The main Quality Gate now runs this check after TypeScript validation and before the production build. A future change that removes a required permission boundary, owner-only check, stale guard, audit contract, system-control trigger, or navigation invariant fails CI.

A failed security invariant is treated as an internal Quality Gate failure and blocks merge until the code or the deliberately changed invariant contract is reviewed and updated explicitly.

## E2E distinction

The automated regression is an end-to-end **contract-path audit across UI permission declarations, route guards, API clients, generated route integration, SQL/RPC authority, RLS declarations, audit contracts, and database triggers**.

It is not presented as a live browser test against production Supabase data. No production credentials are embedded in CI, and no claim is made that Vercel or Supabase Preview executed a live authenticated Owner/Admin/Moderator scenario. Live environment checks remain a separate deployment concern from the internal Quality Gate.

## System control enforcement

`emergency_read_only` is enforced by database triggers on supported write tables. The scoped freeze switches block new inserts for their corresponding flows while still allowing normal updates unless emergency read-only is active. Trigger installation is conditional on table existence to tolerate staged schemas.

`maintenance_mode` remains an audited operational state and is not falsely represented as a complete application-wide maintenance screen until public request routing consumes it.
