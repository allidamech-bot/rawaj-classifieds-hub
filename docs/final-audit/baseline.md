# RAWAJ Final Audit Baseline

## Repository baseline

- Repository: `allidamech-bot/rawaj-classifieds-hub`
- Base branch: `main`
- Verified baseline commit: `a9a53981ab82de385604f4145e0975aaace97b40`
- Last merged pull request: `#209 — Add governed private verification documents V2`
- Captured: 2026-07-10

## Evidence rules

- **R** — verified from the repository baseline.
- **P** — verified directly in Production.
- **T** — verified by a behavioral test.
- **I** — inference awaiting direct proof.
- **S** — requires Supabase Production verification.
- **A** — requires an authenticated journey.
- **D** — requires Android device verification.

No `I`, `S`, `A`, or `D` item may be presented as confirmed until its required evidence exists.

## Phase 0 scope

Phase 0 records the repository, route, API/RPC, migration, storage, admin/customer route, test, and workflow baseline. It makes no functional Product, database, security, design, SEO, or Production change.

## Phase 1 PR 1 scope

This branch may only:

1. inventory repository migrations;
2. document known and unknown migration state;
3. detect duplicate migration versions;
4. add the detector to Quality Gate;
5. establish the canonical migration ledger.

It must not rename historical migrations, execute SQL, or modify Supabase Production.
