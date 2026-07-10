# RAWAJ Final Audit Dependency Map

The execution order is intentionally serial where contracts overlap.

1. **Phase 0 — Baseline and defect register**
   Establishes evidence and scope; no functional changes.
2. **Phase 1 — Production schema truth**
   Establishes migration history, deployed schema, RLS, grants, functions, storage, and reconciliation safety.
3. **Phase 2 — Security and data integrity**
   Depends on the verified database and authorization contract.
4. **Phase 3 — Release Quality Gate**
   Converts verified contracts into automated prevention.
5. **Phase 4 — Trust data correctness**
   Depends on stable schema, permissions, and integration-test infrastructure.
6. **Phase 5 — Customer journeys**
   Depends on database, authorization, and release-gate stability.
7. **Phase 6 — Admin operations**
   Depends on role matrix, audit rules, and stale-safe mutation contracts.
8. **Phase 7 — SSR and performance**
   Begins only after data contracts and critical journeys stabilize.
9. **Phase 8 — SEO and discovery**
   Depends on stable public lifecycle and media delivery.
10. **Phase 9 — Mobile accessibility**
    Hardens stable journeys rather than redesigning changing ones.
11. **Phase 10 — Android production hardening**
    Depends on stable auth, routing, uploads, and public links.
12. **Phase 11 — Final design polish**
    Must not precede schema, security, journeys, performance, and SEO closure.
13. **Phase 12 — Final launch audit**
    Re-verifies repository and Production from zero before any launch-readiness claim.

## Current allowed work

Only Phase 0 and Phase 1 PR 1 are in scope. Production schema extraction begins after the migration-ledger PR is merged.
